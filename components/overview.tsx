"use client";
import React from "react";
import type { Plan, HistorySnapshot } from "@/lib/types";
import { pctOf, weightedPct, healthOf, healthReason, assignLabel, RAG } from "@/lib/logic";
import { fmtShort, fmtDT, parse, todayISO } from "@/lib/dates";
import { GanttChartSquare, Trophy } from "./icons";

function TrendChart({ history }: { history?: HistorySnapshot[] }) {
  const pts = (history || []).filter((h) => h.total > 0);
  if (pts.length < 2) {
    return (
      <div className="empty" style={{ padding: 22 }}>
        Trend appears once there are at least two weeks of data. This week&apos;s progress is being recorded now.
      </div>
    );
  }
  const W = 640, H = 150, padL = 30, padR = 12, padT = 12, padB = 22;
  const n = pts.length;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const last = pts[n - 1], prev = pts[n - 2];
  const delta = last.overall - prev.overall;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{last.overall}%</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: delta > 0 ? "var(--done)" : delta < 0 ? "var(--block)" : "var(--ink-soft)" }}>
          {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "→ "}{delta !== 0 ? Math.abs(delta) + " pts" : "no change"} vs last week
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="#eee9df" strokeWidth="1" />
            <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="#5a6373">{g}</text>
          </g>
        ))}
        <path d={area} fill="#1c2533" fillOpacity="0.06" />
        <path d={line} fill="none" stroke="#1c2533" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.overall)} r="3" fill="#ffffff" stroke="#1c2533" strokeWidth="2" />
            {(i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) && (
              <text x={x(i)} y={H - 7} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#5a6373">{p.week.replace(/^\d+-/, "")}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Overview({ data }: { data: Plan }) {
  const all = data.cats.flatMap((c) => c.items.map((it) => ({ ...it, cat: c })));
  const total = all.length;
  const done = all.filter((it) => it.status === "done").length;
  const prog = all.filter((it) => it.status === "in_progress").length;
  const overall = weightedPct(all);

  const today = parse(todayISO());
  const upcoming = data.cats
    .flatMap((c) =>
      c.items.flatMap((it) =>
        it.checkpoints
          .filter((cp) => !cp.done)
          .map((cp) => ({ date: cp.date, label: cp.label, item: it.title, owner: assignLabel(it), color: c.color, overdue: parse(cp.date) < today })),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

  const ragList = all.map((it) => ({ it, h: healthOf(it) }));
  const rag: Record<string, number> = { green: 0, amber: 0, red: 0 };
  ragList.forEach((r) => rag[r.h]++);
  const attention = ragList.filter((r) => r.h !== "green").sort((a, b) => (a.h === "red" ? 0 : 1) - (b.h === "red" ? 0 : 1));
  const activity = (data.activity || []).slice(-15).reverse();

  return (
    <>
      <div className="stats">
        <div className="card stat"><div className="n">{total}</div><div className="l">Topics tracked</div></div>
        <div className="card stat"><div className="n" style={{ color: "var(--done)" }}>{overall}%</div><div className="l">Overall progress</div></div>
        <div className="card stat"><div className="n" style={{ color: "var(--prog)" }}>{prog}</div><div className="l">In progress</div></div>
        <div className="card stat"><div className="n">{done}/{total}</div><div className="l">Topics done</div></div>
      </div>

      <div className="card panel" style={{ marginTop: 18 }}>
        <h3>Health (RAG)</h3>
        <div className="ph">Auto-derived from the schedule · {rag.red} off track, {rag.amber} at risk, {rag.green} on track</div>
        <div className="rag-bar">
          {(["green", "amber", "red"] as const).map((k) => rag[k] > 0 && (
            <div key={k} style={{ width: `${(rag[k] / total) * 100}%`, background: RAG[k].c }} title={`${rag[k]} ${RAG[k].l}`} />
          ))}
        </div>
        <div className="rag-counts">
          {(["red", "amber", "green"] as const).map((k) => (
            <span key={k} className="rag-count"><span className="rag-dot" style={{ background: RAG[k].c }} /> <b>{rag[k]}</b> {RAG[k].l}</span>
          ))}
        </div>
        {attention.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div className="person-sub" style={{ marginTop: 14 }}>Needs attention</div>
            {attention.map(({ it, h }) => (
              <div className="prow" key={it.id}>
                <span className="rag-dot" style={{ background: RAG[h].c }} />
                <span className="pt">{it.title}</span>
                <span className="tag">{healthReason(it)}</span>
                <span className="tag">{assignLabel(it)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card panel" style={{ marginTop: 18 }}>
        <h3>Progress over time</h3>
        <div className="ph">Overall completion by week — recorded automatically</div>
        <TrendChart history={data.history} />
      </div>

      <div className="ov-grid">
        <div className="card panel">
          <h3>Progress by workstream</h3>
          <div className="ph">Average completion across topics</div>
          {data.cats.map((c) => {
            const p = weightedPct(c.items);
            return (
              <div className="cat-line" key={c.id}>
                <span className="swatch" style={{ background: c.color }} />
                <span className="name">{c.name}</span>
                <div className="bar" style={{ width: 130, flex: "none" }}><i style={{ width: `${p}%`, background: c.color }} /></div>
                <span className="pct">{p}%</span>
              </div>
            );
          })}
        </div>

        <div className="card panel">
          <h3>Next checkpoints</h3>
          <div className="ph">Soonest unfinished milestones</div>
          {upcoming.length === 0 && <div className="empty">All checkpoints complete.</div>}
          {upcoming.map((u, i) => (
            <div className="agenda" key={i}>
              <span className={`when${u.overdue ? " overdue" : ""}`}>{fmtShort(u.date)}</span>
              <div className="what">{u.label}<div className="who">{u.item} · {u.owner || "unassigned"}</div></div>
              <span className="swatch" style={{ background: u.color, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="card panel" style={{ marginTop: 18 }}>
        <h3>Accomplishments by phase</h3>
        <div className="ph">What&apos;s done — and what&apos;s still open — in each phase</div>
        {[1, 2, 3].map((ph) => {
          const items = all.filter((it) => it.phase === ph);
          const doneItems = items.filter((it) => it.status === "done");
          const openCount = items.length - doneItems.length;
          const pc = items.length ? Math.round((doneItems.length / items.length) * 100) : 0;
          return (
            <div className="prio-block" key={ph}>
              <div className="prio-head">
                <GanttChartSquare size={13} style={{ color: "var(--ink-soft)" }} />
                <span className="prio-name">Phase {ph}</span>
                <div className="bar" style={{ width: 120, flex: "none" }}><i style={{ width: `${pc}%`, background: "var(--ink)" }} /></div>
                <span className="prio-count">{doneItems.length} done · {openCount} open</span>
              </div>
              {doneItems.length === 0 ? (
                <div className="prio-none">Nothing completed yet in this phase.</div>
              ) : (
                <div className="prio-list">
                  {doneItems.map((it) => (
                    <span className="acc-chip" key={it.id} title={it.cat.name}>
                      <Trophy size={11} style={{ color: "var(--done)" }} /> {it.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card panel" style={{ marginTop: 18 }}>
        <h3>Recent activity</h3>
        <div className="ph">Latest changes across the plan</div>
        {activity.length === 0 ? (
          <div className="empty" style={{ padding: 18 }}>No changes recorded yet.</div>
        ) : (
          activity.map((a) => (
            <div className="act-row" key={a.id}>
              <span className="act-when">{fmtDT(a.ts)}</span>
              <span className="act-msg">{a.msg}{a.actor ? ` · ${a.actor}` : ""}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
