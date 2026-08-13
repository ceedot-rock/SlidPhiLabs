/**
 * Gun-fire fingerprint store
 * ─────────────────────────────────────────────────────────
 * When a barrel chamber fires, leave a PRINT — never the data.
 * dataset_print_id references that print set for later encode
 * (route / method / residual signature), not a data blob.
 *
 * Residual only · public shape · cadence 33·66·999
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, "../../../lab/fire_prints");
const STORE_FILE = path.join(STORE_DIR, "print_set.json");
const MAX_PRINTS = 500;

/** In-memory print set: id → print record (no payload) */
const prints = new Map();
let loaded = false;

function ensureLoad() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      const list = Array.isArray(raw.prints) ? raw.prints : [];
      for (const p of list) {
        if (p && p.dataset_print_id) prints.set(p.dataset_print_id, p);
      }
    }
  } catch {
    /* empty store */
  }
}

function persist() {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    const list = [...prints.values()]
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, MAX_PRINTS);
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify(
        {
          schema: "spl.fire_print_set.v1",
          law: "store the print set not the data · encode via dataset_print_id",
          n: list.length,
          prints: list,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  } catch {
    /* lab optional on read-only fs */
  }
}

/** FNV-1a 32 over string */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Structural fingerprint of data — residual shape, not content.
 * Uses profile feats + length + sparse sample of int32 histogram buckets.
 */
export function structuralPrint(buf, feats = {}) {
  const n = buf.length || 0;
  const parts = [
    "n=" + n,
    "e=" + (feats.entropy != null ? Number(feats.entropy).toFixed(3) : "?"),
    "z=" + (feats.zero_ratio != null ? Number(feats.zero_ratio).toFixed(3) : "?"),
    "f=" + (feats.float_like != null ? Number(feats.float_like).toFixed(3) : "?"),
    "l=" + (feats.linearity != null ? Number(feats.linearity).toFixed(3) : "?"),
    "p=" + (feats.printable != null ? Number(feats.printable).toFixed(3) : "?"),
    "zw=" + (feats.zrw_score != null ? Number(feats.zrw_score).toFixed(3) : "?"),
  ];
  // Sparse structural sample: every 64th byte class (0/nonzero), not values
  if (Buffer.isBuffer(buf) && n > 0) {
    let nz = 0;
    let samples = 0;
    const stride = Math.max(1, Math.floor(n / 64));
    for (let i = 0; i < n; i += stride) {
      samples++;
      if (buf[i] !== 0) nz++;
    }
    parts.push("nz_frac=" + (samples ? (nz / samples).toFixed(3) : "0"));
    // int32 magnitude class histogram (0 / small / large) — residual class only
    if (n >= 8 && n % 4 === 0) {
      let c0 = 0,
        cS = 0,
        cL = 0;
      const step = Math.max(4, Math.floor(n / 128));
      for (let i = 0; i + 4 <= n; i += step) {
        const v = Math.abs(buf.readInt32LE(i));
        if (v === 0) c0++;
        else if (v < 256) cS++;
        else cL++;
      }
      parts.push("mag=" + c0 + ":" + cS + ":" + cL);
    }
  }
  const material = parts.join("|");
  return {
    structural_fp: fnv1a(material),
    structural_fp_sha: crypto
      .createHash("sha256")
      .update(material)
      .digest("hex")
      .slice(0, 16),
    material_hint: material.slice(0, 200), // public residual shape string, not data
  };
}

/**
 * Record a gun fire — print only (path, method, barrel, structural fp).
 * @returns print record with dataset_print_id
 */
export function recordFirePrint({
  op = "compress",
  path: routePath,
  method,
  barrel,
  feats,
  buf,
  zrw_mode,
  transforms,
} = {}) {
  ensureLoad();
  const struct = structuralPrint(
    Buffer.isBuffer(buf) ? buf : Buffer.alloc(0),
    feats || {},
  );
  const fireKey = [
    op,
    routePath || "?",
    method || "?",
    zrw_mode || "",
    barrel?.loaded || "",
    struct.structural_fp,
  ].join("|");
  const dataset_print_id =
    "dpi_" + fnv1a(fireKey) + crypto.randomBytes(3).toString("hex");

  const print = {
    dataset_print_id,
    schema: "spl.fire_print.v1",
    at: new Date().toISOString(),
    op,
    // THE PRINT SET — no payload
    print_set: {
      path: routePath || null,
      method: method || null,
      zrw_mode: zrw_mode || null,
      transform_types: Array.isArray(transforms)
        ? transforms.map((t) => (t && t.type) || t).filter(Boolean)
        : [],
      barrel_loaded: barrel?.loaded || null,
      barrel_rest: barrel?.rest || null,
      structural_fp: struct.structural_fp,
      structural_fp_sha: struct.structural_fp_sha,
      feats_summary: feats
        ? {
            entropy: feats.entropy,
            zero_ratio: feats.zero_ratio,
            float_like: feats.float_like,
            linearity: feats.linearity,
            zrw_score: feats.zrw_score,
            n: feats.n,
          }
        : null,
      raw_bytes: Buffer.isBuffer(buf) ? buf.length : null,
    },
    // Encode recipe derived from print (not data)
    encode_recipe: {
      route: routePath || "general",
      prefer_method: method || null,
      use_print_id: dataset_print_id,
    },
    law: "fingerprint only · never store the data · encode via dataset_print_id",
  };

  prints.set(dataset_print_id, print);
  // Cap memory
  if (prints.size > MAX_PRINTS) {
    const keys = [...prints.keys()];
    for (let i = 0; i < keys.length - MAX_PRINTS; i++) prints.delete(keys[i]);
  }
  persist();
  return print;
}

/** Lookup print by dataset_print_id */
export function getPrint(dataset_print_id) {
  ensureLoad();
  if (!dataset_print_id) return null;
  return prints.get(String(dataset_print_id)) || null;
}

/**
 * Resolve encode options from dataset_print_id.
 * Forces route/path from print set when found.
 */
export function encodeFromPrintId(dataset_print_id, opts = {}) {
  const print = getPrint(dataset_print_id);
  if (!print) {
    return {
      ok: false,
      error: "print_not_found",
      dataset_print_id,
      opts,
    };
  }
  const ps = print.print_set || {};
  return {
    ok: true,
    dataset_print_id,
    print_set: ps,
    opts: {
      ...opts,
      route: opts.route || ps.path || print.encode_recipe?.route,
      path: opts.path || ps.path,
      dataset_print_id,
      from_print: true,
    },
  };
}

export function listPrints(limit = 20) {
  ensureLoad();
  return [...prints.values()]
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, Math.min(100, limit))
    .map((p) => ({
      dataset_print_id: p.dataset_print_id,
      at: p.at,
      path: p.print_set?.path,
      method: p.print_set?.method,
      structural_fp: p.print_set?.structural_fp,
      raw_bytes: p.print_set?.raw_bytes,
    }));
}

export default {
  structuralPrint,
  recordFirePrint,
  getPrint,
  encodeFromPrintId,
  listPrints,
};
