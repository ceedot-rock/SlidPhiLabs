/**
 * Hosted pulsar 2.5.0. GPL-3.0-or-later. Combined GC / LBR1 are not here.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export function pulsarBin() {
  return process.env.PULSAR_BIN || join(process.cwd(), "bin", "pulsar");
}

export async function pulsarEncode(raw, { timeoutMs = 60_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "spl-pulsar-"));
  const inn = join(dir, "in.bin");
  const out = join(dir, "out.pulsar");
  try {
    await writeFile(inn, raw);
    await execFileP(pulsarBin(), ["encode", inn, "-o", out], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return await readFile(out);
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/not compressible/i.test(msg)) return null;
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function pulsarDecode(blob, { timeoutMs = 60_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "spl-pulsar-d-"));
  const inn = join(dir, "in.pulsar");
  const out = join(dir, "out.bin");
  try {
    await writeFile(inn, blob);
    await execFileP(pulsarBin(), ["decode", inn, "-o", out], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function looksPulsar(buf) {
  if (!buf || buf.length < 4) return false;
  const m = buf.subarray(0, 4).toString("latin1");
  return m === "BW23" || m === "BW22" || m === "OZL2" || m === "PZ22";
}
