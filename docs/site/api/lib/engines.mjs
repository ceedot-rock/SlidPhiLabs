/**
 * Hosted engines on this machine: pulsar, LBR1, Combined GC house, LZ wrap, PAQ wrap.
 * Own wraps only. Combined GC source stays out of the pulsar git tree.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pulsarDecode, pulsarEncode } from "./pulsar-host.mjs";

const execFileP = promisify(execFile);

export function lbBin() {
  return process.env.LB_BIN || join(process.cwd(), "bin", "lb");
}

async function withTemp(raw, fn) {
  const dir = await mkdtemp(join(tmpdir(), "spl-eng-"));
  const inn = join(dir, "in.bin");
  const out = join(dir, "out.bin");
  try {
    await writeFile(inn, raw);
    return await fn(inn, out, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function lbEncode(raw, { timeoutMs = 45_000 } = {}) {
  return withTemp(raw, async (inn, out) => {
    try {
      await execFileP(lbBin(), ["encode", inn, out], {
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      });
      return await readFile(out);
    } catch (e) {
      const msg = String(e.stderr || e.message || e);
      if (/expand-or-fail|ENOENT/i.test(msg)) return null;
      if (e.killed || e.signal === "SIGTERM") return null;
      throw e;
    }
  });
}

export async function lbAware(raw, { timeoutMs = 45_000 } = {}) {
  return withTemp(raw, async (inn, out) => {
    try {
      await execFileP(lbBin(), ["aware", inn, out], {
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      });
      return await readFile(out);
    } catch (e) {
      const msg = String(e.stderr || e.message || e);
      if (/expand-or-fail|ENOENT/i.test(msg)) return null;
      if (e.killed || e.signal === "SIGTERM") return null;
      throw e;
    }
  });
}

export async function lbDecode(blob, { timeoutMs = 45_000 } = {}) {
  return withTemp(blob, async (inn, out) => {
    await execFileP(lbBin(), ["decode", inn, out], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return readFile(out);
  });
}

export { pulsarDecode, pulsarEncode };
