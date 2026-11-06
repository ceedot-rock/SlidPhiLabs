/**
 * GitForge 0.1.0 — offline git-hosting depth: repos, branches, commits, PRs, forks, blame, webhooks.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Pure deterministic logic: in-memory Map store, counter-based PR/hook ids
 * (pr_0001, hook_0001), injectable now() clock and reviewFn gate. No disk,
 * no network. File persistence plugs in via createFileStore({ path, fs })
 * with an injectable fs surface, mirroring conductor-tasks. Fail-closed
 * envelopes: every entry returns { ok:true, ... } or { ok:false, error }
 * and never throws on bad input.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function defaultFileFs() {
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    rename: (a, b) => renameSync(a, b),
    mkdir: (d) => mkdirSync(d, { recursive: true }),
  };
}

export const GITFORGE_VERSION = "0.1.0";

export const GITFORGE_DEFAULT_BRANCH = "main";
export const GITFORGE_MAX_FILES = 10;
export const GITFORGE_MAX_ADDITIONS = 500;
export const GITFORGE_MAX_DELETIONS = 500;
export const GITFORGE_MAX_COMMIT_LINES = 50000;

export const PR_OPEN = "open";
export const PR_APPROVED = "approved";
export const PR_CHANGES_REQUESTED = "changes_requested";
export const PR_MERGED = "merged";

const REVIEW_DECISIONS = new Set(["approve", "request_changes"]);
const MERGE_VERDICTS = new Set(["approve", "review", "block"]);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,128}$/;
const URL_RE = /^https?:\/\/[^/\s]+(\/\S*)?$/;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function fail(error) {
  return { ok: false, error };
}

function copy(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultNow() {
  return new Date().toISOString();
}

function validCount(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

function validBranchName(v) {
  if (typeof v !== "string" || !BRANCH_RE.test(v)) return false;
  if (v.includes("..") || v.includes("//")) return false;
  if (v.startsWith("/") || v.endsWith("/")) return false;
  return true;
}

function fileKey(repoFull, branch, file) {
  return `${repoFull}\u0000${branch}\u0000${file}`;
}

/** Default in-memory store. Injectable for tests. */
export function createMemoryStore() {
  return {
    prNext: 1,
    hookNext: 1,
    repos: new Map(),
    commits: new Map(),
    files: new Map(),
    prs: new Map(),
    hooks: new Map(),
  };
}

function snapshot(store) {
  return {
    v: 1,
    prNext: store.prNext,
    hookNext: store.hookNext,
    repos: [...store.repos.values()],
    commits: [...store.commits.values()],
    files: [...store.files.entries()].map(([key, val]) => ({ key, lines: val.lines })),
    prs: [...store.prs.values()],
    hooks: [...store.hooks.values()],
  };
}

function restore(store, data) {
  if (!isPlainObject(data)) return false;
  if (!Number.isSafeInteger(data.prNext) || data.prNext < 1) return false;
  if (!Number.isSafeInteger(data.hookNext) || data.hookNext < 1) return false;
  if (
    !Array.isArray(data.repos) ||
    !Array.isArray(data.commits) ||
    !Array.isArray(data.files) ||
    !Array.isArray(data.prs) ||
    !Array.isArray(data.hooks)
  ) {
    return false;
  }
  try {
    store.prNext = data.prNext;
    store.hookNext = data.hookNext;
    store.repos = new Map(data.repos.map((r) => [r.full, r]));
    store.commits = new Map(data.commits.map((c) => [c.sha, c]));
    store.files = new Map(data.files.map((f) => [f.key, { lines: f.lines }]));
    store.prs = new Map(data.prs.map((p) => [p.id, p]));
    store.hooks = new Map(data.hooks.map((h) => [h.id, h]));
  } catch {
    return false;
  }
  return true;
}

/**
 * File-backed store option: same shape as createMemoryStore() plus
 * save()/load(), persisted as one JSON file (atomic tmp + rename).
 * Deterministic offline: the fs surface ({ readFile, writeFile, rename,
 * mkdir }) is injectable so tests never touch disk. load() tolerates a
 * missing file (fresh store); save() never throws.
 */
