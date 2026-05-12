#!/usr/bin/env npx tsx
/**
 * wiki-embed.ts — Local sentence-transformers embedding provider.
 *
 * Reads text from stdin, outputs a JSON float array (384-dim, all-MiniLM-L6-v2).
 * Used as AUTOFLOW_WIKI_EMBEDDING_PROVIDER for wiki RAG hybrid scoring.
 *
 * Provider chain (first available wins):
 *   1. python3 venv with sentence-transformers (auto-installed on first run)
 *   2. Exit 0 with no output → BM25 fallback in calling code
 *
 * Model: all-MiniLM-L6-v2 (384-dim, ~80MB, cached after first download)
 * Model cache: .autoflow/runners/state/wiki-embed-models/
 * Venv: .autoflow/runners/state/wiki-embed-models/venv/
 *
 * Exit 0 always (1원칙: never block RAG or wiki flow).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";

const BOARD_ROOT = process.env.BOARD_ROOT
  || process.env.AUTOFLOW_BOARD_ROOT
  || path.join(process.cwd(), ".autoflow");

const MODEL_DIR = path.join(BOARD_ROOT, "runners", "state", "wiki-embed-models");
const VENV_DIR  = path.join(MODEL_DIR, "venv");
const MODEL_NAME = "all-MiniLM-L6-v2";
const VECTOR_DIM = 384;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasPython3(): boolean {
  const r = spawnSync("python3", ["--version"], { stdio: "pipe", timeout: 5000 });
  return r.status === 0;
}

function venvReady(): boolean {
  const pip = path.join(VENV_DIR, "bin", "pip");
  if (!fs.existsSync(pip)) return false;
  const r = spawnSync(
    path.join(VENV_DIR, "bin", "python3"),
    ["-c", "import sentence_transformers"],
    { stdio: "pipe", timeout: 10000 }
  );
  return r.status === 0;
}

function setupVenv(): boolean {
  try {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    // Create venv
    const venvCreate = spawnSync("python3", ["-m", "venv", VENV_DIR], {
      stdio: "pipe",
      timeout: 30000,
    });
    if (venvCreate.status !== 0) return false;

    // Install sentence-transformers (downloads model on first encode)
    const pip = path.join(VENV_DIR, "bin", "pip");
    const install = spawnSync(
      pip,
      ["install", "--quiet", "sentence-transformers"],
      { stdio: "pipe", timeout: 180000 }
    );
    return install.status === 0;
  } catch {
    return false;
  }
}

// ─── Embedding via python3 venv ───────────────────────────────────────────────

// Single-text mode: reads text from stdin, outputs one JSON float array.
const EMBED_PY = `
import sys
import json
import os

model_dir = os.environ.get('AUTOFLOW_EMBED_MODEL_DIR', '')
text = sys.stdin.read()
if not text.strip():
    sys.exit(0)

try:
    from sentence_transformers import SentenceTransformer
    cache = os.path.join(model_dir, 'hf_cache') if model_dir else None
    m = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=cache)
    vec = m.encode(text, show_progress_bar=False)
    print(json.dumps(vec.tolist()))
except Exception as e:
    print(f"embed_error: {e}", file=sys.stderr)
    sys.exit(0)
`;

// Batch mode: reads JSON array of strings from stdin, outputs JSON array of vectors.
// One python process load → amortised model load cost across many chunks.
const EMBED_BATCH_PY = `
import sys
import json
import os

model_dir = os.environ.get('AUTOFLOW_EMBED_MODEL_DIR', '')
raw = sys.stdin.read().strip()
if not raw:
    print(json.dumps([]))
    sys.exit(0)

try:
    texts = json.loads(raw)
    if not isinstance(texts, list):
        texts = [texts]
    from sentence_transformers import SentenceTransformer
    cache = os.path.join(model_dir, 'hf_cache') if model_dir else None
    m = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=cache)
    vecs = m.encode(texts, show_progress_bar=False)
    print(json.dumps([v.tolist() for v in vecs]))
except Exception as e:
    print(f"embed_batch_error: {e}", file=sys.stderr)
    print(json.dumps([]))
    sys.exit(0)
`;

function embedWithPython(text: string): number[] | null {
  const python = path.join(VENV_DIR, "bin", "python3");
  const r = spawnSync(python, ["-c", EMBED_PY], {
    input: text,
    env: { ...process.env, AUTOFLOW_EMBED_MODEL_DIR: MODEL_DIR },
    stdio: "pipe",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return null;
  const out = r.stdout.toString("utf8").trim();
  if (!out) return null;
  try {
    const vec = JSON.parse(out);
    if (Array.isArray(vec) && vec.length === VECTOR_DIM) return vec as number[];
  } catch {}
  return null;
}

function embedBatchWithPython(texts: string[]): (number[] | null)[] {
  if (texts.length === 0) return [];
  const python = path.join(VENV_DIR, "bin", "python3");
  const r = spawnSync(python, ["-c", EMBED_BATCH_PY], {
    input: JSON.stringify(texts),
    env: { ...process.env, AUTOFLOW_EMBED_MODEL_DIR: MODEL_DIR },
    stdio: "pipe",
    timeout: Math.max(60000, texts.length * 5000),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return texts.map(() => null);
  const out = r.stdout.toString("utf8").trim();
  if (!out) return texts.map(() => null);
  try {
    const vecs = JSON.parse(out);
    if (!Array.isArray(vecs)) return texts.map(() => null);
    return vecs.map((v: unknown) => {
      if (Array.isArray(v) && v.length === VECTOR_DIM) return v as number[];
      return null;
    });
  } catch {}
  return texts.map(() => null);
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--help")) {
  process.stdout.write([
    "wiki-embed.ts — sentence-transformers embedding provider for Autoflow wiki RAG.",
    "",
    "Usage: npx tsx wiki-embed.ts < text.txt",
    "Output: JSON float array (384-dim all-MiniLM-L6-v2) on stdout.",
    "",
    "  --setup   Force venv setup and model download then exit.",
    "  --batch   Batch mode: read JSON array of strings from stdin,",
    "            output JSON array of vectors (one python process, amortised load).",
    "",
    "On failure: exits 0 with no output → BM25 fallback applies.",
  ].join("\n") + "\n");
  process.exit(0);
}

if (process.argv.includes("--setup")) {
  if (!hasPython3()) {
    process.stderr.write("[wiki-embed] python3 not found — cannot set up venv.\n");
    process.exit(0);
  }
  if (venvReady()) {
    process.stdout.write("status=already_ready\nvenv=" + VENV_DIR + "\n");
    process.exit(0);
  }
  const ok = setupVenv();
  if (ok) {
    // Pre-warm model download
    const python = path.join(VENV_DIR, "bin", "python3");
    spawnSync(python, ["-c", EMBED_PY], {
      input: "warmup",
      env: { ...process.env, AUTOFLOW_EMBED_MODEL_DIR: MODEL_DIR },
      stdio: "pipe",
      timeout: 120000,
    });
    process.stdout.write("status=ok\nvenv=" + VENV_DIR + "\n");
  } else {
    process.stdout.write("status=setup_failed\n");
  }
  process.exit(0);
}

// ─── Ensure venv is ready ────────────────────────────────────────────────────

function ensureVenv(): boolean {
  if (venvReady()) return true;
  if (!hasPython3()) return false;
  return setupVenv();
}

// ─── Read stdin ──────────────────────────────────────────────────────────────

let stdinContent = "";
try {
  stdinContent = fs.readFileSync("/dev/stdin", "utf8");
} catch {
  try {
    const buf: Uint8Array[] = [];
    let chunk: Buffer;
    while ((chunk = process.stdin.read()) !== null) {
      buf.push(chunk);
    }
    stdinContent = Buffer.concat(buf).toString("utf8");
  } catch {}
}

// ─── Batch mode ──────────────────────────────────────────────────────────────

if (process.argv.includes("--batch")) {
  if (!stdinContent.trim()) {
    process.stdout.write(JSON.stringify([]) + "\n");
    process.exit(0);
  }
  if (ensureVenv()) {
    const vecs = embedBatchWithPython(
      (() => {
        try {
          const parsed = JSON.parse(stdinContent);
          return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          return [stdinContent];
        }
      })()
    );
    process.stdout.write(JSON.stringify(vecs) + "\n");
  } else {
    process.stdout.write(JSON.stringify([]) + "\n");
  }
  process.exit(0);
}

// ─── Single-text mode ────────────────────────────────────────────────────────

const text = stdinContent;

if (!text.trim()) {
  process.exit(0);
}

if (ensureVenv()) {
  const vec = embedWithPython(text);
  if (vec) {
    process.stdout.write(JSON.stringify(vec) + "\n");
    process.exit(0);
  }
}

// Fallback: exit 0 silently → BM25 used by caller
process.exit(0);
