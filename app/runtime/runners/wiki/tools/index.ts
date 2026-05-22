import { fail } from "../../../shared/runner-tool";
import { cmdWikiSourceSnapshot } from "./source-snapshot";
import { cmdWikiTelemetrySummary } from "./telemetry-summary";
import { cmdWikiQuery } from "./query";
import { cmdWikiLint } from "./lint";
import { cmdWikiIndexRefresh, cmdWikiIngest } from "./ingest";
import { cmdWikiWritePage } from "./write-page";
import { cmdWikiDiffSnapshot } from "./diff-snapshot";
import { cmdWikiTick } from "./tick";

export function dispatchWiki(command: string): void {
  switch (command) {
    case "source-snapshot":
      cmdWikiSourceSnapshot();
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
    case "index-refresh":
      cmdWikiIndexRefresh();
      return;
    case "write-page":
      cmdWikiWritePage();
      return;
    case "diff-snapshot":
      cmdWikiDiffSnapshot();
      return;
    case "tick":
      cmdWikiTick();
      return;
    default:
      fail(2, `unknown wiki command: ${command}`);
  }
}
