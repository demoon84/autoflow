import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
  TriangleAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./styles.css";

const ticketColumns = [
  { key: "backlog", label: "Backlog", meta: "Spec intake", icon: Inbox, tone: "lane-backlog" },
  { key: "plan", label: "Plan", meta: "Planning", icon: ClipboardList, tone: "lane-plan" },
  { key: "todo", label: "Todo", meta: "Ready", icon: Layers3, tone: "lane-todo" },
  { key: "inprogress", label: "Running", meta: "Claimed", icon: Activity, tone: "lane-inprogress" },
  { key: "verifier", label: "Verify", meta: "Review", icon: ShieldCheck, tone: "lane-verifier" },
  { key: "done", label: "Done", meta: "Passed", icon: CheckCircle2, tone: "lane-done" },
  { key: "reject", label: "Reject", meta: "Needs plan", icon: TriangleAlert, tone: "lane-reject" }
] as const;

const defaultFlowFolder = ".autoflow";

function initialSetting(key: string, fallback: string) {
  return window.localStorage.getItem(key) || fallback;
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function countTickets(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return 0;
  }

  return ticketColumns.reduce((total, column) => total + (board.tickets[column.key]?.length || 0), 0);
}

function statusValue(status: Record<string, string>, key: string, fallback: string) {
  const value = status[key];
  return value && value.trim().length ? value : fallback;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function App() {
  const [projectRoot, setProjectRoot] = React.useState(() => initialSetting("autoflow.projectRoot", ""));
  const [board, setBoard] = React.useState<AutoflowBoardSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [setupError, setSetupError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState("");

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder }),
    [projectRoot]
  );

  const loadBoard = React.useCallback(
    async (targetOptions = options) => {
      window.localStorage.setItem("autoflow.projectRoot", targetOptions.projectRoot);

      if (!targetOptions.projectRoot) {
        setBoard(null);
        setLastUpdated("");
        setSetupError("");
        return;
      }

      const snapshot = await window.autoflow.readBoard(targetOptions);
      setBoard(snapshot);
      setLastUpdated(new Date().toISOString());
    },
    [options]
  );

  const refreshBoard = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadBoard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBoard]);

  React.useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const browseProject = React.useCallback(async () => {
    const selected = await window.autoflow.selectProject();
    if (selected) {
      setProjectRoot(selected);
    }
  }, []);

  const installFlow = React.useCallback(
    async (targetRoot = options.projectRoot) => {
      let root = targetRoot;
      if (!root) {
        root = await window.autoflow.selectProject();
      }

      if (!root || isInstalling) {
        return;
      }

      const targetOptions = { projectRoot: root, boardDirName: defaultFlowFolder };
      setProjectRoot(root);
      setIsInstalling(true);
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard(targetOptions);
        if (!result.ok) {
          setSetupError(result.stderr || "Install failed.");
          return;
        }

        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
      }
    },
    [isInstalling, loadBoard, options.projectRoot]
  );

  const boardExists = Boolean(board?.exists);
  const ticketTotal = countTickets(board);
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "No project";

  return (
    <div className="viewer-shell">
      <header className="top-viewer-bar">
        <div className="brand-panel">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="min-w-0">
            <h1>Codex Flow</h1>
            <p>Autoflow Visualizer</p>
          </div>
        </div>

        <div className="viewer-title">
          <strong>Codex #Command Flow</strong>
          <span>Visualizing #plan, #todo, #veri progress</span>
        </div>

        <div className="top-actions">
          <div className="status-chip">
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>{lastUpdated ? `Updated ${formatDate(lastUpdated)}` : "No snapshot"}</span>
          </div>
          <Button variant="default" className="refresh-button" disabled={isRefreshing} onClick={refreshBoard}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="workspace">
        <SummaryGrid board={board} />

        <section className="board-section" aria-label="Codex work flow">
          <div className="section-heading">
            <div>
              <h3>Agent Ticket Flow</h3>
            </div>
            <Badge variant="outline" className="count-badge">
              {ticketTotal} files
            </Badge>
          </div>
          <TicketBoard board={board} />
        </section>

        <section className="lower-grid" aria-label="Codex progress logs and snapshot">
          <div className="tool-panel">
            <div className="section-heading compact">
              <div>
                <div className="section-kicker">History</div>
                <h3>Recent Logs</h3>
              </div>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <LogList board={board} />
          </div>

          <div className="snapshot-panel">
            <div className="section-heading compact">
              <div>
                <div className="section-kicker">Snapshot</div>
                <h3>Progress Snapshot</h3>
              </div>
              <Badge variant={boardExists ? "default" : options.projectRoot ? "destructive" : "secondary"}>
                {boardExists ? "tracking" : "missing"}
              </Badge>
            </div>
            <SnapshotGrid board={board} lastUpdated={lastUpdated} ticketTotal={ticketTotal} />
          </div>
        </section>
      </main>

      <footer className="project-switcher" aria-label="Codex progress source settings">
        <div className="switcher-status">
          <span className={boardExists ? "status-dot status-dot-ok" : "status-dot"} />
          <div>
            <strong>{projectLabel}</strong>
            <span>
              {setupError ||
                (boardExists ? ".autoflow loaded" : options.projectRoot ? ".autoflow not installed" : "No project")}
            </span>
          </div>
        </div>

        <div className="switcher-field project-root-field">
          <Label htmlFor="projectRoot">Project Root</Label>
          <div className="input-with-action">
            <Input
              id="projectRoot"
              value={projectRoot}
              spellCheck={false}
              placeholder="/path/to/project"
              onChange={(event) => setProjectRoot(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              className="browse-button"
              title="Browse project"
              onClick={browseProject}
              aria-label="Browse project"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {options.projectRoot && !boardExists ? (
          <Button className="setup-button" disabled={isInstalling} onClick={() => void installFlow()}>
            {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Install .autoflow
          </Button>
        ) : (
          <Badge variant="secondary" className="switcher-count">
            {ticketTotal} files
          </Badge>
        )}
      </footer>
    </div>
  );
}

function SnapshotGrid({
  board,
  lastUpdated,
  ticketTotal
}: {
  board: AutoflowBoardSnapshot | null;
  lastUpdated: string;
  ticketTotal: number;
}) {
  const status = board?.status || {};
  const rows = [
    ["Flow Source", board?.exists ? ".autoflow found" : "Missing"],
    ["Version", statusValue(status, "board_version", "-")],
    ["Ticket Files", String(ticketTotal)],
    ["Updated", lastUpdated ? formatDate(lastUpdated) : "-"]
  ];

  return (
    <div className="snapshot-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="snapshot-item">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function SummaryGrid({ board }: { board: AutoflowBoardSnapshot | null }) {
  const status = board?.status || {};
  const cards = [
    {
      label: "Specs",
      value: statusValue(status, "spec_count", String(board?.tickets.backlog?.length || 0)),
      detail: "backlog",
      icon: ClipboardCheck,
      tone: "metric-blue"
    },
    {
      label: "Todo",
      value: statusValue(status, "ticket_todo_count", String(board?.tickets.todo?.length || 0)),
      detail: "ready",
      icon: Layers3,
      tone: "metric-amber"
    },
    {
      label: "Running",
      value: statusValue(status, "ticket_inprogress_count", String(board?.tickets.inprogress?.length || 0)),
      detail: "claimed",
      icon: Activity,
      tone: "metric-teal"
    },
    {
      label: "Verifier",
      value: statusValue(
        status,
        "ticket_ready_for_verification_count",
        String(board?.tickets.verifier?.length || 0)
      ),
      detail: "pending",
      icon: ShieldCheck,
      tone: "metric-violet"
    },
    {
      label: "Done",
      value: statusValue(status, "ticket_done_count", String(board?.tickets.done?.length || 0)),
      detail: "passed",
      icon: Archive,
      tone: "metric-green"
    }
  ];

  return (
    <section className="metrics-strip" aria-label="Codex progress summary">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <article key={label} className={`metric-card ${tone}`}>
          <div className="metric-icon">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
          <em>{detail}</em>
        </article>
      ))}
    </section>
  );
}

