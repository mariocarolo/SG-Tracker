"use client";
import React, { useRef } from "react";
import * as XLSX from "xlsx";
import type { Plan } from "@/lib/types";
import { STATUSES } from "@/lib/plan-template";
import {
  pctOf, weightedPct, healthOf, healthReason, assignLabel, RAG, ownerView, OwnerSummary,
} from "@/lib/logic";
import { fmt, fmtShort, fmtDT, dayDiff, dayGap, todayISO, addDays, parse, iso } from "@/lib/dates";
import { Download, X, LayoutGrid, FileText, AlertCircle, AlertTriangle, Users, CheckCircle2 } from "./icons";

/* ---- self-contained print/PDF export ---- */
function collectStyles(): string {
  let out = "";
  document.querySelectorAll("style").forEach((s) => { out += `<style>${s.textContent || ""}</style>`; });
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    out += `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`;
  });
  return out;
}

export function exportReport(node: HTMLElement | null, title: string) {
  if (!node) return;
  const safe = (title || "report").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const s = "scr" + "ipt";
  const doc =
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${collectStyles()}</head>` +
    `<body class="pm" style="background:#fff;padding:24px;">` +
    `<div class="no-print" style="max-width:760px;margin:0 auto 16px;"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>` +
    node.innerHTML +
    `<${s}>addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},500);});</${s}>` +
    `</body></html>`;
  try {
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = safe + ".html";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch (e) { console.error("export failed", e); }
}

/* ---- multi-sheet Excel export ---- */
export function exportExcel(data: Plan) {
  try {
    const today = todayISO();
    const all = data.cats.flatMap((c) => c.items.map((it) => ({ ...it, cat: c })));
    const stL = (v: string) => (STATUSES.find((s) => s.v === v) || ({} as any)).l || v;
    const cpDone = (it: any) => it.checkpoints.filter((c: any) => c.done).length;
    const overdueCp = (it: any) => it.checkpoints.filter((c: any) => !c.done && c.date < today).length;
    const setZ = (ws: any, r: number, c: number, z: string) => { const a = XLSX.utils.encode_cell({ r, c }); if (ws[a]) ws[a].z = z; };
    const fmtPctCol = (ws: any, col: number, rows: number) => { for (let r = 1; r <= rows; r++) setZ(ws, r, col, "0%"); };

    const total = all.length;
    const done = all.filter((it) => it.status === "done").length;
    const prog = all.filter((it) => it.status === "in_progress").length;
    const overall = weightedPct(all);
    const rag: Record<string, number> = { green: 0, amber: 0, red: 0 };
    all.forEach((it) => rag[healthOf(it)]++);

    const sAoa: any[][] = [];
    sAoa.push(["Operating Plan — Implementation Tracker"]);
    sAoa.push(["Generated", fmt(today)]);
    sAoa.push(["Plan start", fmt(data.start)]);
    sAoa.push([]);
    const overallRow = sAoa.length; sAoa.push(["Overall progress", overall / 100]);
    sAoa.push(["Topics complete", `${done} / ${total}`]);
    sAoa.push(["In progress", prog]);
    sAoa.push(["Off track (Red)", rag.red]);
    sAoa.push(["At risk (Amber)", rag.amber]);
    sAoa.push(["On track (Green)", rag.green]);
    sAoa.push([]);
    sAoa.push(["Progress by workstream"]);
    sAoa.push(["Workstream", "Progress", "Done", "Total"]);
    const wsStart = sAoa.length;
    data.cats.forEach((c) => sAoa.push([c.name, weightedPct(c.items) / 100, c.items.filter((it) => it.status === "done").length, c.items.length]));
    sAoa.push([]);
    sAoa.push(["Accomplishments by phase"]);
    sAoa.push(["Phase", "Done", "Open", "Completion"]);
    const prioStart = sAoa.length;
    [1, 2, 3].forEach((ph) => { const items = all.filter((it) => it.phase === ph); const d = items.filter((it) => it.status === "done").length; sAoa.push(["Phase " + ph, d, items.length - d, items.length ? d / items.length : 0]); });
    const wsS = XLSX.utils.aoa_to_sheet(sAoa);
    wsS["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    setZ(wsS, overallRow, 1, "0%");
    for (let i = 0; i < data.cats.length; i++) setZ(wsS, wsStart + i, 1, "0%");
    for (let i = 0; i < 3; i++) setZ(wsS, prioStart + i, 3, "0%");

    const tHead = ["Workstream", "Topic", "PIC", "Co-responsible", "Status", "Health", "Phase", "Progress", "Start", "Target date", "Completed", "Checkpoints", "Overdue", "Notes"];
    const tRows = all.map((it) => [
      it.cat.name, it.title, it.owner || "", it.owner2 || "", stL(it.status),
      RAG[healthOf(it)].l + (it.health && it.health !== "auto" ? " (manual)" : ""),
      it.phase, pctOf(it) / 100, fmt(it.start), fmt(it.due),
      it.status === "done" && it.completedAt ? fmt(it.completedAt) : "",
      `${cpDone(it)} / ${it.checkpoints.length}`, overdueCp(it), it.notes ? it.notes.length : 0,
    ]);
    const wsT = XLSX.utils.aoa_to_sheet([tHead, ...tRows]);
    wsT["!cols"] = [{ wch: 26 }, { wch: 50 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 19 }, { wch: 6 }, { wch: 9 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 7 }];
    fmtPctCol(wsT, 7, tRows.length);
    wsT["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: tRows.length, c: tHead.length - 1 } }) };

    const cHead = ["Workstream", "Topic", "Assignees", "Checkpoint", "Date", "Status", "Days late"];
    const cRows: any[][] = [];
    all.forEach((it) => it.checkpoints.forEach((cp) => cRows.push([
      it.cat.name, it.title, assignLabel(it), cp.label, fmt(cp.date),
      cp.done ? "Done" : (cp.date < today ? "Overdue" : "Pending"),
      !cp.done && cp.date < today ? dayGap(cp.date, today) : "",
    ])));
    const wsC = XLSX.utils.aoa_to_sheet([cHead, ...cRows]);
    wsC["!cols"] = [{ wch: 26 }, { wch: 46 }, { wch: 16 }, { wch: 34 }, { wch: 15 }, { wch: 10 }, { wch: 9 }];
    wsC["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: cRows.length, c: cHead.length - 1 } }) };

    const pHead = ["Person", "Topics", "Concluded", "Open", "Progress", "Overdue"];
    const pRows = ownerView(data).map((o) => [o.owner, o.items.length, o.done.length, o.open.length, o.prog / 100, o.overdue.length]);
    const wsP = XLSX.utils.aoa_to_sheet([pHead, ...pRows]);
    wsP["!cols"] = [{ wch: 22 }, { wch: 9 }, { wch: 11 }, { wch: 8 }, { wch: 10 }, { wch: 9 }];
    fmtPctCol(wsP, 4, pRows.length);

    const aHead = ["When", "Change", "By"];
    const aRows = (data.activity || []).slice().reverse().map((a) => [fmtDT(a.ts), a.msg, a.actor || ""]);
    const wsA = XLSX.utils.aoa_to_sheet([aHead, ...aRows]);
    wsA["!cols"] = [{ wch: 20 }, { wch: 80 }, { wch: 24 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsS, "Summary");
    XLSX.utils.book_append_sheet(wb, wsT, "Topics");
    XLSX.utils.book_append_sheet(wb, wsC, "Checkpoints");
    XLSX.utils.book_append_sheet(wb, wsP, "People");
    XLSX.utils.book_append_sheet(wb, wsA, "Activity");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Operating-Plan-${today}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch (e) { console.error("excel export failed", e); }
}

function ReportShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="report-overlay" role="dialog" aria-modal="true">
      <div className="report-toolbar no-print">
        <button className="btn btn-light" onClick={() => exportReport(ref.current, title)}><Download size={14} /> Download / Print PDF</button>
        <span className="sp" />
        <button className="btn btn-light" onClick={onClose}><X size={14} /> Close</button>
      </div>
      <div ref={ref}><div className="report-sheet">{children}</div></div>
      <div className="report-toolbar no-print" style={{ marginTop: 14, justifyContent: "center", color: "#fff", fontSize: 12 }}>
        Downloads an HTML file that opens ready to print — choose “Save as PDF” as the destination.
      </div>
    </div>
  );
}

export function BoardReport({ data, onClose }: { data: Plan; onClose: () => void }) {
  const today = todayISO();
  const stL = (v: string) => (STATUSES.find((s) => s.v === v) || ({} as any)).l || v;
  const totalTopics = data.cats.reduce((a, c) => a + c.items.length, 0);
  return (
    <ReportShell title="Board" onClose={onClose}>
      <div className="rp-eyebrow">Operating Plan · Board</div>
      <div className="rp-title">Implementation Board</div>
      <div className="rp-meta">Generated {fmt(today)} · Plan start {fmt(data.start)} · {totalTopics} topics across {data.cats.length} workstreams</div>
      <div className="rp-rule" />
      {data.cats.map((c) => (
        <div className="rp-ws-block" key={c.id} style={{ breakInside: "avoid" }}>
          <div className="rp-h">
            <span className="swatch" style={{ background: c.color, display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 8, verticalAlign: 1 }} />
            {c.name}
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", fontWeight: 400, marginLeft: 8 }}>
              {weightedPct(c.items)}% · {c.items.filter((it) => it.status === "done").length}/{c.items.length} done
            </span>
          </div>
          {c.items.length === 0 ? (
            <div className="rp-empty">No topics.</div>
          ) : (
            c.items.map((it) => {
              const h = healthOf(it);
              return (
                <div className="rp-li" key={it.id}>
                  <span className="rag-dot" style={{ background: RAG[h].c, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{it.title}</span>
                  <span className="tag">{assignLabel(it)}</span>
                  <span className="tag">Ph {it.phase} · {pctOf(it)}%</span>
                  <span className="tag">{stL(it.status)} · {it.status === "done" && it.completedAt ? "done " + fmtShort(it.completedAt) : "due " + fmtShort(it.due)}</span>
                </div>
              );
            })
          )}
        </div>
      ))}
      <div className="rp-foot">Operating Plan board · {fmt(today)}</div>
    </ReportShell>
  );
}

export function ManagementReport({ data, onClose }: { data: Plan; onClose: () => void }) {
  const today = todayISO();
  const all = data.cats.flatMap((c) => c.items.map((it) => ({ ...it, cat: c })));
  const total = all.length;
  const done = all.filter((it) => it.status === "done").length;
  const prog = all.filter((it) => it.status === "in_progress").length;
  const blocked = all.filter((it) => it.status === "blocked");
  const overall = weightedPct(all);
  const overdueCount = all.reduce((a, it) => a + it.checkpoints.filter((cp) => !cp.done && cp.date < today).length, 0);
  const inFocus = all.filter((it) => it.status === "in_progress");
  const upcoming = all.flatMap((it) => it.checkpoints
    .filter((cp) => !cp.done && cp.date >= today && dayDiff(today, cp.date) <= 14)
    .map((cp) => ({ date: cp.date, label: cp.label, topic: it.title, owner: assignLabel(it) })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const hist = (data.history || []).filter((h) => h.total > 0);
  const prevSnap = hist.length >= 2 ? hist[hist.length - 2] : null;
  const delta = prevSnap ? overall - prevSnap.overall : null;
  const ragList = all.map((it) => ({ it, h: healthOf(it) }));
  const rag: Record<string, number> = { green: 0, amber: 0, red: 0 };
  ragList.forEach((r) => rag[r.h]++);
  const ragAttention = ragList.filter((r) => r.h !== "green").sort((a, b) => (a.h === "red" ? 0 : 1) - (b.h === "red" ? 0 : 1));
  const cutoff = iso(addDays(parse(today), -7));
  const changes = (data.activity || []).filter((a) => a.ts.slice(0, 10) >= cutoff).slice().reverse();

  return (
    <ReportShell title="Weekly status report" onClose={onClose}>
      <div className="rp-eyebrow">Operating Plan · Weekly Status</div>
      <div className="rp-title">Implementation Status Report</div>
      <div className="rp-meta">Generated {fmt(today)} · Plan start {fmt(data.start)} · {total} topics across {data.cats.length} workstreams</div>
      {delta !== null && (
        <div className="rp-meta" style={{ marginTop: 4, color: delta > 0 ? "var(--done)" : delta < 0 ? "var(--block)" : "var(--ink-soft)", fontWeight: 600 }}>
          {delta > 0 ? `Up ${delta} pts` : delta < 0 ? `Down ${Math.abs(delta)} pts` : "No change"} vs last week (was {prevSnap!.overall}%)
        </div>
      )}
      <div className="rp-rule" />

      <div className="rp-kpis">
        <div className="rp-kpi"><div className="n">{overall}%</div><div className="l">Overall progress</div></div>
        <div className="rp-kpi"><div className="n">{done}/{total}</div><div className="l">Topics complete</div></div>
        <div className="rp-kpi"><div className="n">{prog}</div><div className="l">In progress</div></div>
        <div className="rp-kpi"><div className="n" style={{ color: overdueCount ? "var(--block)" : "var(--ink)" }}>{overdueCount}</div><div className="l">Overdue checkpoints</div></div>
      </div>

      <div className="rp-h">Progress by workstream</div>
      {data.cats.map((c) => {
        const p = weightedPct(c.items);
        const d = c.items.filter((it) => it.status === "done").length;
        return (
          <div className="rp-ws" key={c.id}>
            <span className="swatch" style={{ background: c.color }} />
            <span className="nm">{c.name}</span>
            <div className="bar" style={{ width: 150, flex: "none" }}><i style={{ width: `${p}%`, background: c.color }} /></div>
            <span className="ct">{p}% · {d}/{c.items.length} done</span>
          </div>
        );
      })}

      <div className="rp-h">Health (RAG)</div>
      <div className="rag-counts" style={{ marginBottom: 4 }}>
        {(["red", "amber", "green"] as const).map((k) => (
          <span key={k} className="rag-count"><span className="rag-dot" style={{ background: RAG[k].c }} /> <b>{rag[k]}</b> {RAG[k].l}</span>
        ))}
      </div>
      {ragAttention.length === 0 ? (
        <div className="rp-empty">Everything is on track.</div>
      ) : (
        ragAttention.map(({ it, h }) => (
          <div className="rp-li" key={it.id}>
            <span className="rag-dot" style={{ background: RAG[h].c, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{it.title}</span>
            <span className="tag">{healthReason(it)}</span>
            <span className="tag">{assignLabel(it)}</span>
          </div>
        ))
      )}

      <div className="rp-h">Changes since last week</div>
      {changes.length === 0 ? (
        <div className="rp-empty">No tracked changes in the past 7 days.</div>
      ) : (
        <>
          {changes.slice(0, 40).map((a) => (
            <div className="rp-li" key={a.id}>
              <span className="tag" style={{ width: 64 }}>{fmtShort(a.ts.slice(0, 10))}</span>
              <span style={{ flex: 1 }}>{a.msg}</span>
            </div>
          ))}
          {changes.length > 40 && <div className="rp-li"><span className="tag">+{changes.length - 40} more changes</span></div>}
        </>
      )}

      <div className="rp-h">In focus this week</div>
      {inFocus.length === 0 && <div className="rp-empty">No topics currently marked in progress.</div>}
      {inFocus.map((it) => (
        <div className="rp-li" key={it.id}>
          <span style={{ flex: 1 }}>{it.title}</span>
          <span className="tag">{assignLabel(it)} · {pctOf(it)}% · due {fmtShort(it.due)}</span>
        </div>
      ))}

      {blocked.length > 0 && (
        <>
          <div className="rp-h">Blocked — needs attention</div>
          {blocked.map((it) => (
            <div className="rp-li" key={it.id}>
              <AlertCircle size={14} style={{ color: "var(--block)" }} />
              <span style={{ flex: 1 }}>{it.title}</span>
              <span className="tag">{assignLabel(it)}</span>
            </div>
          ))}
        </>
      )}

      <div className="rp-h">Upcoming checkpoints (next 14 days)</div>
      {upcoming.length === 0 && <div className="rp-empty">Nothing due in the next two weeks.</div>}
      {upcoming.map((u, i) => (
        <div className="rp-li" key={i}>
          <span className="tag" style={{ width: 64 }}>{fmtShort(u.date)}</span>
          <span style={{ flex: 1 }}>{u.label}</span>
          <span className="tag">{u.topic} · {u.owner || "unassigned"}</span>
        </div>
      ))}

      <div className="rp-foot">Operating Plan implementation tracker · confidential · {fmt(today)}</div>
    </ReportShell>
  );
}

export function PendingReport({ data, onClose }: { data: Plan; onClose: () => void }) {
  const today = todayISO();
  const all = data.cats.flatMap((c) => c.items.map((it) => ({ ...it, cat: c })));

  const rows = all.flatMap((it) =>
    it.checkpoints.filter((cp) => !cp.done && cp.date < today).map((cp) => ({
      owner: assignLabel(it), topic: it.title, ws: it.cat.name, label: cp.label, date: cp.date, late: dayDiff(cp.date, today),
    })),
  );
  all.forEach((it) => {
    if (it.checkpoints.length === 0 && it.status !== "done" && it.due < today) {
      rows.push({ owner: assignLabel(it), topic: it.title, ws: it.cat.name, label: "Target date passed", date: it.due, late: dayDiff(it.due, today) });
    }
  });

  const byOwner: Record<string, typeof rows> = {};
  rows.forEach((r) => { (byOwner[r.owner] = byOwner[r.owner] || []).push(r); });
  const owners = Object.keys(byOwner).sort((a, b) => byOwner[b].length - byOwner[a].length);
  owners.forEach((o) => byOwner[o].sort((a, b) => b.late - a.late));

  const dueSoon = all.flatMap((it) => it.checkpoints
    .filter((cp) => !cp.done && cp.date >= today && dayDiff(today, cp.date) <= 7)
    .map((cp) => ({ date: cp.date, label: cp.label, topic: it.title, owner: assignLabel(it) })))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ReportShell title="Pending items report" onClose={onClose}>
      <div className="rp-eyebrow">Operating Plan · Weekly Follow-up</div>
      <div className="rp-title">Pending &amp; Overdue Items</div>
      <div className="rp-meta">Generated {fmt(today)} · {rows.length} overdue item{rows.length === 1 ? "" : "s"} across {owners.length} owner{owners.length === 1 ? "" : "s"}</div>
      <div className="rp-rule" />

      {rows.length === 0 && <div className="rp-empty" style={{ padding: 36 }}>Nothing overdue — every checkpoint is on or ahead of schedule.</div>}

      {owners.map((o) => (
        <div key={o}>
          <div className="rp-owner">
            <Users size={15} />
            <span className="who">{o}</span>
            <span className="cnt">{byOwner[o].length} overdue</span>
          </div>
          {byOwner[o].map((r, i) => (
            <div className="rp-li" key={i}>
              <span style={{ flex: 1 }}>{r.label} <span className="tag">— {r.topic}</span></span>
              <span className="tag">{r.ws}</span>
              <span className="rp-late" style={{ width: 86, textAlign: "right" }}>{r.late}d late · {fmtShort(r.date)}</span>
            </div>
          ))}
          <p className="rp-nudge">Please update these items or flag any blocker before the next process meeting.</p>
        </div>
      ))}

      {dueSoon.length > 0 && (
        <>
          <div className="rp-h">Due within 7 days — heads up</div>
          {dueSoon.map((u, i) => (
            <div className="rp-li" key={i}>
              <span className="tag" style={{ width: 64 }}>{fmtShort(u.date)}</span>
              <span style={{ flex: 1 }}>{u.label}</span>
              <span className="tag">{u.topic} · {u.owner}</span>
            </div>
          ))}
        </>
      )}

      <div className="rp-foot">Send the section above to each owner, or review together at the weekly meeting · {fmt(today)}</div>
    </ReportShell>
  );
}

export function PersonReport({ owners, onClose }: { owners: OwnerSummary[]; onClose: () => void }) {
  const today = todayISO();
  const ref = useRef<HTMLDivElement>(null);
  const fname = owners.length === 1 ? `Brief — ${owners[0].owner}` : "Individual briefs";
  return (
    <div className="report-overlay" role="dialog" aria-modal="true">
      <div className="report-toolbar no-print">
        <button className="btn btn-light" onClick={() => exportReport(ref.current, fname)}><Download size={14} /> Download / Print PDF</button>
        <span className="sp" />
        <button className="btn btn-light" onClick={onClose}><X size={14} /> Close</button>
      </div>
      <div ref={ref}>
        {owners.map((o, idx) => (
          <div className="report-sheet" key={o.owner} style={{ marginTop: idx > 0 ? 22 : 0, pageBreakBefore: idx > 0 ? "always" : "auto" }}>
            <div className="rp-eyebrow">Operating Plan · Individual Scope</div>
            <div className="rp-title">{o.owner}</div>
            <div className="rp-meta">Generated {fmt(today)} · {o.items.length} topics · {o.done.length} concluded · {o.open.length} open</div>
            <div className="rp-rule" />
            <div className="rp-kpis">
              <div className="rp-kpi"><div className="n">{o.items.length}</div><div className="l">In scope</div></div>
              <div className="rp-kpi"><div className="n" style={{ color: "var(--done)" }}>{o.done.length}</div><div className="l">Concluded</div></div>
              <div className="rp-kpi"><div className="n">{o.prog}%</div><div className="l">Progress</div></div>
              <div className="rp-kpi"><div className="n" style={{ color: o.overdue.length ? "var(--block)" : "var(--ink)" }}>{o.overdue.length}</div><div className="l">Overdue</div></div>
            </div>

            {o.overdue.length > 0 && (
              <>
                <div className="rp-h">Overdue — needs action</div>
                {o.overdue.map((cp, i) => (
                  <div className="rp-li" key={i}>
                    <span style={{ flex: 1 }}>{cp.label} <span className="tag">— {cp.topic}</span></span>
                    <span className="rp-late" style={{ width: 96, textAlign: "right" }}>{cp.late}d late · {fmtShort(cp.date)}</span>
                  </div>
                ))}
              </>
            )}

            <div className="rp-h">Attention next (per schedule)</div>
            {o.upcoming.length === 0 ? (
              <div className="rp-empty">No upcoming checkpoints scheduled.</div>
            ) : (
              o.upcoming.slice(0, 8).map((cp, i) => (
                <div className="rp-li" key={i}>
                  <span className="tag" style={{ width: 64 }}>{fmtShort(cp.date)}</span>
                  <span style={{ flex: 1 }}>{cp.label}</span>
                  <span className="tag">{cp.topic}</span>
                </div>
              ))
            )}

            <div className="rp-h">Full scope</div>
            {o.items.map((it) => {
              const st = STATUSES.find((s) => s.v === it.status)!;
              return (
                <div className="rp-li" key={it.id}>
                  <span style={{ flex: 1 }}>{it.title}</span>
                  <span className="tag">{it.role}</span>
                  <span className="tag">{it.cat.name}</span>
                  <span className="tag" style={{ width: 116, textAlign: "right" }}>{st.l} · due {fmtShort(it.due)}</span>
                </div>
              );
            })}

            {o.done.length > 0 && (
              <>
                <div className="rp-h">Concluded</div>
                {o.done.map((it) => (
                  <div className="rp-li" key={it.id}>
                    <CheckCircle2 size={13} style={{ color: "var(--done)", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{it.title}</span>
                    <span className="tag">{it.cat.name}</span>
                  </div>
                ))}
              </>
            )}

            <div className="rp-foot">Operating Plan · {o.owner} · {fmt(today)}</div>
          </div>
        ))}
      </div>
      {owners.length > 1 && (
        <div className="report-toolbar no-print" style={{ marginTop: 14, justifyContent: "center", color: "#fff", fontSize: 12 }}>
          {owners.length} individual briefs — each prints on its own page, so you can send each person theirs.
        </div>
      )}
    </div>
  );
}
