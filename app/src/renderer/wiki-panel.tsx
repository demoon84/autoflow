import * as React from "react";
import { ChevronDown, ChevronRight, ExternalLink, FileText, Folder, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderMarkdownHtml } from "./markdown-render";

type WikiTreeNode = {
  type: "directory" | "page";
  name: string;
  path: string;
  children?: WikiTreeNode[];
};

type WikiApi = {
  wikiTreeList: (options: { projectRoot: string; boardDirName: string }) => Promise<WikiTreeNode[]>;
  wikiPageRead: (options: { projectRoot: string; boardDirName: string; path: string }) => Promise<string>;
  onWikiTreeChanged: (handler: (payload: unknown) => void) => () => void;
};

type WikiPanelProps = {
  projectRoot: string;
  boardDirName: string;
};

function autoflowWikiApi(): WikiApi {
  return window.autoflow as unknown as WikiApi;
}

function firstPagePath(nodes: WikiTreeNode[]): string {
  for (const node of nodes) {
    if (node.type === "page") return node.path;
    const childPath = firstPagePath(node.children || []);
    if (childPath) return childPath;
  }
  return "";
}

function normalizeWikiPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirname(path: string) {
  const normalized = normalizeWikiPath(path);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function resolveInternalWikiLink(currentPath: string, href: string) {
  const rawPath = href.split("#")[0]?.split("?")[0] || "";
  if (!rawPath || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(rawPath) || !rawPath.endsWith(".md")) {
    return "";
  }

  const decodedPath = decodeURIComponent(rawPath).replace(/\\/g, "/");
  const joined = decodedPath.startsWith("/") ? decodedPath : [dirname(currentPath), decodedPath].filter(Boolean).join("/");
  const parts: string[] = [];
  for (const part of joined.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function wikiEventMatchesProject(payload: unknown, projectRoot: string, boardDirName: string) {
  if (!payload || typeof payload !== "object") return true;
  const event = payload as { projectRoot?: unknown; boardDirName?: unknown };
  return (
    (!event.projectRoot || event.projectRoot === projectRoot) &&
    (!event.boardDirName || event.boardDirName === boardDirName)
  );
}

function WikiTreeBranch({
  nodes,
  selectedPath,
  expanded,
  onToggle,
  onSelect
}: {
  nodes: WikiTreeNode[];
  selectedPath: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {nodes.map((node) => {
        const key = `${node.type}:${node.path}`;
        if (node.type === "directory") {
          const isOpen = expanded.has(node.path);
          return (
            <div key={key}>
              <Button
                type="button"
                variant="ghost"
                className="wiki-tree-button"
                style={{ width: "100%", justifyContent: "flex-start", gap: 8 }}
                onClick={() => onToggle(node.path)}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Folder className="h-4 w-4" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
              </Button>
              {isOpen && node.children?.length ? (
                <div style={{ marginLeft: 16 }}>
                  <WikiTreeBranch
                    nodes={node.children}
                    selectedPath={selectedPath}
                    expanded={expanded}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Button
            key={key}
            type="button"
            variant="ghost"
            className={cn("wiki-tree-button", selectedPath === node.path && "wiki-tree-button-active")}
            style={{ width: "100%", justifyContent: "flex-start", gap: 8 }}
            title={node.path}
            onClick={() => onSelect(node.path)}
          >
            <FileText className="h-4 w-4" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          </Button>
        );
      })}
    </div>
  );
}

export function WikiPanel({ projectRoot, boardDirName }: WikiPanelProps) {
  const [tree, setTree] = React.useState<WikiTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = React.useState("");
  const [html, setHtml] = React.useState("");
  const [isLoadingTree, setIsLoadingTree] = React.useState(false);
  const [isLoadingPage, setIsLoadingPage] = React.useState(false);
  const [error, setError] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const loadTree = React.useCallback(async () => {
    if (!projectRoot) return;
    setIsLoadingTree(true);
    setError("");
    try {
      const nextTree = await autoflowWikiApi().wikiTreeList({ projectRoot, boardDirName });
      setTree(nextTree);
      setExpanded((current) => {
        const next = new Set(current);
        nextTree.forEach((node) => {
          if (node.type === "directory") next.add(node.path);
        });
        return next;
      });
      setSelectedPath((current) => current || firstPagePath(nextTree));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "위키 트리를 읽지 못했습니다.");
    } finally {
      setIsLoadingTree(false);
    }
  }, [boardDirName, projectRoot]);

  const loadPage = React.useCallback(
    async (path: string) => {
      if (!projectRoot || !path) {
        setHtml("");
        return;
      }
      setIsLoadingPage(true);
      setError("");
      try {
        const markdown = await autoflowWikiApi().wikiPageRead({ projectRoot, boardDirName, path });
        setHtml(renderMarkdownHtml(markdown));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "위키 페이지를 읽지 못했습니다.");
      } finally {
        setIsLoadingPage(false);
      }
    },
    [boardDirName, projectRoot]
  );

  React.useEffect(() => {
    void loadTree();
  }, [loadTree]);

  React.useEffect(() => {
    void loadPage(selectedPath);
  }, [loadPage, selectedPath]);

  React.useEffect(() => {
    return autoflowWikiApi().onWikiTreeChanged((payload) => {
      if (!wikiEventMatchesProject(payload, projectRoot, boardDirName)) return;
      void loadTree();
      if (selectedPath) void loadPage(selectedPath);
    });
  }, [boardDirName, loadPage, loadTree, projectRoot, selectedPath]);

  const handleArticleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const internalPath = resolveInternalWikiLink(selectedPath, href);
      if (!internalPath) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noreferrer");
        return;
      }

      event.preventDefault();
      setSelectedPath(internalPath);
    },
    [selectedPath]
  );

  return (
    <section
      className="wiki-panel"
      aria-label="위키 페이지"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)",
        minHeight: 520,
        overflow: "hidden",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--background)"
      }}
    >
      <aside
        className="wiki-panel-sidebar"
        aria-label="위키 트리"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
          borderRight: "1px solid var(--border)",
          padding: 14
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <strong>위키</strong>
            <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{boardDirName}/wiki</div>
          </div>
          <Button type="button" variant="ghost" size="icon" title="새로고침" aria-label="위키 새로고침" onClick={() => void loadTree()}>
            {isLoadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <div style={{ minHeight: 0, overflow: "auto" }}>
          {tree.length ? (
            <WikiTreeBranch
              nodes={tree}
              selectedPath={selectedPath}
              expanded={expanded}
              onToggle={(path) => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                });
              }}
              onSelect={setSelectedPath}
            />
          ) : (
            <div className="empty-panel">표시할 위키 페이지가 없습니다</div>
          )}
        </div>
      </aside>
      <article
        className="wiki-panel-content"
        aria-label={selectedPath || "위키 본문"}
        onClick={handleArticleClick}
        style={{ minWidth: 0, overflow: "auto", padding: 24 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedPath || "위키 페이지"}
            </strong>
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>markdown HTML 렌더링</span>
          </div>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </div>
        {error ? <div className="knowledge-error">{error}</div> : null}
        {isLoadingPage ? (
          <div className="empty-panel">위키 페이지를 읽는 중입니다</div>
        ) : (
          <div className="markdown-viewer" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </article>
    </section>
  );
}
