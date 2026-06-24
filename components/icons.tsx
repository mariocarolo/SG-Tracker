import React from "react";

// Inline-SVG icons (drop-in replacements for lucide-react), ported from the
// original tracker so the look stays identical with zero icon dependencies.
type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

const mkIcon = (inner: React.ReactNode) =>
  function Icon({ size = 16, color, style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color || "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      >
        {inner}
      </svg>
    );
  };

export const CheckCircle2 = mkIcon(<><circle cx="12" cy="12" r="9" /><path d="M8.5 12.4l2.4 2.4 4.6-5" /></>);
export const Circle = mkIcon(<circle cx="12" cy="12" r="9" />);
export const Plus = mkIcon(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
export const Trash2 = mkIcon(<><polyline points="3 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></>);
export const ChevronDown = mkIcon(<polyline points="6 9 12 15 18 9" />);
export const ChevronRight = mkIcon(<polyline points="9 6 15 12 9 18" />);
export const ChevronLeft = mkIcon(<polyline points="15 6 9 12 15 18" />);
export const Calendar = mkIcon(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>);
export const CalendarDays = mkIcon(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="13" x2="8.01" y2="13" /><line x1="12" y1="13" x2="12.01" y2="13" /><line x1="16" y1="13" x2="16.01" y2="13" /></>);
export const User = mkIcon(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>);
export const Users = mkIcon(<><circle cx="9" cy="8" r="3.5" /><path d="M3 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M21 21v-1a5 5 0 0 0-3.5-4.8" /></>);
export const StickyNote = mkIcon(<><path d="M4 4h16v10l-6 6H4z" /><path d="M14 20v-6h6" /></>);
export const X = mkIcon(<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>);
export const LayoutGrid = mkIcon(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const GanttChartSquare = mkIcon(<><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="7" y1="8" x2="13" y2="8" /><line x1="7" y1="12" x2="16" y2="12" /><line x1="7" y1="16" x2="11" y2="16" /></>);
export const Gauge = mkIcon(<><path d="M4 18a8 8 0 1 1 16 0" /><line x1="12" y1="15" x2="16" y2="10" /></>);
export const Search = mkIcon(<><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>);
export const RotateCcw = mkIcon(<><path d="M4 12a8 8 0 1 0 2.5-5.8L3 9" /><polyline points="3 4 3 9 8 9" /></>);
export const Clock = mkIcon(<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>);
export const AlertCircle = mkIcon(<><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
export const AlertTriangle = mkIcon(<><path d="M12 3l9.5 17H2.5z" /><line x1="12" y1="9" x2="12" y2="14" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
export const FileText = mkIcon(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>);
export const Printer = mkIcon(<><polyline points="6 9 6 3 18 3 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></>);
export const Download = mkIcon(<><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><line x1="4" y1="21" x2="20" y2="21" /></>);
export const Trophy = mkIcon(<><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3" /><path d="M17 6h3v1a3 3 0 0 1-3 3" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="10" y1="18" x2="14" y2="18" /></>);
export const Sheet = mkIcon(<><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></>);
export const LogOut = mkIcon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);
