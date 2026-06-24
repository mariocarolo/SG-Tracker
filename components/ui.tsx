"use client";
import React from "react";

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="sec-prog" style={{ minWidth: 0, flex: "none" }}>
      <div className="bar" style={{ width: 90 }}>
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="pct">{pct}%</span>
    </div>
  );
}

export interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onCancel: () => void }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-msg">{message}</div>
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn"
            style={danger ? { background: "var(--block)" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
