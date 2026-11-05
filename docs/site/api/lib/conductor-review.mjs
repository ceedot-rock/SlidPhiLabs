/**
 * Conductor review 0.1.0 — heuristic review gate for Worker diffs.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic offline default: pure heuristics over the diff text and
 * optional file stats. No models, no network. A real judge plugs in via
 * the injectable llmHook adapter ({ verdict?, findings? }); the null
 * default skips it. Fail-closed envelopes: every entry returns
 * { ok:true, verdict, findings } or { ok:false, error } and never throws
 * on bad input.
 */
export const REVIEW_VERSION = "0.1.0";

export const REVIEW_APPROVE = "approve";
export const REVIEW_REVIEW = "review";
export const REVIEW_BLOCK = "block";

export const REVIEW_MAX_FILES = 10;
export const REVIEW_MAX_ADDITIONS = 500;
export const REVIEW_MAX_DELETIONS = 500;

const TODO_RE = /\b(TODO|FIXME)\b/;
const SECRET_PATTERNS = [
  { name: "secret_sk", re: /sk-[A-Za-z0-9]{8,}/ },
  { name: "secret_ghp", re: /ghp_[A-Za-z0-9]{8,}/ },
  { name: "secret_akia", re: /AKIA[0-9A-Z]{16}/ },
  { name: "secret_private_key", re: /private key/i },
  { name: "secret_password", re: /password\s*[:=]/i },
];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function fail(error) {
  return { ok: false, error };
}

function asLines(diff) {
  return String(diff ?? "").split(/\r?\n/);
}

/** Count added/deleted lines, skipping +++ / --- file headers. */
export function diffStat(diff) {
  let additions = 0;
  let deletions = 0;
  for (const line of asLines(diff)) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) additions += 1;
    else if (line.startsWith("-")) deletions += 1;
  }
  return { additions, deletions };
}

/** Collect file paths from unified-diff headers. Deterministic. */
export function diffFiles(diff) {
  const files = new Set();
  for (const line of asLines(diff)) {
    let m = line.match(/^diff --git a\/(.+?) b\/(.+?)\s*$/);
    if (m) {
      files.add(m[2]);
      continue;
    }
    m = line.match(/^\+\+\+ b\/(.+?)\s*$/);
    if (m) {
      files.add(m[1]);
    }
  }
  return [...files];
}

/**
 * Second-wave secret shapes: cloud key ids, fine-grained PATs, chatops
 * tokens, payment keys, and generic api_key assignments. Combined with
 * SECRET_PATTERNS above, the gate blocks on ten named shapes plus the
 * entropy tripwire below.
 */
const EXTRA_SECRET_PATTERNS = [
  { name: "secret_aws_secret", re: /aws[_-]?secret[_-]?access[_-]?key/i },
  { name: "secret_github_pat", re: /github_pat_[A-Za-z0-9_]{8,}/ },
  { name: "secret_slack", re: /xox[baprs]-[A-Za-z0-9-]{8,}/ },
  { name: "secret_stripe", re: /(?:sk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{8,}/ },
  { name: "secret_api_key", re: /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_.\-]{8,}/i },
];

/** Minimum token length and Shannon entropy (bits/char) for the tripwire. */
export const ENTROPY_TOKEN_MIN_LEN = 40;
export const ENTROPY_BITS_PER_CHAR = 4.2;

