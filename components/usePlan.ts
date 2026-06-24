"use client";
import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan, Item } from "@/lib/types";
import type { ItemRowData } from "@/db/schema";

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return r.json();
};

const toData = (it: Item): ItemRowData => {
  const { id, version, ...rest } = it;
  return rest as ItemRowData;
};

/**
 * Merge a freshly-polled server plan into the current local plan WITHOUT losing
 * in-progress edits or downgrading versions. The server is the base; for each
 * item we keep the local copy if it's being edited (dirty) or if local holds a
 * newer/equal version we already adopted from a save. This prevents a stale
 * in-flight poll from clobbering a just-saved change.
 */
function mergePlan(local: Plan, server: Plan, dirty: Set<string>): Plan {
  const localItems = new Map<string, Item>();
  local.cats.forEach((c) => c.items.forEach((it) => localItems.set(it.id, it)));
  const cats = server.cats.map((sc) => ({
    ...sc,
    items: sc.items.map((si) => {
      const li = localItems.get(si.id);
      if (li && (dirty.has(si.id) || li.version > si.version)) return li;
      return si;
    }),
  }));
  // Keep any dirty item the server doesn't know about yet (e.g. mid-create).
  const serverIds = new Set(server.cats.flatMap((c) => c.items.map((it) => it.id)));
  cats.forEach((c, ci) => {
    const localCat = local.cats.find((lc) => lc.id === c.id);
    if (!localCat) return;
    localCat.items.forEach((li) => {
      if (dirty.has(li.id) && !serverIds.has(li.id)) cats[ci].items.push(li);
    });
  });
  return { ...server, cats };
}

export interface Toast {
  id: string;
  msg: string;
  warn?: boolean;
}

