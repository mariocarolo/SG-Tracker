"use client";
import React from "react";
import type { Plan } from "@/lib/types";
import { PHASE_LEN } from "@/lib/plan-template";
import { parse, addMonths, addDays, iso, fmt, fmtShort } from "@/lib/dates";

export function Schedule({ data }: { data: Plan }) {
  const start = parse(data.start);
  const phases = [1, 2, 3].map((p) => {
    const pStart = addMonths(start, (p - 1) * PHASE_LEN);
    const pEnd = addDays(addMonths(pStart, PHASE_LEN), -1);
    const items = data.cats.flatMap((c) => c.items.filter((it) => it.phase === p).map((it) => ({ ...it, color: c.color })));
    return { p, pStart, pEnd, items, span: pEnd.getTime() - pStart.getTime() };
  });

  return (
    <>
      <div className="toolbar">
        <span className="ph" style={{ marginTop: 4 }}>
          Suggested rollout across quarterly phases from {fmt(data.start)}. Adjust dates on the Board.
        </span>
      </div>
      {phases.map((ph) => (
        <div className="phase" key={ph.p}>
          <div className="phase-head">
            <h2>Phase {ph.p}</h2>
            <span className="span">{fmt(iso(ph.pStart))} — {fmt(iso(ph.pEnd))} · {ph.items.length} topics</span>
          </div>
          <div className="card">
            {ph.items.length === 0 && <div className="empty">No topics in this phase.</div>}
            {ph.items.map((it) => (
              <div className="rail-row" key={it.id}>
                <div className="rail-label"><span className="swatch" style={{ background: it.color }} />{it.title}</div>
                <div className="rail">
                  <div className="rail-line" />
                  {it.checkpoints.map((cp) => {
                    let pos = ((parse(cp.date).getTime() - ph.pStart.getTime()) / ph.span) * 100;
                    pos = Math.max(3, Math.min(97, pos));
                    return (
                      <div className={`node${cp.done ? " done" : ""}`} key={cp.id} style={{ left: `${pos}%` }} title={`${cp.label} · ${fmt(cp.date)}`}>
                        <span className="ball" />
                        <span className="tip">{fmtShort(cp.date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
