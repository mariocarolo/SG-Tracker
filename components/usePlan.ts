"use client";
import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan, Item } from "@/lib/types";
import type { ItemRowData } from "@/db/schema";

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

/** Merge a polled server plan into local state without losing in-progress
 *  edits or downgrading versions (see fix notes). */
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
  const serverIds = new Set(server.cats.flatMap((c) => c.items.map((it) => it.id)));
  cats.forEach((c, ci) => {
    const localCat = local.cats.find((lc) => lc.id === c.id);
    localCat?.items.forEach((li) => {
      if (dirty.has(li.id) && !serverIds.has(li.id)) cats[ci].items.push(li);
    });
  });
  return { ...server, cats };
}

export type SaveState = "idle" | "saving" | "saved" | "error";
export interface Toast {
  id: string;
  msg: string;
  warn?: boolean;
  key?: string;
}

export function usePlan() {
  const dirty = useRef<Set<string>>(new Set()); // ids with edits waiting to save
  const failed = useRef<Set<string>>(new Set()); // ids whose save failed permanently
  const attempts = useRef<Record<string, number>>({}); // transient retry counters
  const pumping = useRef(false); // only one save loop at a time
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dataRef = useRef<Plan | undefined>(undefined);
  const versionRef = useRef<Record<string, number>>({}); // authoritative version per item

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  // One visible toast per key (prevents the "stacked duplicates" problem).
  const pushToast = useCallback((msg: string, warn = false, key?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => (key && t.some((x) => x.key === key) ? t : [...t, { id, msg, warn, key }]));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const cacheItem = useCallback((id: string): Item | undefined => {
    for (const c of dataRef.current?.cats || []) {
      const found = c.items.find((it) => it.id === id);
      if (found) return found;
    }
    return undefined;
  }, []);

  const setItemInCache = useCallback(
    (id: string, next: Item) => {
      mutate(
        (cur) =>
          cur ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.map((it) => (it.id === id ? next : it)) })) } : cur,
        { revalidate: false },
      );
    },
    [mutate],
  );

  // Single serialized save loop. Drains the dirty set, with bounded retries and
  // backoff. Never loops forever; never fires duplicate concurrent saves.
  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    setSaveState("saving");
    try {
      while (dirty.current.size > 0) {
        const id = dirty.current.values().next().value as string;
        dirty.current.delete(id);
        const item = cacheItem(id);
        if (!item) {
          delete attempts.current[id];
          failed.current.delete(id);
          continue;
        }
        const expected = versionRef.current[id] ?? item.version;
        let ok = false;
        try {
          const res = await fetch(`/api/items/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: expected, data: toData(item) }),
          });
          if (res.status === 409) {
            const body = await res.json().catch(() => ({}));
            if (body?.current) {
              versionRef.current[id] = body.current.version;
              if (!dirty.current.has(id)) setItemInCache(id, body.current);
            }
            pushToast("Someone else just updated that item — showing the latest version.", true, "conflict");
            ok = true;
          } else if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            console.error(`[save] PATCH ${id} -> HTTP ${res.status}`, body);
          } else {
            const { item: saved } = (await res.json()) as { item: Item };
            versionRef.current[id] = saved.version;
            if (dirty.current.has(id)) {
              const live = cacheItem(id);
              if (live) setItemInCache(id, { ...live, version: saved.version });
            } else {
              setItemInCache(id, saved);
            }
            ok = true;
          }
        } catch (e) {
          console.error(`[save] PATCH ${id} network error`, e);
        }

        if (ok) {
          delete attempts.current[id];
          failed.current.delete(id);
        } else {
          const n = (attempts.current[id] || 0) + 1;
          attempts.current[id] = n;
          if (n <= MAX_RETRIES) {
            await sleep(Math.min(5000, 700 * n)); // backoff, then retry
            dirty.current.add(id);
          } else {
            delete attempts.current[id];
            failed.current.add(id); // give up; keep the edit on screen for manual retry
            pushToast("Couldn’t save a change. Your edit is still here — click “Retry” in the header.", true, "save-error");
          }
        }
      }
    } finally {
      pumping.current = false;
      const hasFailures = failed.current.size > 0;
      setSaveState(hasFailures ? "error" : "saved");
      if (!hasFailures) setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    }
  }, [cacheItem, pushToast, setItemInCache]);

  // Pull latest from server and MERGE (never clobber local edits / lower versions).
  const poll = useCallback(async () => {
    if (pumping.current || dirty.current.size > 0 || failed.current.size > 0) return;
    try {
      const server: Plan = await fetcher("/api/plan");
      mutate((cur) => (cur ? mergePlan(cur, server, dirty.current) : server), { revalidate: false });
    } catch {
      /* transient — try next tick */
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

  // Edit one initiative. Discrete actions save immediately; typing is debounced.
  const mutateItem = useCallback(
    (next: Item, immediate = false) => {
      setItemInCache(next.id, next);
      dirty.current.add(next.id);
      delete attempts.current[next.id];
      failed.current.delete(next.id); // a fresh edit clears the prior error for this item
      if (immediate) {
        pump();
      } else {
        clearTimeout(timers.current[next.id]);
        timers.current[next.id] = setTimeout(() => pump(), 400);
      }
    },
    [pump, setItemInCache],
  );

  const retry = useCallback(() => {
    failed.current.forEach((id) => {
      delete attempts.current[id];
      dirty.current.add(id);
    });
    failed.current.clear();
    pump();
  }, [pump]);

  // Flush still-pending edits if the page is hidden/closed/reloaded.
  const flushAll = useCallback(() => {
    const ids = new Set<string>([...dirty.current, ...failed.current]);
    ids.forEach((id) => {
      const item = cacheItem(id);
      if (!item) return;
      const expected = versionRef.current[id] ?? item.version;
      try {
        fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: expected, data: toData(item) }),
          keepalive: true,
        });
      } catch {
        /* page is going away */
      }
    });
  }, [cacheItem]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushAll]);

  const createItem = useCallback(
    async (categoryId: string, title: string) => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, title }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`[create] POST -> HTTP ${res.status}`, body);
          throw new Error();
        }
        const { item } = (await res.json()) as { item: Item };
        versionRef.current[item.id] = item.version;
        mutate(
          (cur) =>
            cur ? { ...cur, cats: cur.cats.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, item] } : c)) } : cur,
          { revalidate: false },
        );
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setSaveState("error");
        pushToast("Couldn’t add the topic. Please try again.", true, "create-error");
      }
    },
    [mutate, pushToast],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      dirty.current.delete(id);
      failed.current.delete(id);
      delete attempts.current[id];
      delete versionRef.current[id];
      mutate(
        (cur) => (cur ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) })) } : cur),
        { revalidate: false },
      );
      try {
        const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        pushToast("Couldn’t delete the topic — refreshing.", true, "delete-error");
        await poll();
      }
    },
    [mutate, poll, pushToast],
  );

  const setStart = useCallback(
    async (start: string) => {
      setSaveState("saving");
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
        setSaveState("idle");
      } catch {
        setSaveState("error");
        pushToast("Couldn’t update the plan start.", true, "start-error");
      }
    },
    [mutate, pushToast],
  );

  const resetPlan = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error();
      const plan = (await res.json()) as Plan;
      versionRef.current = {};
      plan.cats.forEach((c) => c.items.forEach((it) => (versionRef.current[it.id] = it.version)));
      mutate(plan, { revalidate: false });
      setSaveState("idle");
    } catch {
      setSaveState("error");
      pushToast("Couldn’t reset the plan.", true, "reset-error");
    }
  }, [mutate, pushToast]);

  return {
    plan: data,
    error,
    isLoading,
    saveState,
    busy: saveState === "saving",
    toasts,
    dismissToast,
    pushToast,
    mutateItem,
    createItem,
    deleteItem,
    setStart,
    resetPlan,
    retry,
    refresh: () => poll(),
  };
}
