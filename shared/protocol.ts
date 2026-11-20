export const files = ["index.html", "styles.css", "app.js"] as const;
export type FileName = typeof files[number];
export type Source = Record<FileName, string>;
export const feature = {
  title: "Archive completed tasks",
  request: "Add an action that moves completed tasks to an Archive view. Keep incomplete tasks on the board and preserve archived tasks after a reload.",
};
export const required = {
  control: "Archive action is usable",
  moved: "Completed tasks leave the active board",
  retained: "Incomplete tasks stay active",
  visible: "Archived tasks appear in the Archive view",
  persistence: "Archive survives a page reload",
  completion: "Task completion still works",
  explicit: "Newly completed tasks wait to be archived",
  duplicates: "Repeated archiving creates no duplicates",
} as const;
export type CheckId = keyof typeof required;
export type Check = { id: CheckId; status: "passed" | "failed" | "skipped"; detail?: string };
export const terminal = ["VERIFIED", "FAILED", "ERROR", "INTERRUPTED"] as const;
export type Status = typeof terminal[number] | "CREATED" | "BASELINING" | "GENERATING"
  | "VALIDATING_PATCH" | "APPLYING" | "VERIFYING" | "REPAIRING";
export const isTerminal = (status: Status) => terminal.some((value) => value === status);
export type Mode = "live" | "rehearsal";
export type Event = { status: Status; at: string; message: string; attempt?: number };
export type Evidence = { hash: string; checks: Check[]; screenshot: string; trace: string; diff?: string };
export type Attempt = {
  index: number;
  origin: "Model-generated" | "Scripted";
  model?: string;
  provider?: string;
  generator: string;
  input: string;
  explanation?: string;
  rejection?: string;
  patchHash?: string;
  evidence?: Evidence;
};
export type Run = {
  id: string;
  mode: Mode;
  status: Status;
  createdAt: string;
  events: Event[];
  baseline?: Evidence;
  attempts: Attempt[];
  verifiedHash?: string;
  artifacts: Record<string, "image/png" | "application/zip" | "text/plain">;
};
export type RunSummary = Pick<Run, "id" | "mode" | "status" | "createdAt">;
