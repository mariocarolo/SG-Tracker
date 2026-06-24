"use client";
import React, { useState } from "react";
import type { Item, Plan } from "@/lib/types";
import { STATUSES } from "@/lib/plan-template";
import { pctOf, healthOf, healthReason, autoHealth, assignLabel, weightedPct, RAG } from "@/lib/logic";
import { fmtShort, todayISO, uid } from "@/lib/dates";
import type { ConfirmOptions } from "./ui";
import { ProgressBar } from "./ui";
import {
  ChevronDown, ChevronRight, User, Calendar, CheckCircle2, Circle, Trash2,
  GanttChartSquare, StickyNote, Plus, X, Search,
} from "./icons";

type Ask = (message: string, onConfirm: () => void, opts?: Partial<ConfirmOptions>) => void;

function Initiative({
  item, color, onChange, onDelete, ask,
}: {
  item: Item;
  color: string;
  onChange: (next: Item, immediate?: boolean) => void;
  onDelete: () => void;
  ask: Ask;
}) {
  const [open, setOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const pct = pctOf(item);
  const st = STATUSES.find((s) => s.v === item.status)!;
  const health = healthOf(item);
  const rg = RAG[health];

  // immediate=true → save right away (discrete actions); false → debounced (typing)
  const set = (patch: Partial<Item>, immediate = false) => onChange({ ...item, ...patch }, immediate);
  const setCp = (cid: string, patch: any, immediate = false) =>
    set({ checkpoints: item.checkpoints.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }, immediate);
  const changeStatus = (v: string) => {
    const patch: Partial<Item> = { status: v as Item["status"] };
    if (v === "done" && !item.completedAt) patch.completedAt = todayISO();
    if (v !== "done" && item.completedAt) patch.completedAt = null;
    set(patch, true);
  };
  const addNote = () => {
    const t = noteDraft.trim();
    if (!t) return;
    set({ notes: [...item.notes, { id: uid(), text: t, date: todayISO() }] }, true);
    setNoteDraft("");
  };

  return (
    <div className="init">
      <div className="init-head" onClick={() => setOpen((o) => !o)}>
        <span className="chev">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="init-title">{item.title}</div>
          <div className="init-sub">
            <span><User size={11} style={{ verticalAlign: -1 }} /> {assignLabel(item)}</span>
            {item.status === "done" && item.completedAt ? (
              <span style={{ color: "var(--done)" }}><CheckCircle2 size={11} style={{ verticalAlign: -1 }} /> done {fmtShort(item.completedAt)}</span>
            ) : (
              <span><Calendar size={11} style={{ verticalAlign: -1 }} /> due {fmtShort(item.due)}</span>
            )}
            <span>Phase {item.phase}</span>
          </div>
        </div>
        <span
          className="rag-dot"
          style={{ background: rg.c }}
          title={`Health: ${rg.l}${item.status !== "done" && health !== "green" ? " — " + healthReason(item) : ""}${item.health && item.health !== "auto" ? " (manual)" : ""}`}
        />
        <div className="bar mini-bar"><i style={{ width: `${pct}%`, background: color }} /></div>
        <span className="pill" style={{ color: st.c, borderColor: st.c, background: st.c + "16" }}>{st.l}</span>
        <button
          className="icon-btn"
          title="Delete initiative"
          onClick={(e) => {
            e.stopPropagation();
            ask(`Delete “${item.title}”? This can't be undone.`, onDelete, { danger: true, confirmLabel: "Delete" });
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="detail" onClick={(e) => e.stopPropagation()}>
          <div className="field-row">
            <div className="field">
              <label>Person in charge (PIC)</label>
              <input list="pm-owners" value={item.owner} placeholder="Assign PIC…" onChange={(e) => set({ owner: e.target.value })} />
            </div>
            <div className="field">
              <label>Co-responsible</label>
              <input list="pm-owners" value={item.owner2 || ""} placeholder="Optional…" onChange={(e) => set({ owner2: e.target.value })} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={item.status} onChange={(e) => changeStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Health (RAG)</label>
              <select value={item.health || "auto"} onChange={(e) => set({ health: e.target.value as Item["health"] }, true)}>
                <option value="auto">Auto · {RAG[autoHealth(item)].l}</option>
                <option value="green">Green · on track</option>
                <option value="amber">Amber · at risk</option>
                <option value="red">Red · off track</option>
              </select>
            </div>
            <div className="field">
              <label>Phase</label>
              <select value={item.phase} onChange={(e) => set({ phase: Number(e.target.value) }, true)}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>Phase {n}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Start</label>
              <input type="date" value={item.start} onChange={(e) => set({ start: e.target.value }, true)} />
            </div>
            <div className="field">
              <label>Target date</label>
              <input type="date" value={item.due} onChange={(e) => set({ due: e.target.value }, true)} />
            </div>
          </div>

          <div className="col-title">
            <GanttChartSquare size={13} /> Checkpoints — {item.checkpoints.filter((c) => c.done).length}/{item.checkpoints.length} complete
          </div>
          {item.checkpoints.map((c) => (
            <div className={`cp${c.done ? " done" : ""}`} key={c.id}>
              <button className={`cp-check${c.done ? " done" : ""}`} onClick={() => setCp(c.id, { done: !c.done }, true)}>
                {c.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              <input className="cp-label" value={c.label} onChange={(e) => setCp(c.id, { label: e.target.value })} />
              <input className="cp-date" type="date" value={c.date} onChange={(e) => setCp(c.id, { date: e.target.value }, true)} />
              <button className="icon-btn" onClick={() => set({ checkpoints: item.checkpoints.filter((x) => x.id !== c.id) }, true)}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="add-row">
            <button
              className="btn ghost"
              onClick={() => set({ checkpoints: [...item.checkpoints, { id: uid(), label: "New checkpoint", date: item.due, done: false }] }, true)}
            >
              <Plus size={13} /> Add checkpoint
            </button>
          </div>

          <div className="col-title"><StickyNote size={13} /> Points &amp; notes</div>
          {item.notes.map((n) => (
            <div className="note" key={n.id}>
              <p>{n.text}<br /><span className="stamp">{fmtShort(n.date)}</span></p>
              <button className="icon-btn" onClick={() => set({ notes: item.notes.filter((x) => x.id !== n.id) }, true)}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="add-row">
            <textarea
              rows={1}
              value={noteDraft}
              placeholder="Add a point to this topic…"
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
            />
            <button className="btn" onClick={addNote}><Plus size={13} /> Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Board({
  data, owners, onItemChange, onItemDelete, onAddItem, ask,
}: {
  data: Plan;
  owners: string[];
  onItemChange: (next: Item, immediate?: boolean) => void;
  onItemDelete: (id: string) => void;
  onAddItem: (categoryId: string, title: string) => void;
  ask: Ask;
}) {
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fOwner, setFOwner] = useState("all");
  const [adding, setAdding] = useState<Record<string, string>>({});

  const matches = (it: Item) =>
    (q === "" || it.title.toLowerCase().includes(q.toLowerCase()) || assignLabel(it).toLowerCase().includes(q.toLowerCase())) &&
    (fStatus === "all" || it.status === fStatus) &&
    (fOwner === "all" || it.owner === fOwner || it.owner2 === fOwner);

  const addInit = (catId: string) => {
    const t = (adding[catId] || "").trim();
    if (!t) return;
    onAddItem(catId, t);
    setAdding({ ...adding, [catId]: "" });
  };

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Search size={15} color="#9aa0a6" />
          <input placeholder="Search topics or owners…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <select value={fOwner} onChange={(e) => setFOwner(e.target.value)}>
          <option value="all">All owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {data.cats.map((cat) => {
        const visible = cat.items.filter(matches);
        const pct = weightedPct(cat.items);
        return (
          <div className="sec" key={cat.id}>
            <div className="sec-head">
              <span className="sec-bar" style={{ background: cat.color }} />
              <h2>{cat.name}</h2>
              <span className="meta">{cat.items.length} topics</span>
              <ProgressBar pct={pct} color={cat.color} />
            </div>
            <div className="card">
              {visible.length === 0 && <div className="empty">No topics match the current filters.</div>}
              {visible.map((it) => (
                <Initiative
                  key={it.id}
                  item={it}
                  color={cat.color}
                  ask={ask}
                  onChange={onItemChange}
                  onDelete={() => onItemDelete(it.id)}
                />
              ))}
              <div className="add-init">
                <input
                  placeholder="Add a new topic to this workstream…"
                  value={adding[cat.id] || ""}
                  onChange={(e) => setAdding({ ...adding, [cat.id]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") addInit(cat.id); }}
                />
                <button className="btn" onClick={() => addInit(cat.id)}><Plus size={13} /> Add topic</button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