function TicketBoard({ board }: { board: AutoflowBoardSnapshot | null }) {
  return (
    <div className="ticket-board">
      {ticketColumns.map(({ key, label, meta, icon: Icon, tone }) => {
        const items = board?.tickets[key] || [];
        return (
          <section key={key} className={`ticket-lane ${tone}`}>
            <header>
              <div className="lane-title">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
              <Badge variant="secondary">{items.length}</Badge>
            </header>
            <p>{meta}</p>
            <div className="ticket-stack">
              {items.length ? (
                items.map((item) => (
                  <article key={item.filePath} className="ticket-card">
                    <div className="ticket-card-top">
                      <strong>{item.name}</strong>
                      <span>{formatDate(item.modifiedAt)}</span>
                    </div>
                    <p>{item.title}</p>
                  </article>
                ))
              ) : (
                <div className="empty-lane">Empty</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LogList({ board }: { board: AutoflowBoardSnapshot | null }) {
  if (!board?.logs.length) {
    return <div className="empty-panel">No logs</div>;
  }

  return (
    <div className="log-list">
      {board.logs.map((log) => (
        <article key={log.filePath} className="log-row">
          <Terminal className="h-4 w-4" />
          <div className="min-w-0">
            <strong>{log.name}</strong>
            <span>{formatDate(log.modifiedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