export function createFileStore({ path, fs = null } = {}) {
  if (typeof path !== "string" || path === "") throw new Error("gitforge: file store path required");
  const io = fs || defaultFileFs();
  const store = createMemoryStore();

  function load() {
    let raw;
    try {
      raw = io.readFile(path);
    } catch (err) {
      if (err && (err.code === "ENOENT" || /no such file/i.test(String(err && err.message)))) {
        return { ok: true, loaded: 0 };
      }
      return { ok: false, error: "read_error" };
    }
    let parsed;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return { ok: false, error: "corrupt_store" };
    }
    if (!restore(store, parsed)) return { ok: false, error: "corrupt_store" };
    return { ok: true, loaded: store.repos.size };
  }

  function save() {
    try {
      try {
        io.mkdir(dirname(path));
      } catch {
        /* best-effort: parent may already exist */
      }
      const raw = JSON.stringify(snapshot(store));
      const tmp = `${path}.tmp`;
      io.writeFile(tmp, raw);
      io.rename(tmp, path);
    } catch {
      return { ok: false, error: "write_error" };
    }
    return { ok: true };
  }

  store.path = path;
  store.load = load;
  store.save = save;
  return store;
}

function persist(store) {
  try {
    if (store && typeof store.save === "function") store.save();
  } catch {
    /* persistence is best-effort: the in-memory write already landed */
  }
}

function ensureMaps(store) {
  if (!store.repos) store.repos = new Map();
  if (!store.commits) store.commits = new Map();
  if (!store.files) store.files = new Map();
  if (!store.prs) store.prs = new Map();
  if (!store.hooks) store.hooks = new Map();
  if (!Number.isSafeInteger(store.prNext) || store.prNext < 1) store.prNext = 1;
  if (!Number.isSafeInteger(store.hookNext) || store.hookNext < 1) store.hookNext = 1;
}

/**
 * Default offline review gate, conductor-review-style: stat limits over the
 * PR's fresh commits (files, additions, deletions). Pure and deterministic.
 * Returns { verdict, findings }; only "approve" lets mergePr merge.
 */
export function defaultGitReview(ctx = {}) {
  const files = Array.isArray(ctx.files) ? ctx.files : [];
  const additions = ctx.additions ?? 0;
  const deletions = ctx.deletions ?? 0;
  const findings = [];
  let verdict = "approve";
  if (files.length > GITFORGE_MAX_FILES) {
    verdict = "review";
    findings.push({
      rule: "diffstat_files",
      severity: "warn",
      message: `touches ${files.length} files (limit ${GITFORGE_MAX_FILES})`,
    });
  }
  if (additions > GITFORGE_MAX_ADDITIONS) {
    verdict = "review";
    findings.push({
      rule: "diffstat_additions",
      severity: "warn",
      message: `adds ${additions} lines (limit ${GITFORGE_MAX_ADDITIONS})`,
    });
  }
  if (deletions > GITFORGE_MAX_DELETIONS) {
    verdict = "review";
    findings.push({
      rule: "diffstat_deletions",
      severity: "warn",
      message: `deletes ${deletions} lines (limit ${GITFORGE_MAX_DELETIONS})`,
    });
  }
  return { verdict, findings };
}

function publicRepo(repo) {
  return {
    name: repo.name,
    owner: repo.owner,
    full: repo.full,
    private: repo.private,
    created_at: repo.created_at,
    forked_from: repo.forked_from,
    defaultBranch: repo.defaultBranch,
    branches: Object.keys(repo.branches).sort(),
  };
}

function lookupRepo(store, ref) {
  if (typeof ref !== "string" || ref === "") return null;
  return store.repos.get(ref) || null;
}

function applyLines(store, repoFull, branchName, sha, lines) {
  for (const { file, added, removed } of lines) {
    const key = fileKey(repoFull, branchName, file);
    let cur = store.files.get(key);
    if (!cur) {
      cur = { lines: [] };
      store.files.set(key, cur);
    }
    if (removed > 0) cur.lines.splice(Math.max(0, cur.lines.length - removed), removed);
    for (let i = 0; i < added; i++) cur.lines.push(sha);
  }
}

function validLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  for (const entry of lines) {
    if (!isPlainObject(entry)) return false;
    if (typeof entry.file !== "string" || entry.file === "" || entry.file.includes("\u0000")) return false;
    if (!validCount(entry.added) || !validCount(entry.removed)) return false;
    if (entry.added > GITFORGE_MAX_COMMIT_LINES || entry.removed > GITFORGE_MAX_COMMIT_LINES) return false;
  }
  return true;
}

/**
 * Create a GitForge manager (pure state machine + commit ledger + PRs).
 * @param {object} [opts]
 * @param {object} [opts.store] injectable store from createMemoryStore().
 * @param {string} [opts.storePath] file-store path (uses createFileStore).
 * @param {object} [opts.fs] injectable fs surface for the file store.
 * @param {function} [opts.now] injectable clock () => ISO string.
 * @param {function} [opts.reviewFn] injectable merge gate (ctx) => ({ verdict, findings? }).
 */
export function createGitForge(opts = {}) {
  if (!isPlainObject(opts)) opts = {};
  const store =
    opts.store ||
    (opts.storePath ? createFileStore({ path: opts.storePath, fs: opts.fs || null }) : createMemoryStore());
  if (typeof store.load === "function") {
    try {
      store.load();
    } catch {
      /* corrupt store surfaces on save; manager still serves memory */
    }
  }
  ensureMaps(store);
  const now = typeof opts.now === "function" ? opts.now : defaultNow;
  const managerReviewFn = typeof opts.reviewFn === "function" ? opts.reviewFn : defaultGitReview;

  function createRepo(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const { name, owner } = input;
    const priv = input.private === undefined ? false : input.private;
    if (typeof name !== "string" || !NAME_RE.test(name)) return fail("invalid_name");
    if (typeof owner !== "string" || !NAME_RE.test(owner)) return fail("invalid_owner");
    if (typeof priv !== "boolean") return fail("invalid_private");
    const full = `${owner}/${name}`;
    if (store.repos.has(full)) return fail("repo_exists");
    const repo = {
      name,
      owner,
      full,
      private: priv,
      created_at: now(),
      forked_from: null,
      defaultBranch: GITFORGE_DEFAULT_BRANCH,
      branches: { [GITFORGE_DEFAULT_BRANCH]: { name: GITFORGE_DEFAULT_BRANCH, commits: [] } },
    };
    store.repos.set(full, repo);
    persist(store);
    return { ok: true, repo: copy(publicRepo(repo)) };
  }

  function getRepo(ref) {
    const repo = lookupRepo(store, ref);
    if (!repo) return fail(typeof ref === "string" && ref !== "" ? "not_found" : "invalid_repo");
    return { ok: true, repo: copy(publicRepo(repo)) };
  }

  function listRepos() {
    return [...store.repos.values()].map((r) => copy(publicRepo(r)));
  }

  function createBranch(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const repo = lookupRepo(store, input.repo);
    if (!repo) return fail(typeof input.repo === "string" && input.repo !== "" ? "repo_not_found" : "invalid_repo");
    if (!validBranchName(input.branch)) return fail("invalid_branch");
    const from = input.from === undefined ? repo.defaultBranch : input.from;
    if (!validBranchName(from)) return fail("invalid_from");
    const src = repo.branches[from];
    if (!src) return fail("from_not_found");
    if (repo.branches[input.branch]) return fail("branch_exists");
    repo.branches[input.branch] = { name: input.branch, commits: [...src.commits] };
    for (const [key, val] of store.files) {
      const prefix = repo.full + "\u0000" + from + "\u0000";
      if (key.startsWith(prefix)) {
        const file = key.slice(prefix.length);
        store.files.set(fileKey(repo.full, input.branch, file), { lines: [...val.lines] });
      }
    }
    persist(store);
    return { ok: true, repo: repo.full, branch: input.branch, from };
  }

  function listBranches(ref) {
    const repo = lookupRepo(store, ref);
    if (!repo) return fail(typeof ref === "string" && ref !== "" ? "not_found" : "invalid_repo");
    return { ok: true, repo: repo.full, branches: Object.keys(repo.branches).sort() };
  }

  function recordCommit(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const repo = lookupRepo(store, input.repo);
    if (!repo) return fail(typeof input.repo === "string" && input.repo !== "" ? "repo_not_found" : "invalid_repo");
    const branch = typeof input.branch === "string" ? repo.branches[input.branch] : null;
    if (!branch) {
      return fail(
        typeof input.branch === "string" && input.branch !== "" ? "branch_not_found" : "invalid_branch"
      );
    }
    if (typeof input.sha !== "string" || !SHA_RE.test(input.sha)) return fail("invalid_sha");
    const sha = input.sha.toLowerCase();
    if (store.commits.has(sha)) return fail("commit_exists");
    if (typeof input.author !== "string" || input.author.trim() === "") return fail("invalid_author");
    if (typeof input.message !== "string" || input.message.trim() === "") return fail("invalid_message");
    if (!validLines(input.lines)) return fail("invalid_lines");
    const commit = {
      repo: repo.full,
      branch: branch.name,
      sha,
      author: input.author,
      message: input.message,
      lines: copy(input.lines),
      seq: branch.commits.length + 1,
      at: now(),
    };
    store.commits.set(sha, commit);
    branch.commits.push(sha);
    applyLines(store, repo.full, branch.name, sha, commit.lines);
    persist(store);
    return { ok: true, sha, repo: repo.full, branch: branch.name, seq: commit.seq };
  }

  function getCommit(sha) {
    if (typeof sha !== "string" || sha === "") return fail("invalid_sha");
    const commit = store.commits.get(sha.toLowerCase());
    if (!commit) return fail("not_found");
    return { ok: true, commit: copy(commit) };
  }

  function listCommits(ref, branchName) {
    const repo = lookupRepo(store, ref);
    if (!repo) return fail(typeof ref === "string" && ref !== "" ? "not_found" : "invalid_repo");
    if (branchName !== undefined) {
      const branch = typeof branchName === "string" ? repo.branches[branchName] : null;
      if (!branch) return fail("branch_not_found");
      return {
        ok: true,
        repo: repo.full,
        branch: branch.name,
        commits: branch.commits.map((s) => copy(store.commits.get(s))).filter(Boolean),
      };
    }
    return {
      ok: true,
      repo: repo.full,
      commits: [...store.commits.values()].filter((c) => c.repo === repo.full).map(copy),
    };
  }

  function nextPrId() {
    const n = store.prNext;
    store.prNext = n + 1;
    return `pr_${String(n).padStart(4, "0")}`;
  }

  function resolvePrRef(a, b) {
    if (typeof a === "string") return { id: a, input: b };
    if (isPlainObject(a)) {
      const id = a.pr ?? a.pr_id ?? a.prId ?? a.id ?? null;
      if (typeof id === "string") {
        if (b !== undefined) return { id, input: b };
        const { pr, pr_id, prId, id: _drop, ...rest } = a;
        void _drop;
        return { id, input: Object.keys(rest).length > 0 ? rest : undefined };
      }
    }
    return { id: null, input: b };
  }

  function lookupPr(id) {
    if (typeof id !== "string" || id === "") return null;
    return store.prs.get(id) || null;
  }

  function openPr(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const repo = lookupRepo(store, input.repo);
    if (!repo) return fail(typeof input.repo === "string" && input.repo !== "" ? "repo_not_found" : "invalid_repo");
    if (typeof input.head !== "string" || !repo.branches[input.head]) {
      return fail(typeof input.head === "string" && input.head !== "" ? "head_not_found" : "invalid_head");
    }
    if (typeof input.base !== "string" || !repo.branches[input.base]) {
      return fail(typeof input.base === "string" && input.base !== "" ? "base_not_found" : "invalid_base");
    }
    if (input.head === input.base) return fail("same_branch");
    if (typeof input.title !== "string" || input.title.trim() === "") return fail("invalid_title");
    const id = nextPrId();
    const pr = {
      id,
      repo: repo.full,
      head: input.head,
      base: input.base,
      title: input.title,
      status: PR_OPEN,
      reviews: [],
      created_at: now(),
      merged_at: null,
    };
    store.prs.set(id, pr);
    persist(store);
    return { ok: true, pr_id: id, status: pr.status };
  }

  function getPr(ref) {
    const { id } = resolvePrRef(ref);
    const pr = lookupPr(id);
    if (!pr) return fail(typeof id === "string" && id !== "" ? "not_found" : "invalid_pr_id");
    return { ok: true, pr: copy(pr) };
  }

  function listPrs(ref) {
    if (ref === undefined) return [...store.prs.values()].map(copy);
    const repo = lookupRepo(store, ref);
    if (!repo) return fail(typeof ref === "string" && ref !== "" ? "not_found" : "invalid_repo");
    return { ok: true, repo: repo.full, prs: [...store.prs.values()].filter((p) => p.repo === repo.full).map(copy) };
  }

  function parseDecision(input) {
    if (typeof input === "string") return REVIEW_DECISIONS.has(input) ? input : null;
    if (!isPlainObject(input)) return null;
    if (typeof input.decision === "string" && REVIEW_DECISIONS.has(input.decision)) return input.decision;
    if (typeof input.verdict === "string" && REVIEW_DECISIONS.has(input.verdict)) return input.verdict;
    if (input.approve === true) return "approve";
    if (input.request_changes === true) return "request_changes";
    return null;
  }

  function reviewPr(a, b) {
    const { id, input } = resolvePrRef(a, b);
    const pr = lookupPr(id);
    if (!pr) return fail(typeof id === "string" && id !== "" ? "not_found" : "invalid_pr_id");
    if (pr.status === PR_MERGED) return fail("already_merged");
    const decision = parseDecision(input);
    if (!decision) return fail("invalid_decision");
    const reviewer = isPlainObject(input) && typeof input.reviewer === "string" ? input.reviewer : "";
    pr.reviews.push({ decision, reviewer, at: now() });
    pr.status = decision === "approve" ? PR_APPROVED : PR_CHANGES_REQUESTED;
    persist(store);
    return { ok: true, pr_id: pr.id, status: pr.status, decision };
  }

  /** Fresh head commits not yet in base, plus aggregate file stats. */
  function prStats(pr) {
    const repo = store.repos.get(pr.repo);
    const head = repo ? repo.branches[pr.head] : null;
    const base = repo ? repo.branches[pr.base] : null;
    if (!repo || !head || !base) return null;
    const baseSet = new Set(base.commits);
    const fresh = head.commits.filter((s) => !baseSet.has(s));
    let additions = 0;
    let deletions = 0;
    const files = new Set();
    for (const sha of fresh) {
      const c = store.commits.get(sha);
      if (!c) continue;
      for (const l of c.lines) {
        files.add(l.file);
        additions += l.added;
        deletions += l.removed;
      }
    }
    return { commits: fresh, files: [...files].sort(), additions, deletions };
  }

  function normalizeReviewOut(out) {
    if (!isPlainObject(out)) return { error: "review_adapter_invalid" };
    if (out.ok === false) return { error: out.error || "review_failed" };
    const verdict = out.verdict === undefined ? "approve" : out.verdict;
    if (!MERGE_VERDICTS.has(verdict)) return { error: "review_adapter_invalid" };
    if (verdict !== "approve") {
      return { error: "review_blocked", verdict, findings: Array.isArray(out.findings) ? out.findings : [] };
    }
    return { ok: true, verdict, findings: Array.isArray(out.findings) ? out.findings : [] };
  }

  function gateFor(callOpts) {
    if (typeof callOpts === "function") return callOpts;
    if (isPlainObject(callOpts) && typeof callOpts.reviewFn === "function") return callOpts.reviewFn;
    return managerReviewFn;
  }

  function checkMergeable(pr, callOpts) {
    if (pr.status !== PR_APPROVED) return { error: "not_approved", status: pr.status };
    const stats = prStats(pr);
    if (!stats) return { error: "unknown_branch" };
    const ctx = { pr: copy(pr), files: stats.files, additions: stats.additions, deletions: stats.deletions, commits: [...stats.commits] };
    let out;
    try {
      out = gateFor(callOpts)(ctx);
    } catch {
      return { error: "review_adapter_failed" };
    }
    if (out && typeof out.then === "function") return { error: "review_adapter_async" };
    return { ...normalizeReviewOut(out), stats };
  }

  function applyMerge(pr, stats) {
    const repo = store.repos.get(pr.repo);
    const base = repo.branches[pr.base];
    for (const sha of stats.commits) {
      if (base.commits.includes(sha)) continue;
      const c = store.commits.get(sha);
      base.commits.push(sha);
      if (c) applyLines(store, repo.full, base.name, sha, c.lines);
    }
    pr.status = PR_MERGED;
    pr.merged_at = now();
    persist(store);
    return { ok: true, pr_id: pr.id, status: pr.status, commits: stats.commits.length };
  }

  function mergePr(a, b) {
    const { id, input } = resolvePrRef(a, b);
    const pr = lookupPr(id);
    if (!pr) return fail(typeof id === "string" && id !== "" ? "not_found" : "invalid_pr_id");
    const gate = isPlainObject(input) && input.reviewFn !== undefined ? input : b;
    const checked = checkMergeable(pr, gate);
    if (!checked.ok) return fail(checked.error);
    return applyMerge(pr, checked.stats);
  }

  async function mergePrAsync(a, b) {
    const { id, input } = resolvePrRef(a, b);
    const pr = lookupPr(id);
    if (!pr) return fail(typeof id === "string" && id !== "" ? "not_found" : "invalid_pr_id");
    if (pr.status !== PR_APPROVED) return fail("not_approved");
    const stats = prStats(pr);
    if (!stats) return fail("unknown_branch");
    const gate = isPlainObject(input) && input.reviewFn !== undefined ? input : b;
    const ctx = { pr: copy(pr), files: stats.files, additions: stats.additions, deletions: stats.deletions, commits: [...stats.commits] };
    let out;
    try {
      out = await gateFor(gate)(ctx);
    } catch {
      return fail("review_adapter_failed");
    }
    const norm = normalizeReviewOut(out);
    if (!norm.ok) return fail(norm.error);
    return applyMerge(pr, stats);
  }

  function forkRepo(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const src = lookupRepo(store, input.repo);
    if (!src) return fail(typeof input.repo === "string" && input.repo !== "" ? "repo_not_found" : "invalid_repo");
    if (typeof input.owner !== "string" || !NAME_RE.test(input.owner)) return fail("invalid_owner");
    const name = input.name === undefined ? src.name : input.name;
    if (typeof name !== "string" || !NAME_RE.test(name)) return fail("invalid_name");
    const full = `${input.owner}/${name}`;
    if (store.repos.has(full)) return fail("repo_exists");
    const branches = {};
    for (const [bname, b] of Object.entries(src.branches)) {
      branches[bname] = { name: bname, commits: [...b.commits] };
    }
    const fork = {
      name,
      owner: input.owner,
      full,
      private: typeof src.private === "boolean" ? src.private : false,
      created_at: now(),
      forked_from: src.full,
      defaultBranch: src.defaultBranch,
      branches,
    };
    store.repos.set(full, fork);
    for (const [key, val] of store.files) {
      if (key.startsWith(src.full + "\u0000")) {
        const rest = key.slice(src.full.length + 1);
        store.files.set(full + "\u0000" + rest, { lines: [...val.lines] });
      }
    }
    persist(store);
    return { ok: true, repo: copy(publicRepo(fork)) };
  }

  function nextHookId() {
    const n = store.hookNext;
    store.hookNext = n + 1;
    return `hook_${String(n).padStart(4, "0")}`;
  }

  function lookupHook(id) {
    if (typeof id !== "string" || id === "") return null;
    return store.hooks.get(id) || null;
  }

  function registerWebhook(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    if (typeof input.url !== "string" || !URL_RE.test(input.url)) return fail("invalid_url");
    if (typeof input.secret !== "string" || input.secret === "") return fail("invalid_secret");
    const id = nextHookId();
    store.hooks.set(id, { id, url: input.url, secret: input.secret, created_at: now() });
    persist(store);
    return { ok: true, hook_id: id, url: input.url };
  }

  function listWebhooks() {
    return [...store.hooks.values()].map((h) => ({ id: h.id, url: h.url, created_at: h.created_at }));
  }

  function payloadBytes(payload) {
    if (Buffer.isBuffer(payload)) return payload;
    if (typeof payload === "string") return Buffer.from(payload, "utf8");
    if (isPlainObject(payload) || Array.isArray(payload)) {
      try {
        return Buffer.from(JSON.stringify(payload), "utf8");
      } catch {
        return null;
      }
    }
    return null;
  }

  function hmacHex(secret, bytes) {
    return createHmac("sha256", secret).update(bytes).digest("hex");
  }

  /**
   * Sign a delivery payload with a hook secret (HMAC-SHA256 hex).
   * Forms: signDelivery(hookId, payload), signDelivery({ hook, payload }),
   * signDelivery({ secret, payload }). Never echoes the secret back.
   */
  function signDelivery(a, b) {
    let ref = a;
    let payload = b;
    if (isPlainObject(a) && b === undefined) {
      payload = a.payload !== undefined ? a.payload : a.body;
      const id = a.hook ?? a.hook_id ?? a.hookId ?? a.id ?? null;
      ref = typeof id === "string" ? id : typeof a.secret === "string" ? a : null;
    }
    if (payload === undefined) return fail("invalid_payload");
    let secret;
    let hook_id = null;
    if (typeof ref === "string") {
      const h = lookupHook(ref);
      if (!h) return fail("hook_not_found");
      secret = h.secret;
      hook_id = h.id;
    } else if (isPlainObject(ref) && typeof ref.secret === "string" && ref.secret !== "") {
      secret = ref.secret;
    } else {
      return fail("invalid_hook");
    }
    const bytes = payloadBytes(payload);
    if (!bytes) return fail("invalid_payload");
    return { ok: true, hook_id, signature: hmacHex(secret, bytes), payload: bytes.toString("utf8") };
  }

  /**
   * Verify a delivery with timing-safe compare.
   * Forms: verifyDelivery({ hook, payload, signature }),
   * verifyDelivery({ payload, signature, secret }),
   * verifyDelivery(payload, signature, hookIdOrSecret).
   * Returns { ok:true, hook_id? } or { ok:false, error }.
   */
  function verifyDelivery(a, b, c) {
    let ref;
    let payload;
    let signature;
    if (b === undefined && c === undefined) {
      if (!isPlainObject(a)) return fail("invalid_input");
      payload = a.payload !== undefined ? a.payload : a.body;
      signature = a.signature ?? a.sig ?? null;
      if (payload === undefined || typeof signature !== "string") return fail("invalid_input");
      const id = a.hook ?? a.hook_id ?? a.hookId ?? a.id ?? null;
      if (typeof id === "string") ref = { mode: "hook", id };
      else if (typeof a.secret === "string" && a.secret !== "") ref = { mode: "secret", secret: a.secret };
      else return fail("invalid_hook");
    } else {
      payload = a;
      signature = b;
      if (typeof signature !== "string") return fail("invalid_input");
      if (c === undefined || c === null) return fail("missing_secret");
      if (typeof c === "string" && lookupHook(c)) ref = { mode: "hook", id: c };
      else if (typeof c === "string") ref = { mode: "secret", secret: c };
      else if (isPlainObject(c)) {
        const id = c.hook ?? c.hook_id ?? c.hookId ?? c.id ?? null;
        if (typeof id === "string") ref = { mode: "hook", id };
        else if (typeof c.secret === "string" && c.secret !== "") ref = { mode: "secret", secret: c.secret };
        else return fail("invalid_hook");
      } else return fail("invalid_hook");
    }
    let secret;
    let hook_id = null;
    if (ref.mode === "hook") {
      const h = lookupHook(ref.id);
      if (!h) return fail("hook_not_found");
      secret = h.secret;
      hook_id = h.id;
    } else {
      secret = ref.secret;
    }
    if (typeof secret !== "string" || secret === "") return fail("missing_secret");
    const bytes = payloadBytes(payload);
    if (!bytes) return fail("invalid_payload");
    if (!/^[0-9a-f]{64}$/i.test(signature)) return fail("bad_signature");
    let got;
    try {
      got = Buffer.from(signature, "hex");
    } catch {
      return fail("bad_signature");
    }
    const expect = createHmac("sha256", secret).update(bytes).digest();
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return fail("bad_signature");
    return hook_id ? { ok: true, hook_id } : { ok: true };
  }

  function blame(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const repo = lookupRepo(store, input.repo);
    if (!repo) return fail(typeof input.repo === "string" && input.repo !== "" ? "repo_not_found" : "invalid_repo");
    if (typeof input.file !== "string" || input.file === "") return fail("invalid_file");
    const branchName = input.branch === undefined ? repo.defaultBranch : input.branch;
    const branch = typeof branchName === "string" ? repo.branches[branchName] : null;
    if (!branch) return fail("branch_not_found");
    const state = store.files.get(fileKey(repo.full, branch.name, input.file));
    if (!state || state.lines.length === 0) return fail("not_found");
    const lines = state.lines.map((sha, idx) => {
      const c = store.commits.get(sha);
      return { line: idx + 1, sha, author: c ? c.author : "" };
    });
    return { ok: true, repo: repo.full, branch: branch.name, file: input.file, lines };
  }

  return {
    createRepo,
    getRepo,
    listRepos,
    createBranch,
    listBranches,
    recordCommit,
    getCommit,
    listCommits,
    openPr,
    getPr,
    listPrs,
    reviewPr,
    mergePr,
    mergePrAsync,
    forkRepo,
    blame,
    registerWebhook,
    listWebhooks,
    signDelivery,
    verifyDelivery,
    store,
  };
}

