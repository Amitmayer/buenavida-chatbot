"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Notice } from "@/lib/notify/unseen";

type NoticeStore = {
  items: Notice[];
  add: (item: Notice) => void;
  dismiss: (item: Notice) => void;
  dismissAll: () => void;
};

const NoticeCtx = createContext<NoticeStore | null>(null);

function hideKey(item: Notice) {
  return `${item.id}:${item.at}`;
}

export function NoticeProvider({
  initial,
  children,
}: {
  initial: Notice[];
  children: ReactNode;
}) {
  const [live, setLive] = useState<Notice[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setLive((prev) =>
      prev.filter((item) => {
        const server = initial.find((row) => row.id === item.id);
        return Boolean(server && item.at > server.at);
      }),
    );
  }, [initial]);

  const items = useMemo(() => {
    const map = new Map<string, Notice>();
    for (const item of initial) map.set(item.id, item);
    for (const item of live) {
      const prev = map.get(item.id);
      if (!prev || item.at >= prev.at) {
        map.set(item.id, {
          ...prev,
          ...item,
          unread: Math.max(prev?.unread ?? 0, item.unread),
        });
      }
    }
    return [...map.values()]
      .filter((item) => !hidden.has(hideKey(item)))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [initial, live, hidden]);

  const add = useCallback((item: Notice) => {
    setLive((prev) => [item, ...prev.filter((row) => row.id !== item.id)]);
    setHidden((prev) => {
      const next = new Set(prev);
      for (const key of prev) {
        if (key.startsWith(`${item.id}:`)) next.delete(key);
      }
      return next;
    });
  }, []);

  const dismiss = useCallback((item: Notice) => {
    setHidden((prev) => new Set(prev).add(hideKey(item)));
  }, []);

  const dismissAll = useCallback(() => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const item of [...initial, ...live]) next.add(hideKey(item));
      return next;
    });
  }, [initial, live]);

  const value = useMemo(() => ({ items, add, dismiss, dismissAll }), [items, add, dismiss, dismissAll]);

  return <NoticeCtx.Provider value={value}>{children}</NoticeCtx.Provider>;
}

export function useNotices() {
  const ctx = useContext(NoticeCtx);
  if (!ctx) throw new Error("useNotices");
  return ctx;
}
