"use client";
import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan, Item } from "@/lib/types";
import type { ItemRowData } from "@/db/schema";

const fetcher = async (url: string) => {
  const r = await fetch(url);
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
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isPaused = useCallback(() => dirty.current.size > 0 || savingNow.current, []);

  const { data, error, isLoading, mutate } = useSWR<Plan>("/api/plan", fetcher, {
    refreshInterval: 6000,
    revalidateOnFocus: true,
    isPaused,
    dedupingInterval: 1500,
    keepPreviousData: true,
  });

  useEffect(() => {
    dataRef.current = data;
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

  const save = useCallback(
    async (id: string) => {
      if (savingNow.current) {
        // serialize: try again shortly
        timers.current[id] = setTimeout(() => save(id), 300);
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
      try {
        const res = await fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: item.version, data: toData(item) }),
        });
        if (res.status === 409) {
          pushToast("Someone else just updated that item — showing the latest version.", true);
          await mutate();
        } else if (!res.ok) {
          dirty.current.add(id); // keep it pending so a later edit retries
          pushToast("Couldn't save that change. Edit again to retry.", true);
        } else {
          const { item: saved } = await res.json();
          // adopt the new version number while keeping any newer local edits
          mutate(
            (cur) =>
              cur
                ? {
                    ...cur,
                    cats: cur.cats.map((c) => ({
                      ...c,
                      items: c.items.map((it) => (it.id === id ? { ...it, version: saved.version } : it)),
                    })),
                  }
                : cur,
            { revalidate: false },
          );
        }
      } catch {
        dirty.current.add(id);
        pushToast("Network problem saving — edit again to retry.", true);
      } finally {
        savingNow.current = false;
        refreshBusy();
        // if more edits queued for this id, flush again
        if (dirty.current.has(id)) {
          clearTimeout(timers.current[id]);
          timers.current[id] = setTimeout(() => save(id), 250);
        }
      }
    },
    [mutate, pushToast],
  );

  // Edit one initiative — instant local update, debounced save, version-guarded.
  const mutateItem = useCallback(
    (next: Item) => {
      mutate(
        (cur) =>
          cur
            ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.map((it) => (it.id === next.id ? next : it)) })) }
            : cur,
        { revalidate: false },
      );
      dirty.current.add(next.id);
      refreshBusy();
      clearTimeout(timers.current[next.id]);
      timers.current[next.id] = setTimeout(() => save(next.id), 500);
    },
    [mutate, save],
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
        await mutate();
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
      mutate(
        (cur) => (cur ? { ...cur, cats: cur.cats.map((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) })) } : cur),
        { revalidate: false },
      );
      try {
        const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        await mutate();
      } catch {
        pushToast("Couldn't delete the topic — refreshing.", true);
        await mutate();
      }
    },
    [mutate, pushToast],
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
        const plan = await res.json();
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
      const plan = await res.json();
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
    refresh: () => mutate(),
  };
}