const DEFAULT_FORGE = createGitForge();

/** Singleton-backed shortcuts over the default in-memory store. */
export function createRepo(input) {
  return DEFAULT_FORGE.createRepo(input);
}

export function getRepo(ref) {
  return DEFAULT_FORGE.getRepo(ref);
}

export function listRepos() {
  return DEFAULT_FORGE.listRepos();
}

export function createBranch(input) {
  return DEFAULT_FORGE.createBranch(input);
}

export function listBranches(ref) {
  return DEFAULT_FORGE.listBranches(ref);
}

export function recordCommit(input) {
  return DEFAULT_FORGE.recordCommit(input);
}

export function getCommit(sha) {
  return DEFAULT_FORGE.getCommit(sha);
}

export function listCommits(ref, branch) {
  return DEFAULT_FORGE.listCommits(ref, branch);
}

export function openPr(input) {
  return DEFAULT_FORGE.openPr(input);
}

export function getPr(ref) {
  return DEFAULT_FORGE.getPr(ref);
}

export function listPrs(ref) {
  return DEFAULT_FORGE.listPrs(ref);
}

export function reviewPr(a, b) {
  return DEFAULT_FORGE.reviewPr(a, b);
}

export function mergePr(a, b) {
  return DEFAULT_FORGE.mergePr(a, b);
}

export function mergePrAsync(a, b) {
  return DEFAULT_FORGE.mergePrAsync(a, b);
}

export function forkRepo(input) {
  return DEFAULT_FORGE.forkRepo(input);
}

export function blame(input) {
  return DEFAULT_FORGE.blame(input);
}

export function registerWebhook(input) {
  return DEFAULT_FORGE.registerWebhook(input);
}

export function listWebhooks() {
  return DEFAULT_FORGE.listWebhooks();
}

export function signDelivery(a, b) {
  return DEFAULT_FORGE.signDelivery(a, b);
}

export function verifyDelivery(a, b, c) {
  return DEFAULT_FORGE.verifyDelivery(a, b, c);
}