/** Shannon entropy in bits per character. Pure. */
export function shannonEntropy(s) {
  const str = String(s || "");
  if (!str) return 0;
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Scan added lines for long high-entropy tokens (probable bearer/key
 * material with no known prefix). Hex digests (<= 4 bits/char) pass;
 * random base62/base64 tokens (~5-6 bits/char) trip. Returns findings.
 */
export function entropyFindings(diff) {
  const findings = [];
  const seen = new Set();
  for (const line of String(diff ?? "").split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const toks = line.match(/[A-Za-z0-9+/=_-]{40,}/g) || [];
    for (const tok of toks) {
      if (tok.length < ENTROPY_TOKEN_MIN_LEN || seen.has(tok)) continue;
      seen.add(tok);
      if (shannonEntropy(tok) >= ENTROPY_BITS_PER_CHAR) {
        findings.push({
          rule: "secret_high_entropy",
          severity: "block",
          message: `possible high-entropy token (${tok.length} chars, ${shannonEntropy(tok).toFixed(2)} bits/char)`,
        });
      }
    }
  }
  return findings;
}

function rank(v) {
  if (v === REVIEW_BLOCK) return 2;
  if (v === REVIEW_REVIEW) return 1;
  return 0;
}

function escalate(current, next) {
  return rank(next) > rank(current) ? next : current;
}

function normalizeFiles(input) {
  if (Array.isArray(input.files)) {
    return input.files
      .filter((f) => isPlainObject(f) || typeof f === "string")
      .map((f) => (typeof f === "string" ? { path: f } : f));
  }
  return null;
}

function heuristicFindings({ diff, files, additions, deletions }) {
  const findings = [];
  let verdict = REVIEW_APPROVE;

  const fileCount = files ? files.length : diffFiles(diff).length;
  if (fileCount > REVIEW_MAX_FILES) {
    verdict = escalate(verdict, REVIEW_REVIEW);
    findings.push({
      rule: "diffstat_files",
      severity: "warn",
      message: `touches ${fileCount} files (limit ${REVIEW_MAX_FILES})`,
      count: fileCount,
      limit: REVIEW_MAX_FILES,
    });
  }
  if (additions > REVIEW_MAX_ADDITIONS) {
    verdict = escalate(verdict, REVIEW_REVIEW);
    findings.push({
      rule: "diffstat_additions",
      severity: "warn",
      message: `adds ${additions} lines (limit ${REVIEW_MAX_ADDITIONS})`,
      count: additions,
      limit: REVIEW_MAX_ADDITIONS,
    });
  }
  if (deletions > REVIEW_MAX_DELETIONS) {
    verdict = escalate(verdict, REVIEW_REVIEW);
    findings.push({
      rule: "diffstat_deletions",
      severity: "warn",
      message: `deletes ${deletions} lines (limit ${REVIEW_MAX_DELETIONS})`,
      count: deletions,
      limit: REVIEW_MAX_DELETIONS,
    });
  }

  const text = String(diff ?? "");
  if (TODO_RE.test(text)) {
    verdict = escalate(verdict, REVIEW_REVIEW);
    findings.push({
      rule: "todo_marker",
      severity: "warn",
      message: "contains TODO/FIXME marker",
    });
  }

  for (const { name, re } of [...SECRET_PATTERNS, ...EXTRA_SECRET_PATTERNS]) {
    if (re.test(text)) {
      verdict = REVIEW_BLOCK;
      findings.push({
        rule: name,
        severity: "block",
        message: `possible secret pattern (${name})`,
      });
    }
  }

  for (const finding of entropyFindings(diff)) {
    verdict = REVIEW_BLOCK;
    findings.push(finding);
  }

  return { verdict, findings };
}

function normalizeHookResult(out) {
  if (!isPlainObject(out)) return null;
  const verdict = out.verdict;
  if (verdict !== undefined && verdict !== REVIEW_APPROVE && verdict !== REVIEW_REVIEW && verdict !== REVIEW_BLOCK) {
    return { error: "llm_hook_bad_verdict" };
  }
  const findings = out.findings === undefined ? [] : out.findings;
  if (!Array.isArray(findings)) return { error: "llm_hook_bad_findings" };
  return { verdict, findings };
}

/**
 * Heuristic review gate (sync). LLM hook must be sync here; async judges
 * use reviewChangesAsync.
 * @param {object} [input] { diff, files?, additions?, deletions? }
 * @param {object} [opts] { llmHook?: null | (ctx) => ({ verdict?, findings? }) }
 */
export function reviewChanges(input = {}, opts = {}) {
  if (!isPlainObject(input)) return fail("invalid_input");
  if (!isPlainObject(opts)) return fail("invalid_opts");
  const { llmHook = null } = opts;
  if (llmHook !== null && typeof llmHook !== "function") return fail("invalid_llm_hook");
  const diff = input.diff === undefined ? "" : input.diff;
  if (typeof diff !== "string") return fail("invalid_diff");

  const files = normalizeFiles(input);
  let additions = input.additions;
  let deletions = input.deletions;
  const stat = diffStat(diff);
  if (additions === undefined) additions = stat.additions;
  if (deletions === undefined) deletions = stat.deletions;
  if (!Number.isSafeInteger(additions) || additions < 0) return fail("invalid_additions");
  if (!Number.isSafeInteger(deletions) || deletions < 0) return fail("invalid_deletions");
  if (files !== null) {
    for (const f of files) {
      if (typeof f.path !== "string" || f.path === "") return fail("invalid_files");
    }
  }

  const { verdict, findings } = heuristicFindings({ diff, files, additions, deletions });
  const merged = [...findings];
  let final = verdict;

  if (llmHook) {
    let out;
    try {
      out = llmHook({ diff, files, additions, deletions, verdict: final, findings: [...merged] });
    } catch {
      merged.push({ rule: "llm_hook_failed", severity: "warn", message: "llm hook threw; kept heuristic verdict" });
      return { ok: true, verdict: final, findings: merged };
    }
    if (out && typeof out.then === "function") {
      merged.push({ rule: "llm_hook_async", severity: "warn", message: "async hook ignored; use reviewChangesAsync" });
      return { ok: true, verdict: final, findings: merged };
    }
    const norm = normalizeHookResult(out);
    if (!norm || norm.error) {
      merged.push({ rule: "llm_hook_invalid", severity: "warn", message: "llm hook bad return; kept heuristic verdict" });
      return { ok: true, verdict: final, findings: merged };
    }
    if (norm.verdict !== undefined) final = escalate(final, norm.verdict);
    for (const f of norm.findings) merged.push(f);
    // A heuristic BLOCK can never be downgraded by the hook.
    if (verdict === REVIEW_BLOCK) final = REVIEW_BLOCK;
  }

  return { ok: true, verdict: final, findings: merged };
}

/**
 * Async review gate. Awaits promise-returning llmHook adapters.
 * With no hook injected the result equals reviewChanges (offline).
 */
export async function reviewChangesAsync(input = {}, opts = {}) {
  if (!isPlainObject(input)) return fail("invalid_input");
  if (!isPlainObject(opts)) return fail("invalid_opts");
  const { llmHook = null } = opts;
  if (llmHook !== null && typeof llmHook !== "function") return fail("invalid_llm_hook");
  const base = reviewChanges(input, { llmHook: null });
  if (!base.ok || !llmHook) return base;

  let out;
  try {
    out = await llmHook({
      diff: typeof input.diff === "string" ? input.diff : "",
      verdict: base.verdict,
      findings: [...base.findings],
    });
  } catch {
    return {
      ok: true,
      verdict: base.verdict,
      findings: [...base.findings, { rule: "llm_hook_failed", severity: "warn", message: "llm hook threw; kept heuristic verdict" }],
    };
  }
  const norm = normalizeHookResult(out);
  if (!norm || norm.error) {
    return {
      ok: true,
      verdict: base.verdict,
      findings: [...base.findings, { rule: "llm_hook_invalid", severity: "warn", message: "llm hook bad return; kept heuristic verdict" }],
    };
  }
  let final = base.verdict;
  if (norm.verdict !== undefined) final = escalate(final, norm.verdict);
  if (base.verdict === REVIEW_BLOCK) final = REVIEW_BLOCK;
  return { ok: true, verdict: final, findings: [...base.findings, ...norm.findings] };
}
