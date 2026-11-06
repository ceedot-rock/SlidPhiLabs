/** GitForge tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGitForge,
  createMemoryStore,
  createFileStore,
  defaultGitReview,
  createRepo,
  getRepo,
  createBranch,
  recordCommit,
  openPr,
  reviewPr,
  mergePr,
  mergePrAsync,
  forkRepo,
  blame,
  registerWebhook,
  signDelivery,
  verifyDelivery,
  GITFORGE_VERSION,
  GITFORGE_MAX_ADDITIONS,
  PR_OPEN,
  PR_APPROVED,
  PR_CHANGES_REQUESTED,
  PR_MERGED,
} from "./gitforge.mjs";

const TICK = "2026-11-05T00:00:00.000Z";
const fixedClock = () => TICK;
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHORT = "abc1234";

function seeded() {
  const m = createGitForge({ now: fixedClock });
  m.createRepo({ name: "app", owner: "acme" });
  m.createBranch({ repo: "acme/app", branch: "feat/x" });
  return m;
}

test("version pinned", () => assert.equal(GITFORGE_VERSION, "0.1.0"));

test("createRepo happy path, private defaults false", () => {
  const m = createGitForge({ now: fixedClock });
  const r = m.createRepo({ name: "app", owner: "acme" });
  assert.equal(r.ok, true);
  assert.equal(r.repo.full, "acme/app");
  assert.equal(r.repo.private, false);
  assert.equal(r.repo.forked_from, null);
  assert.deepEqual(r.repo.branches, ["main"]);
  const priv = m.createRepo({ name: "vault", owner: "acme", private: true });
  assert.equal(priv.repo.private, true);
});

test("createRepo validation fails closed", () => {
  const m = createGitForge({ now: fixedClock });
  assert.equal(m.createRepo(null).error, "invalid_input");
  assert.equal(m.createRepo("x").error, "invalid_input");
  for (const bad of ["", "has space", "semi;colon", "a".repeat(65), 42]) {
    assert.equal(m.createRepo({ name: bad, owner: "acme" }).error, "invalid_name", String(bad));
  }
  for (const bad of ["", "no/slash", null]) {
    assert.equal(m.createRepo({ name: "app", owner: bad }).error, "invalid_owner", String(bad));
  }
  assert.equal(m.createRepo({ name: "app", owner: "acme", private: "yes" }).error, "invalid_private");
  assert.equal(m.createRepo({ name: "app", owner: "acme" }).ok, true);
  assert.equal(m.createRepo({ name: "app", owner: "acme" }).error, "repo_exists");
});

test("getRepo and listRepos", () => {
  const m = seeded();
  assert.equal(m.getRepo("acme/app").repo.full, "acme/app");
  assert.equal(m.getRepo("acme/nope").error, "not_found");
  assert.equal(m.getRepo("").error, "invalid_repo");
  assert.equal(m.getRepo(null).error, "invalid_repo");
  assert.equal(m.listRepos().length, 1);
});

test("createBranch happy path inherits commits and file state", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "main", sha: SHA_A, author: "amy", message: "init", lines: [{ file: "a.txt", added: 2, removed: 0 }] });
  const r = m.createBranch({ repo: "acme/app", branch: "feat/y" });
  assert.equal(r.ok, true);
  assert.equal(r.from, "main");
  const got = m.blame({ repo: "acme/app", file: "a.txt", branch: "feat/y" });
  assert.equal(got.ok, true);
  assert.equal(got.lines.length, 2);
  assert.deepEqual(m.listBranches("acme/app").branches, ["feat/x", "feat/y", "main"]);
});

test("createBranch validation fails closed", () => {
  const m = seeded();
  assert.equal(m.createBranch(null).error, "invalid_input");
  assert.equal(m.createBranch({ repo: "acme/nope", branch: "b" }).error, "repo_not_found");
  assert.equal(m.createBranch({ repo: "", branch: "b" }).error, "invalid_repo");
  for (const bad of ["", "has space", "a..b", "/lead", "trail/", "a//b", null]) {
    assert.equal(m.createBranch({ repo: "acme/app", branch: bad }).error, "invalid_branch", String(bad));
  }
  assert.equal(m.createBranch({ repo: "acme/app", branch: "b2", from: "nope" }).error, "from_not_found");
  assert.equal(m.createBranch({ repo: "acme/app", branch: "b2", from: "" }).error, "invalid_from");
  assert.equal(m.createBranch({ repo: "acme/app", branch: "feat/x" }).error, "branch_exists");
  assert.equal(m.listBranches("acme/nope").error, "not_found");
});

test("recordCommit happy path and sha rules", () => {
  const m = seeded();
  const base = { repo: "acme/app", branch: "feat/x", author: "amy", message: "work", lines: [{ file: "f", added: 1, removed: 0 }] };
  assert.equal(m.recordCommit({ ...base, sha: SHA_A }).sha, SHA_A);
  assert.equal(m.recordCommit({ ...base, sha: SHORT }).sha, SHORT);
  const upper = m.recordCommit({ ...base, sha: "ABCDEF1" });
  assert.equal(upper.ok, true);
  assert.equal(upper.sha, "abcdef1");
  for (const bad of ["abc", "z".repeat(40), "a".repeat(41), "", null, 42]) {
    assert.equal(m.recordCommit({ ...base, sha: bad }).error, "invalid_sha", String(bad));
  }
  assert.equal(m.recordCommit({ ...base, sha: SHA_A }).error, "commit_exists");
});

test("recordCommit validation fails closed", () => {
  const m = seeded();
  const good = { branch: "feat/x", sha: SHA_A, author: "amy", message: "m", lines: [{ file: "f", added: 1, removed: 0 }] };
  assert.equal(m.recordCommit(null).error, "invalid_input");
  assert.equal(m.recordCommit({ ...good, repo: "acme/nope" }).error, "repo_not_found");
  assert.equal(m.recordCommit({ ...good, repo: "" }).error, "invalid_repo");
  assert.equal(m.recordCommit({ ...good, repo: "acme/app", branch: "nope" }).error, "branch_not_found");
  assert.equal(m.recordCommit({ ...good, repo: "acme/app", branch: "" }).error, "invalid_branch");
  assert.equal(m.recordCommit({ ...good, repo: "acme/app", author: "  " }).error, "invalid_author");
  assert.equal(m.recordCommit({ ...good, repo: "acme/app", author: null }).error, "invalid_author");
  assert.equal(m.recordCommit({ ...good, repo: "acme/app", message: "" }).error, "invalid_message");
  for (const bad of [null, [], [{ file: "", added: 1, removed: 0 }], [{ file: "f", added: -1, removed: 0 }], [{ file: "f", added: 1.5, removed: 0 }], [{ file: "f", added: 1 }], "x"]) {
    assert.equal(m.recordCommit({ ...good, repo: "acme/app", sha: SHA_B, lines: bad }).error, "invalid_lines", JSON.stringify(bad));
  }
  assert.equal(m.getCommit(SHA_A).error, "not_found");
  assert.equal(m.getCommit("").error, "invalid_sha");
});

test("getCommit and listCommits", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_A, author: "amy", message: "init", lines: [{ file: "a.txt", added: 1, removed: 0 }] });
  assert.equal(m.getCommit(SHA_A).commit.author, "amy");
  assert.equal(m.listCommits("acme/app", "feat/x").commits.length, 1);
  assert.equal(m.listCommits("acme/app").commits.length, 1);
  assert.equal(m.listCommits("acme/nope").error, "not_found");
  assert.equal(m.listCommits("acme/app", "nope").error, "branch_not_found");
});

test("openPr happy path with deterministic ids", () => {
  const m = seeded();
  const a = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "ship it" });
  assert.deepEqual(a, { ok: true, pr_id: "pr_0001", status: PR_OPEN });
  const b = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "again" });
  assert.equal(b.pr_id, "pr_0002");
  assert.equal(m.getPr("pr_0001").pr.title, "ship it");
  assert.equal(m.getPr("pr_0001").pr.reviews.length, 0);
});

test("openPr validation fails closed", () => {
  const m = seeded();
  assert.equal(m.openPr(null).error, "invalid_input");
  assert.equal(m.openPr({ repo: "acme/nope", head: "feat/x", base: "main", title: "t" }).error, "repo_not_found");
  assert.equal(m.openPr({ repo: "acme/app", head: "nope", base: "main", title: "t" }).error, "head_not_found");
  assert.equal(m.openPr({ repo: "acme/app", head: "", base: "main", title: "t" }).error, "invalid_head");
  assert.equal(m.openPr({ repo: "acme/app", head: "feat/x", base: "nope", title: "t" }).error, "base_not_found");
  assert.equal(m.openPr({ repo: "acme/app", head: "feat/x", base: "feat/x", title: "t" }).error, "same_branch");
  assert.equal(m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "  " }).error, "invalid_title");
  assert.equal(m.getPr("pr_9999").error, "not_found");
  assert.equal(m.getPr("").error, "invalid_pr_id");
});

test("reviewPr approve and request_changes, flexible input shapes", () => {
  const m = seeded();
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  assert.deepEqual(m.reviewPr(pr_id, { decision: "approve", reviewer: "amy" }), { ok: true, pr_id, status: PR_APPROVED, decision: "approve" });
  assert.deepEqual(m.reviewPr(pr_id, "request_changes"), { ok: true, pr_id, status: PR_CHANGES_REQUESTED, decision: "request_changes" });
  assert.equal(m.reviewPr(pr_id, { approve: true }).status, PR_APPROVED);
  assert.equal(m.reviewPr({ pr: pr_id, request_changes: true }).status, PR_CHANGES_REQUESTED);
  assert.equal(m.getPr(pr_id).pr.reviews.length, 4);
});

test("reviewPr validation fails closed", () => {
  const m = seeded();
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  for (const bad of ["bogus", {}, null, undefined, { decision: "approvee" }, { approve: false }]) {
    assert.equal(m.reviewPr(pr_id, bad).error, "invalid_decision", JSON.stringify(bad));
  }
  assert.equal(m.reviewPr("pr_9999", "approve").error, "not_found");
  assert.equal(m.reviewPr("", "approve").error, "invalid_pr_id");
  assert.equal(m.reviewPr(null, "approve").error, "invalid_pr_id");
  m.reviewPr(pr_id, "approve");
  m.mergePr(pr_id);
  assert.equal(m.reviewPr(pr_id, "approve").error, "already_merged");
});

test("mergePr happy path replays head commits onto base", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_A, author: "amy", message: "one", lines: [{ file: "a.txt", added: 2, removed: 0 }] });
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  assert.equal(m.mergePr(pr_id).error, "not_approved");
  m.reviewPr(pr_id, { decision: "request_changes" });
  assert.equal(m.mergePr(pr_id).error, "not_approved");
  m.reviewPr(pr_id, "approve");
  const done = m.mergePr(pr_id);
  assert.deepEqual(done, { ok: true, pr_id, status: PR_MERGED, commits: 1 });
  assert.equal(m.listCommits("acme/app", "main").commits.length, 1);
  assert.equal(m.mergePr(pr_id).error, "not_approved");
  assert.equal(m.mergePr("pr_9999").error, "not_found");
});

test("mergePr honors the injectable reviewFn gate", () => {
  const m = seeded();
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  m.reviewPr(pr_id, "approve");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => ({ verdict: "block", findings: [] }) }).error, "review_blocked");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => ({ verdict: "review", findings: [] }) }).error, "review_blocked");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => ({ verdict: "bogus" }) }).error, "review_adapter_invalid");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => null }).error, "review_adapter_invalid");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => ({ ok: false, error: "judge_down" }) }).error, "judge_down");
  assert.equal(m.mergePr(pr_id, { reviewFn: () => { throw new Error("down"); } }).error, "review_adapter_failed");
  assert.equal(m.mergePr(pr_id, { reviewFn: async () => ({ verdict: "approve" }) }).error, "review_adapter_async");
  // Manager-level default gate can also block; per-call override wins.
  const strict = createGitForge({ now: fixedClock, reviewFn: () => ({ verdict: "block", findings: [] }) });
  strict.createRepo({ name: "app", owner: "acme" });
  strict.createBranch({ repo: "acme/app", branch: "f" });
  const sp = strict.openPr({ repo: "acme/app", head: "f", base: "main", title: "t" });
  strict.reviewPr(sp.pr_id, "approve");
  assert.equal(strict.mergePr(sp.pr_id).error, "review_blocked");
  assert.equal(strict.mergePr(sp.pr_id, { reviewFn: () => ({ verdict: "approve" }) }).status, PR_MERGED);
});

test("mergePrAsync awaits async judges", async () => {
  const m = seeded();
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  m.reviewPr(pr_id, "approve");
  const done = await m.mergePrAsync(pr_id, { reviewFn: async () => ({ verdict: "approve", findings: [] }) });
  assert.equal(done.status, PR_MERGED);
  const m2 = seeded();
  const p2 = m2.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  m2.reviewPr(p2.pr_id, "approve");
  assert.equal((await m2.mergePrAsync(p2.pr_id, { reviewFn: async () => ({ verdict: "block", findings: [] }) })).error, "review_blocked");
  assert.equal((await m2.mergePrAsync("pr_9999")).error, "not_found");
});

test("default gate blocks oversized PRs even after approval", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_A, author: "amy", message: "huge", lines: [{ file: "big.txt", added: GITFORGE_MAX_ADDITIONS + 1, removed: 0 }] });
  const { pr_id } = m.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  m.reviewPr(pr_id, "approve");
  assert.equal(m.mergePr(pr_id).error, "review_blocked");
  const gate = defaultGitReview({ files: ["a"], additions: 1, deletions: 0 });
  assert.equal(gate.verdict, "approve");
  assert.equal(defaultGitReview({ files: [], additions: 10_000, deletions: 0 }).verdict, "review");
});

test("forkRepo keeps a provenance link and copies history", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "main", sha: SHA_A, author: "amy", message: "init", lines: [{ file: "a.txt", added: 2, removed: 0 }] });
  const f = m.forkRepo({ repo: "acme/app", owner: "bo" });
  assert.equal(f.ok, true);
  assert.equal(f.repo.full, "bo/app");
  assert.equal(f.repo.forked_from, "acme/app");
  assert.equal(m.blame({ repo: "bo/app", file: "a.txt" }).lines.length, 2);
  const named = m.forkRepo({ repo: "acme/app", owner: "bo", name: "app2" });
  assert.equal(named.repo.full, "bo/app2");
});

test("forkRepo validation fails closed", () => {
  const m = seeded();
  assert.equal(m.forkRepo(null).error, "invalid_input");
  assert.equal(m.forkRepo({ repo: "acme/nope", owner: "bo" }).error, "repo_not_found");
  assert.equal(m.forkRepo({ repo: "", owner: "bo" }).error, "invalid_repo");
  assert.equal(m.forkRepo({ repo: "acme/app", owner: "" }).error, "invalid_owner");
  assert.equal(m.forkRepo({ repo: "acme/app", owner: "bo", name: "bad name" }).error, "invalid_name");
  assert.equal(m.forkRepo({ repo: "acme/app", owner: "bo" }).ok, true);
  assert.equal(m.forkRepo({ repo: "acme/app", owner: "bo" }).error, "repo_exists");
});

test("blame attributes lines across commits and removals", () => {
  const m = seeded();
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_A, author: "amy", message: "init", lines: [{ file: "a.txt", added: 3, removed: 0 }] });
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_B, author: "bo", message: "trim", lines: [{ file: "a.txt", added: 1, removed: 1 }] });
  const b = m.blame({ repo: "acme/app", file: "a.txt", branch: "feat/x" });
  assert.equal(b.ok, true);
  assert.deepEqual(b.lines.map((l) => l.line), [1, 2, 3]);
  assert.deepEqual(b.lines.map((l) => l.author), ["amy", "amy", "bo"]);
  // Default branch resolution: main has no a.txt yet.
  assert.equal(m.blame({ repo: "acme/app", file: "a.txt" }).error, "not_found");
  // Emptied file reads as not_found.
  m.recordCommit({ repo: "acme/app", branch: "feat/x", sha: "c".repeat(40), author: "bo", message: "wipe", lines: [{ file: "a.txt", added: 0, removed: 99 }] });
  assert.equal(m.blame({ repo: "acme/app", file: "a.txt", branch: "feat/x" }).error, "not_found");
});

test("blame validation fails closed", () => {
  const m = seeded();
  assert.equal(m.blame(null).error, "invalid_input");
  assert.equal(m.blame({ repo: "acme/nope", file: "a" }).error, "repo_not_found");
  assert.equal(m.blame({ repo: "", file: "a" }).error, "invalid_repo");
  assert.equal(m.blame({ repo: "acme/app", file: "" }).error, "invalid_file");
  assert.equal(m.blame({ repo: "acme/app", file: "a", branch: "nope" }).error, "branch_not_found");
  assert.equal(m.blame({ repo: "acme/app", file: "missing.txt", branch: "main" }).error, "not_found");
});

test("webhook register, sign, and verify round-trip", () => {
  const m = createGitForge({ now: fixedClock });
  const h = m.registerWebhook({ url: "https://ci.example/hook", secret: "topsecret1" });
  assert.deepEqual(h, { ok: true, hook_id: "hook_0001", url: "https://ci.example/hook" });
  const s = m.signDelivery("hook_0001", '{"pr":"pr_0001"}');
  assert.equal(s.ok, true);
  assert.match(s.signature, /^[0-9a-f]{64}$/);
  assert.equal(s.hook_id, "hook_0001");
  assert.deepEqual(m.verifyDelivery({ hook: "hook_0001", payload: '{"pr":"pr_0001"}', signature: s.signature }), { ok: true, hook_id: "hook_0001" });
  assert.deepEqual(m.verifyDelivery('{"pr":"pr_0001"}', s.signature, "hook_0001"), { ok: true, hook_id: "hook_0001" });
  assert.deepEqual(m.verifyDelivery('{"pr":"pr_0001"}', s.signature, "topsecret1"), { ok: true });
  assert.deepEqual(m.verifyDelivery({ payload: '{"pr":"pr_0001"}', signature: s.signature, secret: "topsecret1" }), { ok: true });
  // Secrets never leak through listings.
  assert.deepEqual(m.listWebhooks(), [{ id: "hook_0001", url: "https://ci.example/hook", created_at: TICK }]);
});

test("webhook failures fail closed", () => {
  const m = createGitForge({ now: fixedClock });
  assert.equal(m.registerWebhook(null).error, "invalid_input");
  for (const bad of ["", "ftp://x/y", "not-a-url", null]) {
    assert.equal(m.registerWebhook({ url: bad, secret: "s3cret!!" }).error, "invalid_url", String(bad));
  }
  assert.equal(m.registerWebhook({ url: "https://x.example/h", secret: "" }).error, "invalid_secret");
  const { hook_id } = m.registerWebhook({ url: "https://x.example/h", secret: "s3cret!!" });
  const s = m.signDelivery(hook_id, "ping");
  assert.equal(m.signDelivery("hook_9999", "ping").error, "hook_not_found");
  assert.equal(m.signDelivery(hook_id, 42).error, "invalid_payload");
  assert.equal(m.signDelivery(hook_id).error, "invalid_payload");
  assert.equal(m.verifyDelivery({ hook: hook_id, payload: "pong", signature: s.signature }).error, "bad_signature");
  assert.equal(m.verifyDelivery({ hook: hook_id, payload: "ping", signature: "0".repeat(64) }).error, "bad_signature");
  assert.equal(m.verifyDelivery({ hook: hook_id, payload: "ping", signature: "zzz" }).error, "bad_signature");
  assert.equal(m.verifyDelivery({ hook: "hook_9999", payload: "ping", signature: s.signature }).error, "hook_not_found");
  assert.equal(m.verifyDelivery("ping", s.signature).error, "missing_secret");
  assert.equal(m.verifyDelivery(null).error, "invalid_input");
  assert.equal(m.verifyDelivery({ hook: hook_id, payload: "ping" }).error, "invalid_input");
});

test("file-backed store survives a manager restart via injectable fs", () => {
  const files = new Map();
  const fs = {
    readFile: (p) => {
      if (!files.has(p)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p);
    },
    writeFile: (p, s) => {
      files.set(p, String(s));
    },
    rename: (a, b) => {
      files.set(b, files.get(a));
      files.delete(a);
    },
    mkdir: () => {},
  };
  const a = createGitForge({ store: createFileStore({ path: "gitforge/state.json", fs }), now: fixedClock });
  a.createRepo({ name: "app", owner: "acme" });
  a.createBranch({ repo: "acme/app", branch: "feat/x" });
  a.recordCommit({ repo: "acme/app", branch: "feat/x", sha: SHA_A, author: "amy", message: "init", lines: [{ file: "a.txt", added: 2, removed: 0 }] });
  const pr = a.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t" });
  a.reviewPr(pr.pr_id, "approve");
  a.registerWebhook({ url: "https://x.example/h", secret: "s3cret!!" });
  const b = createGitForge({ store: createFileStore({ path: "gitforge/state.json", fs }), now: fixedClock });
  assert.equal(b.blame({ repo: "acme/app", file: "a.txt", branch: "feat/x" }).lines.length, 2);
  assert.equal(b.getPr("pr_0001").pr.status, PR_APPROVED);
  assert.equal(b.mergePr("pr_0001").status, PR_MERGED);
  assert.equal(b.openPr({ repo: "acme/app", head: "feat/x", base: "main", title: "t2" }).pr_id, "pr_0002");
  assert.equal(b.signDelivery("hook_0001", "ping").ok, true);
});

test("managers are deterministic and isolated; singletons share one store", async () => {
  const a = createGitForge({ now: fixedClock });
  const b = createGitForge({ now: fixedClock });
  for (const m of [a, b]) {
    m.createRepo({ name: "app", owner: "acme" });
    m.createBranch({ repo: "acme/app", branch: "f" });
  }
  assert.equal(a.openPr({ repo: "acme/app", head: "f", base: "main", title: "t" }).pr_id, b.openPr({ repo: "acme/app", head: "f", base: "main", title: "t" }).pr_id);
  const r = createRepo({ name: "singleton-probe", owner: "acme" });
  assert.equal(r.ok, true);
  assert.equal(getRepo("acme/singleton-probe").ok, true);
  const br = createBranch({ repo: "acme/singleton-probe", branch: "s" });
  assert.equal(br.ok, true);
  assert.equal(recordCommit({ repo: "acme/singleton-probe", branch: "s", sha: SHA_A, author: "a", message: "m", lines: [{ file: "f", added: 1, removed: 0 }] }).ok, true);
  const p = openPr({ repo: "acme/singleton-probe", head: "s", base: "main", title: "t" });
  assert.equal(reviewPr(p.pr_id, "approve").status, PR_APPROVED);
  assert.equal(mergePr(p.pr_id).status, PR_MERGED);
  assert.equal((await mergePrAsync(p.pr_id)).error, "not_approved");
  assert.equal(forkRepo({ repo: "acme/singleton-probe", owner: "acme", name: "singleton-fork" }).repo.forked_from, "acme/singleton-probe");
  assert.equal(blame({ repo: "acme/singleton-probe", file: "f" }).lines.length, 1);
  const hook = registerWebhook({ url: "https://x.example/single", secret: "s3cret!!" });
  assert.equal(hook.ok, true);
  const sig = signDelivery(hook.hook_id, "hi");
  assert.equal(verifyDelivery({ hook: hook.hook_id, payload: "hi", signature: sig.signature }).ok, true);
  void createMemoryStore;
  void PR_CHANGES_REQUESTED;
});
