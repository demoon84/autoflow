import fsSync from "node:fs";
import path from "node:path";

const { app, BrowserWindow, screen: electronScreen } = require("electron");
const { execFile } = require("node:child_process");

const windowStateFileName = "window-state.json";

export const macOsDesktopSpaceKeyCodes = new Map<number, number>([
  [1, 18],
  [2, 19],
  [3, 20],
  [4, 21],
  [5, 23],
  [6, 22],
  [7, 26],
  [8, 28],
  [9, 25]
]);

export const defaultMacOsDesktopSpaceNumber = (() => {
  const parsed = Number.parseInt(process.env.AUTOFLOW_DESKTOP_SPACE_NUMBER || "6", 10);
  return macOsDesktopSpaceKeyCodes.has(parsed) ? parsed : 6;
})();

export function windowStatePath(): string {
  return path.join(app.getPath("userData"), windowStateFileName);
}

export function normalizeWindowBounds(value: any): { x?: number; y?: number; width: number; height: number } | null {
  if (!value || typeof value !== "object") return null;
  const bounds: any = {
    x: Number.parseInt(value.x, 10),
    y: Number.parseInt(value.y, 10),
    width: Number.parseInt(value.width, 10),
    height: Number.parseInt(value.height, 10)
  };
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 1200 ||
    bounds.height < 720
  ) {
    return null;
  }
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    delete bounds.x;
    delete bounds.y;
  }
  return bounds;
}

export function readWindowState(): { bounds?: any; maximized?: boolean; desktopSpaceNumber: number } {
  try {
    const parsed = JSON.parse(fsSync.readFileSync(windowStatePath(), "utf8"));
    const bounds = normalizeWindowBounds(parsed.bounds);
    const desktopSpaceNumber = Number.parseInt(parsed.desktopSpaceNumber, 10);
    if (!bounds) {
      return {
        desktopSpaceNumber: macOsDesktopSpaceKeyCodes.has(desktopSpaceNumber)
          ? desktopSpaceNumber
          : defaultMacOsDesktopSpaceNumber
      };
    }

    const display = electronScreen.getDisplayMatching(bounds);
    const area = display.workArea;
    const bx = bounds.x;
    const by = bounds.y;
    const visible =
      typeof bx === "number" && Number.isFinite(bx) &&
      typeof by === "number" && Number.isFinite(by) &&
      bx + Math.min(bounds.width, 120) >= area.x &&
      by + Math.min(bounds.height, 80) >= area.y &&
      bx <= area.x + area.width - 80 &&
      by <= area.y + area.height - 60;

    return {
      bounds: visible ? bounds : { width: bounds.width, height: bounds.height },
      maximized: Boolean(parsed.maximized),
      desktopSpaceNumber: macOsDesktopSpaceKeyCodes.has(desktopSpaceNumber)
        ? desktopSpaceNumber
        : defaultMacOsDesktopSpaceNumber
    };
  } catch {
    return { desktopSpaceNumber: defaultMacOsDesktopSpaceNumber };
  }
}

export function writeWindowState(win: any): void {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const state = {
    bounds: win.getBounds(),
    maximized: win.isMaximized(),
    desktopSpaceNumber: defaultMacOsDesktopSpaceNumber
  };
  try {
    fsSync.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fsSync.writeFileSync(windowStatePath(), JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

export function trackWindowState(win: any): void {
  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeWindowState(win);
    }, 300);
  };
  win.on("move", scheduleSave);
  win.on("resize", scheduleSave);
  win.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    writeWindowState(win);
  });
}

export function switchToMacOsDesktopSpace(spaceNumber: number, callback: () => void): void {
  const keyCode = macOsDesktopSpaceKeyCodes.get(spaceNumber);
  if (process.platform !== "darwin" || !keyCode) {
    callback();
    return;
  }
  execFile(
    "osascript",
    ["-e", `tell application "System Events" to key code ${keyCode} using control down`],
    () => setTimeout(callback, 350)
  );
}
