"use client";

import {
  Activity, ArrowDownToLine, ArrowUpRight, Bot, Check as CheckIcon, ChevronRight,
  CircleAlert, CircleCheck, CircleX, CodeXml, FileCheck2, FlaskConical, History, ImageIcon,
  Layers, ListChecks, LoaderCircle, Play, ScanLine, Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  feature, isTerminal, required, type Check, type Evidence, type Mode, type Run, type RunSummary, type Status,
} from "../shared/protocol";

type Workspace = { runs: RunSummary[]; active: boolean; live: boolean };
type Tab = "Screenshots" | "Code diff" | "Checks";

const statusLabels: Record<Status, string> = {
  CREATED: "Queued",
  BASELINING: "Capturing baseline",
  GENERATING: "Generating candidate",
  VALIDATING_PATCH: "Validating patch",
  APPLYING: "Applying patch",
  VERIFYING: "Running checks",
  REPAIRING: "Preparing repair",
  VERIFIED: "Verified",
  FAILED: "Checks failed",
  ERROR: "Run error",
  INTERRUPTED: "Interrupted",
};
const modeLabel = (mode: Mode) => mode === "live" ? "Live AI" : "Rehearsal";
const artifact = (id: string, name: string) => `/api/runs/${id}/artifacts/${name}`;
const phaseLog: Status[] = ["BASELINING", "GENERATING", "VERIFYING", "REPAIRING"];
const tabs = [{ name: "Screenshots", Icon: ImageIcon }, { name: "Code diff", Icon: CodeXml }, { name: "Checks", Icon: ListChecks }] as const;

