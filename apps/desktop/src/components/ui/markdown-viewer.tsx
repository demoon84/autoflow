import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const WORKER_ID_PATTERN = /\b(?:owner|worker|ai)-([A-Za-z0-9_-]+)\b/g;

function displayWorkerIdsInText(value: string) {
  return value.replace(WORKER_ID_PATTERN, (_, suffix: string) => `AI-${suffix}`);
}

function rewriteTextNodes(node: unknown): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const markdownNode = node as {
    type?: string;
    value?: string;
    children?: unknown[];
  };

  if (markdownNode.type === "code" || markdownNode.type === "inlineCode") {
    return;
  }

  if (markdownNode.type === "text" && typeof markdownNode.value === "string") {
    markdownNode.value = displayWorkerIdsInText(markdownNode.value);
  }

  if (Array.isArray(markdownNode.children)) {
    markdownNode.children.forEach(rewriteTextNodes);
  }
}

function remarkDisplayWorkerIds() {
  return (tree: unknown) => {
    rewriteTextNodes(tree);
  };
}

export function MarkdownViewer({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("markdown-viewer", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkDisplayWorkerIds]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
