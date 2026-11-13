/** Off-Fly backup restore drill (LAB50 step 32). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Copies the sales ledger off its volume, restores it into a clean directory,
 * and proves the bytes are identical via SHA-256. Defaults are temp dirs and
 * clearly-labeled DRILL records only — it never touches the live ledger
 * unless SALES_LEDGER_PATH and explicit --source/--backup/--restore dirs
 * are given.
 *
 * Usage:
 *   node docs/site/scripts/backup-drill.mjs [--seed N]
 *     --seed N     write N DRILL records into a temp source volume first
 *   node docs/site/scripts/backup-drill.mjs --source D --backup D --restore D [--seed N]
 *
 * Exit non-zero on any mismatch. Prints the known SHA-256 for the receipt.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordSale } from "../api/lib/sales-ledger.mjs";

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};

const seedN = Math.max(0, Number(opt("--seed", "3")) || 0);
const work = mkdtempSync(join(tmpdir(), "spl-backup-drill-"));
const source = opt("--source", join(work, "volume"));
const backup = opt("--backup", join(work, "offsite"));
const restore = opt("--restore", join(work, "clean-volume"));
for (const d of [source, backup, restore]) mkdirSync(d, { recursive: true });

const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

if (seedN > 0) {
  process.env.SALES_LEDGER_PATH = join(source, "sales.jsonl");
  for (let i = 1; i <= seedN; i++) {
    const r = await recordSale({
      sku: "drill-seat",
      amountCents: 100 * i,
      currency: "usd",
      orderId: `DRILL-${Date.now()}-${i}`,
      rail: "drill",
    });
    if (!r.ok) {
      console.error(`seed record ${i} failed: ${r.error || "unknown"}`);
      process.exit(1);
    }
  }
  console.log(`seeded ${seedN} DRILL records into ${source}`);
}

const live = join(source, "sales.jsonl");
let before;
try {
  before = { sha: sha256File(live), bytes: readFileSync(live).length };
} catch (e) {
  console.error(`cannot read source ledger: ${live}`);
  process.exit(1);
}
console.log(`known SHA-256: ${before.sha} (${before.bytes} bytes)`);

copyFileSync(live, join(backup, "sales.jsonl"));
writeFileSync(join(backup, "manifest.json"),
  JSON.stringify({ file: "sales.jsonl", sha256: before.sha, bytes: before.bytes, at: new Date().toISOString() }, null, 1) + "\n");
console.log(`copied off-volume to ${backup}`);

copyFileSync(join(backup, "sales.jsonl"), join(restore, "sales.jsonl"));
const manifest = JSON.parse(readFileSync(join(backup, "manifest.json"), "utf8"));
const after = sha256File(join(restore, "sales.jsonl"));
if (after !== manifest.sha256 || after !== before.sha) {
  console.error(`MISMATCH: restored ${after} != known ${before.sha}`);
  process.exit(1);
}
console.log(`restored into clean volume; SHA-256 reproduces: ${after}`);
console.log("drill PASSED");
