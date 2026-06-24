import { addDays, addMonths, iso, parse, uid } from "./dates";
import type { Category, Status, Priority, Health, Plan } from "./types";

export const PHASE_LEN = 3; // months per phase

export const STATUSES: { v: Status; l: string; c: string }[] = [
  { v: "not_started", l: "Not started", c: "var(--idle)" },
  { v: "in_progress", l: "In progress", c: "var(--prog)" },
  { v: "blocked", l: "Blocked", c: "var(--block)" },
  { v: "done", l: "Done", c: "var(--done)" },
];

export const PRIORITIES: { v: Priority; l: string; c: string }[] = [
  { v: "high", l: "High", c: "#bf3b34" },
  { v: "med", l: "Medium", c: "#c0892b" },
  { v: "low", l: "Low", c: "#9aa0a6" },
];

export const RAG: Record<"green" | "amber" | "red", { l: string; c: string }> = {
  green: { l: "On track", c: "#3f7d4e" },
  amber: { l: "At risk", c: "#c0892b" },
  red: { l: "Off track", c: "#bf3b34" },
};

// The seed plan — the original suggested operating plan, used by buildSeed and Reset.
type SeedItem = { t: string; ph: number; pr: Priority; cps: string[] };
type SeedCat = { name: string; color: string; items: SeedItem[] };

