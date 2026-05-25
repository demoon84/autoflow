import { marked } from "marked";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMarkdownHtml(markdown: string): string {
  return marked.parse(markdown || "", {
    async: false,
    gfm: true,
    walkTokens(token) {
      const htmlToken = token as { type?: string; text?: string; raw?: string };
      if (htmlToken.type === "html") {
        htmlToken.text = escapeHtml(htmlToken.raw || htmlToken.text || "");
      }
    }
  }) as string;
}