export function usePlan() {
  const dirty = useRef<Set<string>>(new Set());
  const savingNow = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dataRef = useRef<Plan | undefined>(undefined);
  // Authoritative version per item — the single source of truth for what we
  // send on the next save, immune to render/poll timing.
  const versionRef = useRef<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // SWR is used only as a cache + the initial load. All refreshing is manual
  // (see poll) so we can MERGE instead of overwrite.
  const { data, error, isLoading, mutate } = useSWR<Plan>("/api/plan", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  useEffect(() => {
    dataRef.current = data;
    if (data) {
      for (const c of data.cats) {
        for (const it of c.items) {
          versionRef.current[it.id] = Math.max(versionRef.current[it.id] ?? 0, it.version);
        }
      }
    }
  }, [data]);

  const pushToast = useCallback((msg: string, warn = false) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, warn }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800);
  }, []);

  const cacheItem = (id: string): Item | undefined => {
    for (const c of dataRef.current?.cats || []) {
      const found = c.items.find((it) => it.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const refreshBusy = () => setBusy(dirty.current.size > 0 || savingNow.current);

  const setItemInCache = useCallback(
    (id: string, next: Item) => {
      mutate(
        (cur) =>
          cur
            ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.map((it) => (it.id === id ? next : it)) })) }
            : cur,
        { revalidate: false },
      );
    },
    [mutate],
  );

  // Pull the latest from the server and MERGE (never clobber local edits).
  const poll = useCallback(async () => {
    if (savingNow.current || dirty.current.size > 0) return; // stay out of the way while editing/saving
    try {
      const server: Plan = await fetcher("/api/plan");
      mutate((cur) => (cur ? mergePlan(cur, server, dirty.current) : server), { revalidate: false });
    } catch {
      /* transient — try again next tick */
    }
  }, [mutate]);

  useEffect(() => {
    const iv = setInterval(poll, 5000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  const save = useCallback(
    async (id: string) => {
      if (savingNow.current) {
        timers.current[id] = setTimeout(() => save(id), 300); // serialize
        return;
      }
      const item = cacheItem(id);
      if (!item) {
        dirty.current.delete(id);
        refreshBusy();
        return;
      }
      savingNow.current = true;
      dirty.current.delete(id);
      refreshBusy();
      const expected = versionRef.current[id] ?? item.version;
      try {
        const res = await fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: expected, data: toData(item) }),
        });

        if (res.status === 409) {
          // A genuine conflict: another client saved a newer version first.
          const body = await res.json().catch(() => ({}));
          const current: Item | undefined = body?.current;
          if (current) {
            versionRef.current[id] = current.version;
            if (!dirty.current.has(id)) setItemInCache(id, current);
          }
          pushToast("Someone else just updated that item — showing the latest version.", true);
        } else if (!res.ok) {
          dirty.current.add(id); // keep pending so a later edit retries
          pushToast("Couldn't save that change. Edit again to retry.", true);
        } else {
          const { item: saved } = (await res.json()) as { item: Item };
          versionRef.current[id] = saved.version;
          // If the user kept editing while we saved, keep their newer data and
          // just adopt the version; otherwise take the saved item verbatim.
          if (dirty.current.has(id)) {
            const live = cacheItem(id);
            if (live) setItemInCache(id, { ...live, version: saved.version });
          } else {
            setItemInCache(id, saved);
          }
        }
      } catch {
        dirty.current.add(id);
        pushToast("Network problem saving — edit again to retry.", true);
      } finally {
        savingNow.current = false;
        refreshBusy();
        if (dirty.current.has(id)) {
          clearTimeout(timers.current[id]);
          timers.current[id] = setTimeout(() => save(id), 250);
        }
      }
    },
    [pushToast, setItemInCache],
  );

  // Edit one initiative — instant local update, debounced version-guarded save.
  const mutateItem = useCallback(
    (next: Item) => {
      setItemInCache(next.id, next);
      dirty.current.add(next.id);
      refreshBusy();
      clearTimeout(timers.current[next.id]);
      timers.current[next.id] = setTimeout(() => save(next.id), 500);
    },
    [save, setItemInCache],
  );

  const createItem = useCallback(
    async (categoryId: string, title: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, title }),
        });
        if (!res.ok) throw new Error();
        const { item } = (await res.json()) as { item: Item };
        versionRef.current[item.id] = item.version;
        // add it to the cache directly so it appears immediately
        mutate(
          (cur) =>
            cur
              ? { ...cur, cats: cur.cats.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, item] } : c)) }
              : cur,
          { revalidate: false },
        );
      } catch {
        pushToast("Couldn't add the topic. Please try again.", true);
      } finally {
        refreshBusy();
      }
    },
    [mutate, pushToast],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      dirty.current.delete(id);
      delete versionRef.current[id];
      mutate(
        (cur) => (cur ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) })) } : cur),
        { revalidate: false },
      );
      try {
        const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        pushToast("Couldn't delete the topic — refreshing.", true);
        await poll();
      }
    },
    [mutate, poll, pushToast],
  );

  const setStart = useCallback(
    async (start: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/plan/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start }),
        });
        if (!res.ok) throw new Error();
        const plan = (await res.json()) as Plan;
        plan.cats.forEach((c) => c.items.forEach((it) => (versionRef.current[it.id] = it.version)));
        mutate(plan, { revalidate: false });
      } catch {
        pushToast("Couldn't update the plan start.", true);
      } finally {
        refreshBusy();
      }
    },
    [mutate, pushToast],
  );

  const resetPlan = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error();
      const plan = (await res.json()) as Plan;
      versionRef.current = {};
      plan.cats.forEach((c) => c.items.forEach((it) => (versionRef.current[it.id] = it.version)));
      mutate(plan, { revalidate: false });
    } catch {
      pushToast("Couldn't reset the plan.", true);
    } finally {
      refreshBusy();
    }
  }, [mutate, pushToast]);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return {
    plan: data,
    error,
    isLoading,
    busy,
    toasts,
    dismissToast,
    pushToast,
    mutateItem,
    createItem,
    deleteItem,
    setStart,
    resetPlan,
    refresh: () => poll(),
  };
}
