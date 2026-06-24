"use client";
import React, { useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import type { Item } from "@/lib/types";
import { ownerNames, ownerView } from "@/lib/logic";
import { fmtShort, todayISO } from "@/lib/dates";
import { usePlan } from "./usePlan";
import { ConfirmDialog, ConfirmOptions } from "./ui";
import { Board } from "./board";
import { Overview } from "./overview";
import { Schedule } from "./schedule";
import { CalendarView } from "./calendar";
import { People } from "./people";
import { BoardReport, ManagementReport, PendingReport, PersonReport, exportExcel } from "./reports";
import {
  Gauge, LayoutGrid, GanttChartSquare, CalendarDays, Users, Download, RotateCcw, Clock,
  FileText, AlertTriangle, Sheet, LogOut,
} from "./icons";

type Tab = "overview" | "board" | "schedule" | "calendar" | "people";
type ReportKind = "board" | "mgmt" | "pending" | "people" | null;

export default function TrackerApp({
  userEmail,
  authEnabled = true,
}: {
  userEmail: string | null;
  authEnabled?: boolean;
}) {
  const {
    plan, error, isLoading, busy, toasts, dismissToast,
    mutateItem, createItem, deleteItem, setStart, resetPlan, refresh,
  } = usePlan();

  const [tab, setTab] = useState<Tab>("board");
  const [report, setReport] = useState<ReportKind>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { onCancel?: () => void }) | null>(null);

  const ask = (message: string, onConfirm: () => void, opts: Partial<ConfirmOptions> = {}) =>
    setConfirmState({ message, onConfirm, ...opts });

  const owners = useMemo(() => (plan ? ownerNames(plan) : []), [plan]);

  // ── loading / error gates ──
  if (!plan && isLoading) {
    return (
      <div className="pm">
        <div className="connect-wrap">
          <div className="connect-card" style={{ textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <h1>Operating Plan</h1>
            <div className="connect-sub">Loading the tracker…</div>
          </div>
        </div>
      </div>
    );
  }
  if (!plan && error) {
    return (
      <div className="pm">
        <div className="connect-wrap">
          <div className="connect-card">
            <h1>Operating Plan</h1>
            <div className="connect-sub">Couldn&apos;t load the data</div>
            <p className="connect-text">{String(error.message || error)}</p>
            <div className="connect-actions">
              <button className="btn" onClick={() => refresh()}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!plan) return null;

  const reseed = () => {
    ask(
      "Reset to the original suggested plan? This clears all topics, owners, and notes and rebuilds the template. (Progress history and activity log are kept.)",
      () => resetPlan(),
      { danger: true, confirmLabel: "Reset plan" },
    );
  };
  const onSetStart = (s: string) => {
    ask(
      `Move the whole plan to start on ${fmtShort(s)}? Every start, target and checkpoint date shifts by the same amount. Titles, owners, statuses and notes are kept.`,
      () => setStart(s),
      { confirmLabel: "Shift dates" },
    );
  };

  const downloadData = () => {
    try {
      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tracker-backup-" + todayISO() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 6000);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="pm">
      <datalist id="pm-owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>

      <div className="top">
        <div className="top-in">
          <div className="brand">
            <h1>Operating Plan</h1>
            <span className="sub">Implementation Tracker</span>
            <div className="startbar">
              <span>Plan start</span>
              <input type="date" value={plan.start} onChange={(e) => onSetStart(e.target.value)} />
              <button className="btn ghost" onClick={reseed} title="Reset to suggested plan"><RotateCcw size={12} /> Reset</button>
            </div>
          </div>
          <div className="tabs">
            <button className={`tab${tab === "overview" ? " on" : ""}`} onClick={() => setTab("overview")}><Gauge size={15} /> Overview</button>
            <button className={`tab${tab === "board" ? " on" : ""}`} onClick={() => setTab("board")}><LayoutGrid size={15} /> Board</button>
            <button className={`tab${tab === "schedule" ? " on" : ""}`} onClick={() => setTab("schedule")}><GanttChartSquare size={15} /> Schedule</button>
            <button className={`tab${tab === "calendar" ? " on" : ""}`} onClick={() => setTab("calendar")}><CalendarDays size={15} /> Calendar</button>
            <button className={`tab${tab === "people" ? " on" : ""}`} onClick={() => setTab("people")}><Users size={15} /> People</button>

            <div className="export-wrap no-print" style={{ marginLeft: "auto" }}>
              <button className="tab" onClick={() => setExportOpen((o) => !o)}><Download size={15} /> Export</button>
              {exportOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setExportOpen(false)} />
                  <div className="export-menu">
                    <button onClick={() => { setReport("board"); setExportOpen(false); }}>
                      <LayoutGrid size={17} style={{ marginTop: 1, color: "#b08527", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Board (PDF)</span>
                        <span className="md">The full board — every topic by workstream. Save as PDF.</span>
                      </span>
                    </button>
                    <button onClick={() => { setReport("mgmt"); setExportOpen(false); }}>
                      <FileText size={17} style={{ marginTop: 1, color: "#2f6b5e", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Weekly status report</span>
                        <span className="md">Progress summary for the whole team. Save as PDF.</span>
                      </span>
                    </button>
                    <button onClick={() => { setReport("pending"); setExportOpen(false); }}>
                      <AlertTriangle size={17} style={{ marginTop: 1, color: "#bf3b34", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Pending items report</span>
                        <span className="md">Overdue topics grouped by owner, for the weekly nudge.</span>
                      </span>
                    </button>
                    <button onClick={() => { setReport("people"); setExportOpen(false); }}>
                      <Users size={17} style={{ marginTop: 1, color: "#5b6aa8", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Individual briefs</span>
                        <span className="md">One page per person — scope, done, and what&apos;s next.</span>
                      </span>
                    </button>
                    <button onClick={() => { exportExcel(plan); setExportOpen(false); }}>
                      <Sheet size={17} style={{ marginTop: 1, color: "#3f7d4e", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Excel workbook (.xlsx)</span>
                        <span className="md">All topics, checkpoints, people &amp; activity across tabs.</span>
                      </span>
                    </button>
                    <button onClick={() => { downloadData(); setExportOpen(false); }}>
                      <Download size={17} style={{ marginTop: 1, color: "#1c2533", flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span className="mt">Back up data (.json)</span>
                        <span className="md">Download a copy of all data you can re-import later.</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button className="tab no-print" onClick={() => refresh()} title="Refresh from the server"><RotateCcw size={13} /> Reload</button>
            <span className="saved">
              {busy ? (
                <><span className="dot-sync" /> saving…</>
              ) : (
                <><span className="dot-live" /> live · all changes saved</>
              )}
            </span>
            {authEnabled && (
              <button
                className="tab no-print"
                title={userEmail ? `Signed in as ${userEmail}` : "Sign out"}
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="wrap">
        {tab === "overview" && <Overview data={plan} />}
        {tab === "board" && (
          <Board
            data={plan}
            owners={owners}
            onItemChange={(next: Item) => mutateItem(next)}
            onItemDelete={(id: string) => deleteItem(id)}
            onAddItem={(catId: string, title: string) => createItem(catId, title)}
            ask={ask}
          />
        )}
        {tab === "schedule" && <Schedule data={plan} />}
        {tab === "calendar" && <CalendarView data={plan} />}
        {tab === "people" && <People data={plan} />}
      </div>

      {report === "board" && <BoardReport data={plan} onClose={() => setReport(null)} />}
      {report === "mgmt" && <ManagementReport data={plan} onClose={() => setReport(null)} />}
      {report === "pending" && <PendingReport data={plan} onClose={() => setReport(null)} />}
      {report === "people" && <PersonReport owners={ownerView(plan)} onClose={() => setReport(null)} />}

      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {toasts.length > 0 && (
        <div className="toast-wrap no-print">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.warn ? " warn" : ""}`} onClick={() => dismissToast(t.id)}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
