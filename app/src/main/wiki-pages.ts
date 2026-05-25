import fs from "node:fs";
import path from "node:path";

export type WikiTreeNode = {
  type: "directory" | "page";
  name: string;
  path: string;
  children?: WikiTreeNode[];
};

function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

function wikiRootPath(projectRoot: string, boardDirName = ".autoflow") {
  return path.join(projectRoot, boardDirName, "wiki");
}

function sortEntries(left: fs.Dirent, right: fs.Dirent) {
  if (left.isDirectory() !== right.isDirectory()) {
    return left.isDirectory() ? -1 : 1;
  }
  return left.name.localeCompare(right.name, "ko");
}

function buildWikiTreeFromDir(root: string, dir: string): WikiTreeNode[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".md")))
    .sort(sortEntries)
    .map((entry) => {
      const absolutePath = path.join(dir, entry.name);
      const relPath = toPosixPath(path.relative(root, absolutePath));
      if (entry.isDirectory()) {
        return {
          type: "directory",
          name: entry.name,
          path: relPath,
          children: buildWikiTreeFromDir(root, absolutePath)
        };
      }
      return {
        type: "page",
        name: entry.name.replace(/\.md$/i, ""),
        path: relPath
      };
    });
}

export function wikiTreeList(options: {projectRoot?: string; boardDirName?: string} = {}) {
  const projectRoot = String(options.projectRoot || "");
  if (!projectRoot) return [];
  const root = wikiRootPath(projectRoot, String(options.boardDirName || ".autoflow"));
  return buildWikiTreeFromDir(root, root);
}

function resolveWikiPagePath(options: {projectRoot?: string; boardDirName?: string; path?: string; pagePath?: string}) {
  const projectRoot = String(options.projectRoot || "");
  const requestedPath = String(options.path || options.pagePath || "");
  if (!projectRoot || !requestedPath || path.isAbsolute(requestedPath) || !requestedPath.endsWith(".md")) {
    return "";
  }
  const root = wikiRootPath(projectRoot, String(options.boardDirName || ".autoflow"));
  const absolutePath = path.resolve(root, requestedPath);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return "";
  }
  return absolutePath;
}

export function wikiPageRead(options: {projectRoot?: string; boardDirName?: string; path?: string; pagePath?: string} = {}) {
  const pagePath = resolveWikiPagePath(options);
  if (!pagePath) return "";
  return fs.readFileSync(pagePath, "utf8");
}
