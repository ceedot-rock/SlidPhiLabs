/** 24h black box for the npm TRU8 door. Same protocol as the site. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILE = join(homedir(), ".slidphilabs", "blackbox.json");
const BUY = "https://buy.stripe.com/dRmaEY6Jf1T23P78gw6wE0E";

export function assertTru8Box() {
  if (process.env.SPL_UNLOCK === "1") return;
  const dir = join(homedir(), ".slidphilabs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ started: new Date().toISOString(), protocol: "splb-ed25519-24h" }, null, 2), {
      mode: 0o600,
    });
    return;
  }
  const rec = JSON.parse(readFileSync(FILE, "utf8"));
  const hours = (Date.now() - Date.parse(rec.started)) / 3600000;
  if (hours < -1) throw new Error("HALT: clock tamper");
  if (hours >= 24) {
    throw new Error(`black box closed — TRU8 Year $990 ${BUY}`);
  }
}