export const CATS: SeedCat[] = [
  { name: "Team & Culture", color: "#c2683a", items: [
    { t: "Reestablish the weekly process meeting", ph: 1, pr: "high", cps: ["Define agenda, owner & cadence", "Hold first weekly meeting", "30-day cadence review"] },
    { t: "Introduce a dedicated AI projects best-practices & status meeting", ph: 1, pr: "high", cps: ["Set format & invite list", "Run first session", "Capture best-practices doc"] },
    { t: "Upgrade office environment and furniture", ph: 2, pr: "med", cps: ["Assess needs & budget", "Order furniture / fit-out", "Complete installation"] },
    { t: "Improve audio infrastructure for video conferences", ph: 1, pr: "high", cps: ["Audit current AV gaps", "Procure equipment", "Install & test all rooms"] },
    { t: "Define and communicate clear roles for all team members", ph: 1, pr: "high", cps: ["Draft role descriptions", "Review with team", "Publish & communicate"] },
    { t: "CC to individually coach each team member", ph: 2, pr: "med", cps: ["Schedule 1:1 cadence", "First coaching round", "Quarterly progress review"] },
    { t: "Schedule an offsite & implement a recurring culture meeting", ph: 2, pr: "med", cps: ["Pick date & venue", "Run offsite", "Launch recurring culture meeting"] },
    { t: "Deliver two to three HBS case-study classes", ph: 3, pr: "med", cps: ["Select cases & facilitator", "Run first class", "Complete class series"] },
    { t: "Provide training in public speaking & meeting facilitation", ph: 3, pr: "low", cps: ["Choose program / trainer", "First training session", "Practice & feedback round"] },
    { t: "Expand team social events (happy hours, lunches, sports)", ph: 2, pr: "low", cps: ["Plan events calendar", "Host first events", "Review engagement"] },
  ]},
  { name: "Portfolio Management", color: "#2f6b5e", items: [
    { t: "Build an AI-powered online deal-flow panel", ph: 2, pr: "high", cps: ["Define requirements", "Build MVP", "Roll out to team"] },
    { t: "Implement a local ERP system with AI integration", ph: 3, pr: "high", cps: ["Select ERP & scope", "Configure & integrate AI", "Go live"] },
    { t: "Develop an AI-assisted exit calculator tool", ph: 2, pr: "med", cps: ["Define model logic", "Build prototype", "Validate with real deals"] },
    { t: "Consolidate all controls & systems into a unified AI database (US & Brazil)", ph: 3, pr: "high", cps: ["Map existing systems", "Design unified schema", "Migrate & validate data"] },
    { t: "Integrate daily legal claims & portfolio movements into the AI ERP", ph: 4, pr: "med", cps: ["Define data feeds", "Build integration", "Confirm daily sync"] },
    { t: "Improve communication & visibility on settlements & exits", ph: 1, pr: "high", cps: ["Define reporting format", "Set update cadence", "First distribution"] },
  ]},
  { name: "Partners & SG Ecosystem", color: "#5b6aa8", items: [
    { t: "Implement formal governance for invested partners (Lass, VLS, Almina, Ticiano AI tool)", ph: 2, pr: "high", cps: ["Define reports, meetings & controls", "Agree cadence with partners", "First governance cycle"] },
    { t: "Standardize the Consignado proposal for partners", ph: 1, pr: "high", cps: ["Draft standard proposal", "Internal review", "Approve & circulate"] },
    { t: "Formalize the BLC proposal for partners", ph: 1, pr: "med", cps: ["Document framework", "Legal / IC review", "Publish final proposal"] },
    { t: "Standardize the onboarding process for new partners", ph: 2, pr: "med", cps: ["Map onboarding steps", "Build checklist & templates", "Pilot with one partner"] },
    { t: "Designate a single point of contact for each partner", ph: 1, pr: "high", cps: ["Map partners to owners", "Communicate to partners", "Confirm coverage"] },
    { t: "Implement a partner risk report (admin, regulatory, development)", ph: 3, pr: "med", cps: ["Define risk indicators", "Build report template", "First reporting cycle"] },
    { t: "Explore creation of a Consignado company modeled on Lass", ph: 4, pr: "low", cps: ["Feasibility study", "Business case & structure", "Go / no-go decision"] },
  ]},
  { name: "Investing, Due Diligence & Risk", color: "#a8443a", items: [
    { t: "Develop a go/no-go checklist for new deals (pre-IC)", ph: 1, pr: "high", cps: ["Draft checklist", "Pilot on next deal", "Mandate before IC"] },
    { t: "Establish a pipeline meeting without CC", ph: 1, pr: "med", cps: ["Set format & attendees", "Run first meeting", "Cadence review"] },
    { t: "Merge the global BLC IC with the Consignado IC", ph: 2, pr: "med", cps: ["Align agendas & members", "Define merged process", "First combined IC"] },
    { t: "Receive regular reports on legal status of cases & theses", ph: 1, pr: "high", cps: ["Define report scope", "Set cadence", "First report delivered"] },
    { t: "Sharpen focus & communication in local IC meetings", ph: 1, pr: "med", cps: ["Define IC standards", "Update agenda template", "Review after 2 ICs"] },
    { t: "Implement red/yellow/green flag reporting across risk layers (AI-monitored)", ph: 3, pr: "high", cps: ["Define flag criteria", "Build AI monitoring", "Roll out dashboard"] },
    { t: "Establish an in-office CCO function with AI support", ph: 3, pr: "high", cps: ["Define CCO mandate", "Assign & tool up", "Operational review"] },
    { t: "Create mandatory DD checklists for all asset classes", ph: 2, pr: "high", cps: ["Draft per asset class", "Review with team", "Mandate across deals"] },
  ]},
  { name: "Fundraising, PR & Investor Relations", color: "#b08527", items: [
    { t: "Provide IR with regular portfolio updates", ph: 1, pr: "high", cps: ["Define update pack", "Set cadence", "First update sent"] },
    { t: "Enhance investor communication with AI-assisted tools", ph: 2, pr: "med", cps: ["Select tools", "Build templates", "Roll out to IR"] },
    { t: "Increase events with local partners", ph: 2, pr: "med", cps: ["Plan event calendar", "Host first event", "Review pipeline impact"] },
    { t: "Strengthen local fundraising efforts", ph: 2, pr: "high", cps: ["Define target investors", "Outreach plan", "First commitments"] },
    { t: "Develop a local fundraising strategy for US products (e.g., XP)", ph: 3, pr: "med", cps: ["Market & product analysis", "Draft strategy", "Approve & launch"] },
  ]},
];

export function defaultStart(): string {
  return "2026-06-18"; // overall plan start
}

/** Build the seed plan (categories + items with phased checkpoint dates). */
export function buildSeed(startISO: string): Plan {
  const start = parse(startISO);
  const cats: Category[] = CATS.map((c) => ({
    id: uid(),
    name: c.name,
    color: c.color,
    items: c.items.map((it) => {
      const ph = Math.min(it.ph, 3);
      const pStart = addMonths(start, (ph - 1) * PHASE_LEN);
      const span = PHASE_LEN * 30;
      const k = it.cps.length;
      const cps = it.cps.map((label, i) => ({
        id: uid(),
        label,
        date: iso(addDays(pStart, Math.round(((i + 1) / (k + 1)) * span))),
        done: false,
      }));
      return {
        id: uid(),
        version: 0,
        title: it.t,
        owner: "",
        owner2: "",
        status: "not_started" as Status,
        priority: it.pr,
        phase: ph,
        start: iso(pStart),
        due: cps[cps.length - 1].date,
        checkpoints: cps,
        notes: [],
        health: "auto" as Health,
        completedAt: null,
      };
    }),
  }));
  return { version: 1, start: startISO, cats, history: [], activity: [] };
}
