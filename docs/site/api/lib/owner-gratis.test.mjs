import test from "node:test";
import assert from "node:assert/strict";
import { OWNER_EMAILS, OWNER_AGENT_IDS, normEmail, isOwnerEmail, isOwnerAgent } from "./owner-gratis.mjs";

test("all three known owner emails match", () => {
  for (const e of ["corey@slidphilabs.com", "ceedotrock@gmail.com", "ptasz13@hotmail.com"]) {
    assert.equal(isOwnerEmail(e), true);
  }
});

test("email matching is normalized, strangers fail", () => {
  assert.equal(isOwnerEmail("  Corey@SlidPhiLabs.COM "), true);
  assert.equal(isOwnerEmail(""), false);
  assert.equal(isOwnerEmail("corey@slidphilabs.co"), false);
  assert.equal(isOwnerEmail("admin@slidphilabs.com"), false);
});

test("owner agents: human seat only, workers stay metered", () => {
  assert.equal(isOwnerAgent("2742251400a7dfcd"), true);
  for (const w of ["3b1a784af3ac017e", "e780957911ed8c38", "2d91c86704d7a057", "a8d146b5b2f78172", "5a53cc879ed19bdd", "09ccf71fdc6746e2", "e0eadbff05adda98"]) {
    assert.equal(isOwnerAgent(w), false);
  }
  assert.equal(isOwnerAgent(""), false);
  assert.equal(isOwnerAgent(null), false);
});

test("lists are non-empty and stable", () => {
  assert.equal(OWNER_EMAILS.length, 3);
  assert.equal(OWNER_AGENT_IDS.length, 1);
});
