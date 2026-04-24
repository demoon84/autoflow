const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const repoRoot = process.env.AUTOFLOW_REPO_ROOT || path.resolve(__dirname, "../../..");
const defaultBoardDirName = ".autoflow";

const allowedCommands = new Set(["init", "status"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: "Codex Work Flow",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }
}

function cliInvocation(command, projectRoot, boardDirName) {
  if (!allowedCommands.has(command)) {
    throw new Error(`Unsupported Autoflow command: ${command}`);
  }

  const normalizedBoardDirName = boardDirName || defaultBoardDirName;
  const args = [command];
  if (projectRoot) {
    args.push(projectRoot, normalizedBoardDirName);
  }

  if (process.platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(repoRoot, "bin", "autoflow.ps1"),
        ...args
      ]
    };
  }

  return {
    command: path.join(repoRoot, "bin", "autoflow"),
    args
  };
}

function runAutoflow(command, options = {}) {
  const projectRoot = options.projectRoot || "";
  const boardDirName = options.boardDirName || defaultBoardDirName;
  const invocation = cliInvocation(command, projectRoot, boardDirName);

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...(options.env || {})
      },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        command,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        command,
        code,
        stdout,
        stderr
      });
    });
  });
}

function parseKeyValueOutput(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }

    values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readMarkdownPreview(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const title = content.split(/\r?\n/).find((line) => line.trim().length > 0) || path.basename(filePath);
    return {
      filePath,
      name: path.basename(filePath),
      title: title.replace(/^#\s*/, ""),
      modifiedAt: (await fs.stat(filePath)).mtime.toISOString()
    };
  } catch {
    return {
      filePath,
      name: path.basename(filePath),
      title: path.basename(filePath),
      modifiedAt: ""
    };
  }
}

async function listMarkdownFiles(directory, recursive = false) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await listMarkdownFiles(absolute, true)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(await readMarkdownPreview(absolute));
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function readBoard({ projectRoot, boardDirName }) {
  const normalizedBoardDirName = boardDirName || defaultBoardDirName;
  const boardRoot = path.join(projectRoot || "", normalizedBoardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const exists = await pathExists(boardRoot);

  const statusResult = exists
    ? await runAutoflow("status", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;

  const ticketGroups = {
    backlog: await listMarkdownFiles(path.join(ticketsRoot, "backlog")),
    plan: await listMarkdownFiles(path.join(ticketsRoot, "plan")),
    todo: await listMarkdownFiles(path.join(ticketsRoot, "todo")),
    inprogress: await listMarkdownFiles(path.join(ticketsRoot, "inprogress")),
    verifier: await listMarkdownFiles(path.join(ticketsRoot, "verifier")),
    done: await listMarkdownFiles(path.join(ticketsRoot, "done"), true),
    reject: await listMarkdownFiles(path.join(ticketsRoot, "reject"))
  };

  const logs = await listMarkdownFiles(path.join(boardRoot, "logs"), true);

  return {
    repoRoot,
    boardRoot,
    exists,
    status: statusResult ? parseKeyValueOutput(statusResult.stdout) : {},
    statusResult,
    tickets: ticketGroups,
    logs: logs
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 12)
  };
}

function installBoard(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "init",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  return runAutoflow("init", options);
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:selectProject", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return "";
    }

    return result.filePaths[0];
  });

  ipcMain.handle("autoflow:readBoard", (_event, options) => readBoard(options || {}));
  ipcMain.handle("autoflow:installBoard", (_event, options) => installBoard(options || {}));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
