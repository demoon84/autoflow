#!/usr/bin/env npx tsx
/**
 * wiki-embed.ts — Local sentence-transformers embedding provider.
 *
 * Reads text from stdin, outputs a JSON float array (1024-dim, BAAI/bge-m3).
 * Used as AUTOFLOW_WIKI_EMBEDDING_PROVIDER for the vector side of hybrid RAG scoring.
 *
 * Provider chain (first available wins):
 *   1. python3 venv with sentence-transformers (auto-installed on first run)
 *   2. Exit 0 with no output → caller reports vector index/query failure
 *
 * Model: BAAI/bge-m3 (1024-dim, cached after first download)
 * Model cache: user-scope Autoflow cache (override with AUTOFLOW_EMBED_MODEL_DIR)
 * Venv: user-scope Autoflow cache (override with AUTOFLOW_EMBED_MODEL_DIR)
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

const DEFAULT_MODEL_NAME = "BAAI/bge-m3";
const DEFAULT_VECTOR_DIM = 1024;
const MODEL_NAME = process.env.AUTOFLOW_WIKI_EMBED_MODEL
  || process.env.AUTOFLOW_WIKI_VECTOR_MODEL
  || DEFAULT_MODEL_NAME;
const VECTOR_DIM = Number.parseInt(process.env.AUTOFLOW_WIKI_VECTOR_DIM || "", 10) || DEFAULT_VECTOR_DIM;

function positiveIntFromEnv(names: string[], fallback: number): string {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name] || "", 10);
    if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
  }
  return String(fallback);
}

const EMBED_THREADS = positiveIntFromEnv(
  ["AUTOFLOW_WIKI_EMBED_THREADS", "AUTOFLOW_EMBED_THREADS"],
  1,
);
const EMBED_BATCH_SIZE = positiveIntFromEnv(
  ["AUTOFLOW_WIKI_EMBED_BATCH_SIZE", "AUTOFLOW_EMBED_BATCH_SIZE"],
  8,
);

function defaultAutoflowCacheRoot(): string {
  if (process.env.AUTOFLOW_CACHE_ROOT && process.env.AUTOFLOW_CACHE_ROOT.trim()) {
    return path.resolve(process.env.AUTOFLOW_CACHE_ROOT);
  }
  if (process.env.XDG_CACHE_HOME && process.env.XDG_CACHE_HOME.trim()) {
    return path.join(path.resolve(process.env.XDG_CACHE_HOME), "autoflow");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "autoflow");
  }
  return path.join(os.homedir(), ".cache", "autoflow");
}

function resolveModelDir(): string {
  const override =
    process.env.AUTOFLOW_EMBED_MODEL_DIR ||
    process.env.AUTOFLOW_WIKI_EMBED_MODEL_DIR ||
    "";
  if (override.trim()) return path.resolve(override);
  return path.join(defaultAutoflowCacheRoot(), "wiki-embed-models");
}

const MODEL_DIR = resolveModelDir();
const VENV_DIR  = path.join(MODEL_DIR, "venv");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function envOrDefault(name: string, value: string): string {
  const current = process.env[name];
  return current && current.trim() ? current : value;
}

function embeddingPythonEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AUTOFLOW_EMBED_MODEL_DIR: MODEL_DIR,
    AUTOFLOW_WIKI_EMBED_THREADS: EMBED_THREADS,
    AUTOFLOW_WIKI_EMBED_BATCH_SIZE: EMBED_BATCH_SIZE,
    TOKENIZERS_PARALLELISM: envOrDefault("TOKENIZERS_PARALLELISM", "false"),
    OMP_NUM_THREADS: envOrDefault("OMP_NUM_THREADS", EMBED_THREADS),
    OPENBLAS_NUM_THREADS: envOrDefault("OPENBLAS_NUM_THREADS", EMBED_THREADS),
    MKL_NUM_THREADS: envOrDefault("MKL_NUM_THREADS", EMBED_THREADS),
    VECLIB_MAXIMUM_THREADS: envOrDefault("VECLIB_MAXIMUM_THREADS", EMBED_THREADS),
    NUMEXPR_NUM_THREADS: envOrDefault("NUMEXPR_NUM_THREADS", EMBED_THREADS),
  };
}

function emitOutput(text: string): void {
  const outputFile = process.env.AUTOFLOW_WIKI_EMBED_OUTPUT_FILE || "";
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, text);
    return;
  }
  process.stdout.write(text);
}

function tempJsonPath(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

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
    { env: embeddingPythonEnv(), stdio: "pipe", timeout: 30000 }
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
    const python = path.join(VENV_DIR, "bin", "python3");
    const install = spawnSync(
      python,
      ["-m", "pip", "install", "--quiet", "sentence-transformers"],
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
embed_threads = max(1, int(os.environ.get('AUTOFLOW_WIKI_EMBED_THREADS', '1') or '1'))
embed_batch_size = max(1, int(os.environ.get('AUTOFLOW_WIKI_EMBED_BATCH_SIZE', '8') or '8'))
text = sys.stdin.read()
if not text.strip():
    sys.exit(0)

try:
    try:
        import torch
        torch.set_num_threads(embed_threads)
        torch.set_num_interop_threads(1)
    except Exception:
        pass
    from sentence_transformers import SentenceTransformer
    cache = os.path.join(model_dir, 'hf_cache') if model_dir else None
    m = SentenceTransformer('${MODEL_NAME}', cache_folder=cache)
    vec = m.encode(text, show_progress_bar=False, batch_size=embed_batch_size)
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
embed_threads = max(1, int(os.environ.get('AUTOFLOW_WIKI_EMBED_THREADS', '1') or '1'))
embed_batch_size = max(1, int(os.environ.get('AUTOFLOW_WIKI_EMBED_BATCH_SIZE', '8') or '8'))
raw = sys.stdin.read().strip()
if not raw:
    print(json.dumps([]))
    sys.exit(0)

try:
    texts = json.loads(raw)
    if not isinstance(texts, list):
        texts = [texts]
    try:
        import torch
        torch.set_num_threads(embed_threads)
        torch.set_num_interop_threads(1)
    except Exception:
        pass
    from sentence_transformers import SentenceTransformer
    cache = os.path.join(model_dir, 'hf_cache') if model_dir else None
    m = SentenceTransformer('${MODEL_NAME}', cache_folder=cache)
    vecs = m.encode(texts, show_progress_bar=False, batch_size=embed_batch_size)
    out = json.dumps([v.tolist() for v in vecs])
    output_file = os.environ.get('AUTOFLOW_WIKI_EMBED_PY_OUTPUT_FILE', '')
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(out)
            f.write('\\n')
    else:
        print(out)
except Exception as e:
    print(f"embed_batch_error: {e}", file=sys.stderr)
    print(json.dumps([]))
    sys.exit(0)
`;

function embedWithPython(text: string): number[] | null {
  const python = path.join(VENV_DIR, "bin", "python3");
  const r = spawnSync(python, ["-c", EMBED_PY], {
    input: text,
    env: embeddingPythonEnv(),
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
  const pyOutputFile = tempJsonPath("autoflow-wiki-embed-python");
  try {
    const r = spawnSync(python, ["-c", EMBED_BATCH_PY], {
      input: JSON.stringify(texts),
      env: {
        ...embeddingPythonEnv(),
        AUTOFLOW_WIKI_EMBED_PY_OUTPUT_FILE: pyOutputFile,
      },
      stdio: "pipe",
      timeout: Math.max(60000, texts.length * 5000),
      maxBuffer: 4 * 1024 * 1024,
    });
    if (r.status !== 0) return texts.map(() => null);
    const out = fs.existsSync(pyOutputFile)
      ? fs.readFileSync(pyOutputFile, "utf8").trim()
      : r.stdout.toString("utf8").trim();
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
  } finally {
    try {
      fs.rmSync(pyOutputFile, { force: true });
    } catch {}
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--help")) {
  process.stdout.write([
    "wiki-embed.ts — sentence-transformers embedding provider for Autoflow wiki RAG.",
    "",
    "Usage: npx tsx wiki-embed.ts < text.txt",
    "Output: JSON float array (1024-dim BAAI/bge-m3) on stdout.",
    "",
    "  --setup   Force venv setup and model download then exit.",
    "  --batch   Batch mode: read JSON array of strings from stdin,",
    "            output JSON array of vectors (one python process, amortised load).",
    "",
    "On failure: exits 0 with no output; caller reports vector index/query failure.",
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
      env: embeddingPythonEnv(),
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
  stdinContent = fs.readFileSync(0, "utf8");
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
    emitOutput(JSON.stringify([]) + "\n");
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
    emitOutput(JSON.stringify(vecs) + "\n");
  } else {
    emitOutput(JSON.stringify([]) + "\n");
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
    emitOutput(JSON.stringify(vec) + "\n");
    process.exit(0);
  }
}

// No vector could be produced; exit 0 silently so the caller can report it.
process.exit(0);
