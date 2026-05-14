import { fail } from "../shared";
import { cmdWikiSourceSnapshot } from "./source-snapshot";
import { cmdWikiUpdateBaseline } from "./update-baseline";
import { cmdWikiTelemetrySummary } from "./telemetry-summary";
import { cmdWikiQuery } from "./query";
import { cmdWikiLint } from "./lint";
import { cmdWikiIngest } from "./ingest";
import { cmdWikiRetrofitFrontmatter } from "./retrofit-frontmatter";
import { cmdWikiWritePage } from "./write-page";
import { cmdWikiDiffSnapshot } from "./diff-snapshot";
import { cmdWikiWake } from "./wake";

export function dispatchWiki(command: string): void {
  switch (command) {
    case "source-snapshot":
      cmdWikiSourceSnapshot();
      return;
    case "update-baseline":
      cmdWikiUpdateBaseline();
      return;
    case "telemetry-summary":
      cmdWikiTelemetrySummary();
      return;
    case "query":
      cmdWikiQuery();
      return;
    case "lint":
      cmdWikiLint();
      return;
    case "ingest":
      cmdWikiIngest();
      return;
    case "retrofit-frontmatter":
      cmdWikiRetrofitFrontmatter();
      return;
    case "write-page":
      cmdWikiWritePage();
      return;
    case "diff-snapshot":
      cmdWikiDiffSnapshot();
      return;
    case "wake":
      cmdWikiWake();
      return;
    default:
      fail(2, `unknown wiki command: ${command}`);
  }
}
