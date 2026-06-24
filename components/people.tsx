"use client";
import React, { useState } from "react";
import type { Plan } from "@/lib/types";
import { STATUSES } from "@/lib/plan-template";
import { ownerView, initials, OwnerSummary } from "@/lib/logic";
import { fmtShort } from "@/lib/dates";
import { ProgressBar } from "./ui";
import { PersonReport } from "./reports";
import { AlertTriangle, Clock, LayoutGrid, Trophy, CheckCircle2, Printer } from "./icons";

function OwnerCard({ o }: { o: OwnerSummary }) {
  const upcoming = o.upcoming.slice(0, 5);
  return (
    <div className="sec">
      <div className="sec-head">
        <span className="who-badge">{initials(o.owner)}</span>
        <h2>{o.owner}</h2>
        <span className="meta">{o.items.length} topics</span>
        <ProgressBar pct={o.prog} color="#1c2533" />
      </div>
      <div className="card person-card">
        <div className="person-kpis">
          <span className="k"><b>{o.items.length}</b>In scope</span>
          <span className="k"><b style={{ color: "var(--done)" }}>{o.done.length}</b>Concluded</span>
          <span className="k"><b>{o.open.length}</b>Open</span>
          <span className="k"><b style={{ color: o.overdue.length ? "var(--block)" : "var(--ink)" }}>{o.overdue.length}</b>Overdue</span>
        </div>

        {o.overdue.length > 0 && (
          <>
            <div className="person-sub"><AlertTriangle size={13} style={{ color: "var(--block)" }} /> Needs attention now</div>
            {o.overdue.map((cp, i) => (
              <div className="prow" key={i}>
                <span className="swatch" style={{ background: cp.color }} />
                <span className="pt">{cp.label} <span className="tag">— {cp.topic}</span></span>
                <span className="late">{cp.late}d late · {fmtShort(cp.date)}</span>
              </div>
            ))}
          </>
        )}

        <div className="person-sub"><Clock size={13} /> Coming up next</div>
        {upcoming.length === 0 ? (
          <div className="prio-none" style={{ paddingLeft: 0 }}>No upcoming checkpoints.</div>
        ) : (
          upcoming.map((cp, i) => (
            <div className="prow" key={i}>
              <span className="swatch" style={{ background: cp.color }} />
              <span className="pt">{cp.label} <span className="tag">— {cp.topic}</span></span>
              <span className="tag">{fmtShort(cp.date)}</span>
            </div>
          ))
        )}

        <div className="person-sub"><LayoutGrid size={13} /> In scope</div>
        {o.items.map((it) => {
          const st = STATUSES.find((s) => s.v === it.status)!;
          return (
            <div className="prow" key={it.id}>
              <span className="swatch" style={{ background: it.cat.color }} />
              <span className="pt">{it.title}</span>
              <span className="tag" style={{ color: it.role === "Co" ? "var(--ink-soft)" : "var(--ink)" }}>{it.role}</span>
              <span className="tag">due {fmtShort(it.due)}</span>
              <span className="pill" style={{ color: st.c, borderColor: st.c, background: st.c + "16" }}>{st.l}</span>
            </div>
          );
        })}

        {o.done.length > 0 && (
          <>
            <div className="person-sub"><Trophy size={13} style={{ color: "var(--done)" }} /> Concluded</div>
            {o.done.map((it) => (
              <div className="prow" key={it.id}>
                <CheckCircle2 size={14} style={{ color: "var(--done)", flexShrink: 0 }} />
                <span className="pt">{it.title}</span>
                <span className="tag">{it.cat.name}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function People({ data }: { data: Plan }) {
  const owners = ownerView(data);
  const [sel, setSel] = useState("all");
  const [printing, setPrinting] = useState(false);
  const shown = sel === "all" ? owners : owners.filter((o) => o.owner === sel);
  return (
    <>
      <div className="toolbar">
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="all">All people ({owners.length})</option>
          {owners.map((o) => <option key={o.owner} value={o.owner}>{o.owner} — {o.items.length} topics</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setPrinting(true)}>
          <Printer size={14} /> Save {sel === "all" ? "all briefs" : "this brief"} as PDF
        </button>
      </div>
      {owners.length === 0 && <div className="empty">No topics yet — assign owners on the Board.</div>}
      {shown.map((o) => <OwnerCard key={o.owner} o={o} />)}
      {printing && <PersonReport owners={shown} onClose={() => setPrinting(false)} />}
    </>
  );
}
