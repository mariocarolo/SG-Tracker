"use client";
import React, { useMemo, useState } from "react";
import type { Plan } from "@/lib/types";
import { iso, todayISO } from "@/lib/dates";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "./icons";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_CAP = 3;

export function CalendarView({ data }: { data: Plan }) {
  const start = useMemo(() => {
    const [y, m, d] = data.start.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }, [data.start]);
  const [cur, setCur] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });

  const events = useMemo(() => {
    const evs: { date: string; label: string; topic: string; color: string; done: boolean }[] = [];
    data.cats.forEach((c) =>
      c.items.forEach((it) =>
        it.checkpoints.forEach((cp) => evs.push({ date: cp.date, label: cp.label, topic: it.title, color: c.color, done: cp.done })),
      ),
    );
    return evs;
  }, [data]);

  const first = new Date(Date.UTC(cur.y, cur.m, 1));
  const startDow = first.getUTCDay();
  const daysIn = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const shift = (n: number) => {
    let m = cur.m + n, y = cur.y;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    setCur({ y, m });
  };

  return (
    <>
      <div className="cal-head">
        <h2>{monthLabel}</h2>
        <div className="cal-nav">
          <button onClick={() => shift(-1)}><ChevronLeft size={14} /> Prev</button>
          <button onClick={() => setCur({ y: start.getUTCFullYear(), m: start.getUTCMonth() })}>Plan start</button>
          <button onClick={() => { const n = new Date(); setCur({ y: n.getFullYear(), m: n.getMonth() }); }}>Today</button>
          <button onClick={() => shift(1)}>Next <ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="cal-legend">
        {data.cats.map((c) => (
          <span key={c.id}><span className="swatch" style={{ background: c.color }} />{c.name}</span>
        ))}
      </div>

      <div className="cal-scroll">
        <div className="cal-grid">
          {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div className="cal-cell blank" key={i} />;
            const dISO = iso(new Date(Date.UTC(cur.y, cur.m, d)));
            const evs = events.filter((e) => e.date === dISO);
            const isStart = dISO === data.start;
            const isToday = dISO === todayISO();
            return (
              <div className={`cal-cell${isToday ? " today" : ""}${isStart ? " is-start" : ""}`} key={i}>
                <div className="cal-daynum">
                  <span>{isToday ? <b>{d}</b> : d}</span>
                  {isStart && <span className="cal-start-flag">Start</span>}
                </div>
                {evs.slice(0, MONTH_CAP).map((e, j) => (
                  <div
                    className={`cal-ev${e.done ? " done" : ""}`}
                    key={j}
                    style={{ borderLeftColor: e.color, background: e.color + "16" }}
                    title={`${e.label} — ${e.topic}${e.done ? " (done)" : ""}`}
                  >
                    {e.done && <CheckCircle2 size={10} style={{ flexShrink: 0 }} />}
                    <span className="ev-t">{e.label}</span>
                  </div>
                ))}
                {evs.length > MONTH_CAP && <div className="cal-more">+{evs.length - MONTH_CAP} more</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