export default function Dashboard() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [workspaceError, setWorkspaceError] = useState("");
  const [mode, setMode] = useState<Mode>("rehearsal");
  const [selected, setSelected] = useState<string>();
  const [run, setRun] = useState<Run>();
  const [detailError, setDetailError] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const initial = new URLSearchParams(window.location.search).get("run");
    if (initial) setSelected(initial);
    async function refresh() {
      try {
        const response = await fetch("/api/runs", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("The local worker is unavailable.");
        const data: Workspace = await response.json();
        if (!controller.signal.aborted) {
          setWorkspace(data);
          setWorkspaceError("");
          setSelected((current) => current ?? data.runs[0]?.id);
        }
      } catch {
        if (!controller.signal.aborted) setWorkspaceError("The local worker is unavailable.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 1250);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const id: string = selected;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      let finished = false;
      try {
        const response = await fetch(`/api/runs/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          finished = response.status === 404;
          throw new Error(finished ? "This run is unavailable." : "Could not load run details.");
        }
        const next: Run = await response.json();
        if (!controller.signal.aborted) {
          setRun(next);
          setDetailError("");
          finished = isTerminal(next.status);
        }
      } catch (error) {
        if (!controller.signal.aborted) setDetailError((error as Error).message);
      } finally {
        if (!finished && !controller.signal.aborted) timer = setTimeout(refresh, 850);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [selected]);

  function select(id: string) {
    setSelected(id);
    setDetailError("");
    setHistoryOpen(false);
    window.history.replaceState({}, "", `?run=${id}`);
  }

  async function start() {
    setStarting(true);
    setStartError("");
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "The run could not start.");
      select(value.id);
      setWorkspace((current) => current && ({ ...current, active: true }));
    } catch (error) {
      setStartError((error as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const current = selected === run?.id ? run : undefined;
  const busy = starting || workspace?.active;
  const canStart = workspace && !workspaceError && !busy && (mode === "rehearsal" || workspace.live);

  return (
    <>
      <header className="topbar">
        <div className="top-inner">
          <a className="logo" href="/" aria-label="ProofPilot home"><span className="logo-mark"><ScanLine size={20} /></span> ProofPilot</a>
          <span className="top-divider" />
          <span className="top-label">Verification workspace</span>
          <div className="top-actions">
            <span className="runner-state"><span className={workspace && !workspaceError ? "online" : ""} />{workspaceError ? "Worker offline" : workspace ? "Local runner" : "Connecting"}</span>
            <div className="history">
              <button className="history-button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><History size={16} /> <span>Run history</span></button>
              {historyOpen && (
                <div className="history-list">
                  <h2>Run history</h2>
                  {workspace?.runs.length ? workspace.runs.map((entry) => (
                    <button className="history-row" key={entry.id} onClick={() => select(entry.id)}>
                      <span>{modeLabel(entry.mode)}<small>{new Date(entry.createdAt).toLocaleString()}</small></span>
                      <StatusBadge status={entry.status} />
                    </button>
                  )) : <p>No runs yet.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="workspace">
        <div className="intro">
          <h1>AI that proves<br className="small-break" /> its own work<span>.</span></h1>
          <p>Give an agent a feature request. See the code change and the browser checks that verify it.</p>
        </div>
        <div className="grid">
          <aside className="sidebar">
            <section className="panel request">
              <div className="panel-heading"><Layers size={17} /> <h2>Feature request</h2></div>
              <div className="request-body">
                <div className="repo"><span className="repo-icon">R</span><span>Relay <small>Bundled task board</small></span></div>
                <div className="feature"><h3>{feature.title}</h3><p>{feature.request}</p></div>
                <fieldset>
                  <legend>Execution mode</legend>
                  <div className="mode-options">
                    {([["rehearsal", FlaskConical, "Scripted edits"], ["live", Bot, "Model-generated edits"]] as const).map(([value, Icon, description]) => (
                      <label key={value} className={mode === value ? "chosen" : ""}>
                        <input type="radio" checked={mode === value} onChange={() => setMode(value)} name="mode" value={value} />
                        <Icon size={16} />
                        <span>{modeLabel(value)}<small>{description}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="run-button" onClick={() => void start()} disabled={!canStart}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Play size={16} fill="currentColor" />}
                  {busy ? "Run in progress" : mode === "live" ? "Run Live AI" : "Run rehearsal"}
                </button>
                {mode === "live" && workspace && !workspace.live && <p className="notice">Set <code>AI_GATEWAY_API_KEY</code> in <code>.env.local</code> and restart the worker to enable Live AI.</p>}
                {(startError || workspaceError) && <p className="notice error" role="alert">{startError || workspaceError}</p>}
              </div>
            </section>
            <Timeline run={current} />
          </aside>

          <EvidencePanel key={current?.id ?? selected ?? "empty"} run={current} loading={Boolean(selected && !current)} error={detailError} />
        </div>
        <footer><span><ScanLine size={15} /> ProofPilot</span><span>Local verification <i /> Playwright Chromium</span></footer>
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const kind = status === "VERIFIED" ? "success" : isTerminal(status) ? "danger" : "pending";
  return <span className={`badge ${kind}`}><span />{statusLabels[status]}</span>;
}

function Timeline({ run }: { run?: Run }) {
  const events = run?.events.filter(({ status }) => phaseLog.includes(status) || isTerminal(status)) ?? [];
  return (
    <section className="panel timeline">
      <div className="panel-heading"><Activity size={17} /> <h2>Run timeline</h2></div>
      <div className="timeline-body" aria-live="polite">
        {events.length ? <ol>{events.map((event, index) => (
          <li key={index}>
            <span className={`timeline-dot ${event.status === "VERIFIED" ? "dot-success" : ""}`}>
              {event.status === "VERIFIED" ? <CheckIcon size={12} /> : event.status === "VERIFYING" ? <ScanLine size={12} /> : <Workflow size={12} />}
            </span>
            <div><h3>{statusLabels[event.status]}{event.attempt ? <small>Attempt {event.attempt}</small> : null}</h3><p>{event.message}</p></div>
          </li>
        ))}</ol> : <p className="muted">Run a verification to see candidate changes, checks, and repairs here.</p>}
      </div>
    </section>
  );
}

function EvidencePanel({ run, loading, error }: { run?: Run; loading: boolean; error: string }) {
  const [tab, setTab] = useState<Tab>("Screenshots");
  const [attemptIndex, setAttemptIndex] = useState<number>();
  const attempts = run?.attempts ?? [];
  const attempt = attempts.find(({ index }) => index === attemptIndex) ?? attempts.at(-1);
  const candidate = attempt?.evidence;
  const passed = candidate?.checks.filter(({ status }) => status === "passed").length ?? 0;
  const selectedFailed = Boolean(candidate?.checks.some(({ status }) => status === "failed"));
  const selectedPassed = Boolean(candidate && run?.verifiedHash === candidate.hash && run.status === "VERIFIED");
  const before = run?.baseline;
  const evidence = candidate ?? (attempt ? undefined : before);

  return (
    <section className="panel evidence">
      <div className="panel-heading evidence-heading">
        <span className="panel-title"><FileCheck2 size={18} /> <h2>Verification evidence</h2></span>
        {run ? <StatusBadge status={run.status} /> : <span className="badge neutral"><span />{loading && !error ? "Loading" : "Awaiting run"}</span>}
      </div>
      <div className="evidence-toolbar">
        <div className="tabs" aria-label="Evidence views">
          {tabs.map(({ name, Icon }) => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}><Icon size={15} /> {name}</button>)}
        </div>
        {run && evidence && <a className="trace-download" aria-label="Download browser trace" href={artifact(run.id, evidence.trace)} download><ArrowDownToLine size={15} /><span>Trace</span></a>}
      </div>
      <div className="evidence-body">
        {run && (
          <div className="run-meta">
            <div><span className="mode-marker">{run.mode === "live" ? <Bot size={14} /> : <FlaskConical size={14} />}{modeLabel(run.mode)}</span>
              <span>{attempt?.origin ? `${attempt.origin} candidate` : "Original fixture"}</span></div>
            {attempts.length > 0 && <label><span className="sr-only">Candidate attempt</span>
              <select value={attempt?.index ?? ""} onChange={(event) => setAttemptIndex(Number(event.target.value))}>
                {attempts.map(({ index }) => <option key={index} value={index}>Attempt {index}</option>)}
              </select>
            </label>}
          </div>
        )}
        {error && <p className="notice error" role="alert">{error}</p>}
        {tab === "Screenshots" && <div className="screenshots">
          <Screenshot label="Before" caption="Original task board" run={run} evidence={before} />
          <Screenshot label="After" caption={candidate ? `Candidate ${attempt?.index} · Browser result` : "Candidate after browser checks"} run={run} evidence={candidate} />
        </div>}
        {tab === "Code diff" && (run && candidate?.diff
          ? <CodeDiff url={artifact(run.id, candidate.diff)} />
          : <EmptyEvidence Icon={CodeXml} title="No candidate diff yet" />)}
        {tab === "Checks" && (evidence
          ? <div className="checks">{evidence.checks.map((check) => <CheckResult key={check.id} check={check} />)}</div>
          : <EmptyEvidence Icon={ListChecks} title="No browser checks yet" />)}
        <div className="evidence-note">
          {selectedPassed ? <CircleCheck size={17} className="check-success" /> : <CircleAlert size={17} />}
          <span>{selectedPassed ? "Acceptance checks passed for this candidate." : selectedFailed ? "This candidate failed browser checks." : run && isTerminal(run.status) ? run.events.at(-1)?.message : "Verdicts come from the required Playwright checks."}</span>
          {candidate && <small>{passed}/{Object.keys(required).length} checks passed</small>}
        </div>
        {attempt && (attempt.explanation || attempt.model || attempt.rejection) && (
          <details className="attempt-detail"><summary><ChevronRight size={15} /> Candidate details</summary>
            {attempt.explanation && <p>{attempt.explanation}</p>}
            {attempt.rejection && <p className="error">{attempt.rejection}</p>}
            {attempt.model && <p>{attempt.model}{attempt.provider ? ` · ${attempt.provider}` : ""}</p>}
            {candidate && <p>Tested source <code>{candidate.hash.slice(0, 16)}</code></p>}
          </details>
        )}
      </div>
    </section>
  );
}

function Screenshot({ label, caption, run, evidence }: { label: string; caption: string; run?: Run; evidence?: Evidence }) {
  const url = run && evidence ? artifact(run.id, evidence.screenshot) : undefined;
  return (
    <figure className="screenshot">
      <figcaption><strong>{label}</strong><span>{caption}</span></figcaption>
      {url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label.toLowerCase()} screenshot`}>
        {/* Browser evidence is a local artifact served by the worker. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={caption} /><ArrowUpRight size={15} />
      </a> : <div className="shot-placeholder"><span><ImageIcon size={20} /></span><small>Waiting for capture</small></div>}
    </figure>
  );
}

function EmptyEvidence({ Icon, title }: { Icon: typeof CodeXml; title: string }) {
  return <div className="empty-evidence"><Icon size={23} /><p>{title}</p></div>;
}

function CheckResult({ check }: { check: Check }) {
  const Icon = check.status === "passed" ? CircleCheck : check.status === "failed" ? CircleX : CircleAlert;
  return <div className={`check-row check-${check.status}`}>
    <Icon size={17} /><div><strong>{required[check.id]}</strong>{check.detail && <pre>{check.detail}</pre>}</div>
    <span>{check.status}</span>
  </div>;
}

function CodeDiff({ url }: { url: string }) {
  const [result, setResult] = useState<{ url: string; body: string; error?: boolean }>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load the candidate diff.");
      const body = await response.text();
      if (!controller.signal.aborted) setResult({ url, body });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ url, body: "Could not load the candidate diff.", error: true });
    });
    return () => controller.abort();
  }, [url]);

  if (result?.url !== url) return <EmptyEvidence Icon={CodeXml} title="Loading diff…" />;
  if (result.error) return <p className="notice error" role="alert">{result.body}</p>;
  return <pre className="diff" tabIndex={0} aria-label="Unified source diff">{result.body.split("\n").map((line, index) => (
    <span key={index} className={line[0] === "+" ? "added" : line[0] === "-" ? "removed" : line.startsWith("@@") ? "hunk" : ""}>{line || " "}</span>
  ))}</pre>;
}
