/**
 * ACN accounting export — receipts in, CSV out. Pure: no disk, no network.
 * Warrant receipts (usd) + awlpay attestations (amount/fee, accepts[]) +
 * conductor digests (cmd, digest) -> CSV lines + monthly per-operator rollup.
 * Compute-and-mark only: sums and collected flags in memory. Never moves
 * money, never calls a rail, never writes disk.
 */

export const ACN_CSV_HEADER = "type,id,operator,route,amount_cents,fee_cents,at,ref";

export const ACN_ROLLUP_HEADER = "month,operator,lines,amount_cents,fee_cents,routes";

function text(v) {
  return v == null ? "" : String(v);
}

function cents(n) {
  const v = Math.floor(Number(n));
  return Number.isSafeInteger(v) && v > 0 ? v : 0;
}

function monthOf(at) {
  const m = text(at).match(/^(\d{4}-\d{2})/);
  return m ? m[1] : "unknown";
}

/** CSV-escape one cell. */
export function csvCell(v) {
  const s = text(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function acceptsRoute(accepts) {
  if (!Array.isArray(accepts)) return "";
  const nets = accepts.map((a) => text(a && a.network)).filter(Boolean);
  return [...new Set(nets)].sort().join("+");
}

/**
 * Normalize one ACN receipt to a flat row. Unknown shapes -> null (skipped).
 */
export function receiptToRow(r) {
  if (!r || typeof r !== "object") return null;
  const operator = text(r.operator_id || r.operator || r.agent_id) || "unknown";
  const at = text(r.at || r.ts || r.t) || new Date().toISOString();
  if (r.stage === "conductor" || (r.digest != null && r.usd == null && r.amount_cents == null)) {
    const id = text(r.seed || r.id) || "unknown";
    const route = text(r.cmd) || "spl_agentic_run";
    return { type: "conductor", id, operator, route, amount_cents: 0, fee_cents: 0, at, ref: text(r.digest) };
  }
  if (
    text(r.stage).startsWith("awlpay") ||
    r.accepts != null ||
    r.rail != null ||
    r.platform_fee_cents != null
  ) {
    const id = text(r.id || r.receipt_id) || "unknown";
    const route = text(r.rail) || acceptsRoute(r.accepts) || "awlpay";
    const ref = text(r.ref) || acceptsRoute(r.accepts);
    const amount_cents = cents(r.amount_cents);
    const fee_cents = cents(r.platform_fee_cents ?? r.fee_cents);
    return { type: "awlpay", id, operator, route, amount_cents, fee_cents, at, ref };
  }
  if (r.usd != null || r.warrant_id != null) {
    return {
      type: "warrant",
      id: text(r.id) || "unknown",
      operator,
      route: text(r.action) || "invoke",
      amount_cents: cents(Math.round(Number(r.usd) * 100)),
      fee_cents: 0,
      at,
      ref: text(r.warrant_id),
    };
  }
  return null;
}

function rowToCsv(row) {
  const cells = [row.type, row.id, row.operator, row.route, row.amount_cents, row.fee_cents, row.at, row.ref];
  return cells.map(csvCell).join(",");
}

/** Every known receipt as one CSV line under the header. Unknowns skipped. */
export function receiptsToCsv(receipts) {
  const lines = [ACN_CSV_HEADER];
  for (const r of Array.isArray(receipts) ? receipts : []) {
    const row = receiptToRow(r);
    if (row) lines.push(rowToCsv(row));
  }
  return lines.join("\n") + "\n";
}

/**
 * Monthly per-operator rollup: line sums, amount sums, fee sums, and
 * per-route counts. Pure accumulation over normalized rows.
 */
export function rollupByOperatorMonth(receipts) {
  const groups = new Map();
  for (const r of Array.isArray(receipts) ? receipts : []) {
    const row = receiptToRow(r);
    if (!row) continue;
    const month = monthOf(row.at);
    const key = `${month} ${row.operator}`;
    let g = groups.get(key);
    if (!g) {
      g = { month, operator: row.operator, lines: 0, amount_cents: 0, fee_cents: 0, routes: {} };
      groups.set(key, g);
    }
    g.lines += 1;
    g.amount_cents += row.amount_cents;
    g.fee_cents += row.fee_cents;
    g.routes[row.route] = (g.routes[row.route] || 0) + 1;
  }
  return [...groups.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || a.operator.localeCompare(b.operator),
  );
}

function routesCell(routes) {
  return Object.keys(routes).sort().map((k) => `${k}=${routes[k]}`).join(";");
}

/** Rollup groups as CSV under ACN_ROLLUP_HEADER. */
export function rollupToCsv(groups) {
  const lines = [ACN_ROLLUP_HEADER];
  for (const g of Array.isArray(groups) ? groups : []) {
    const cells = [g.month, g.operator, g.lines, g.amount_cents, g.fee_cents, routesCell(g.routes || {})];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

/**
 * Compute-and-mark: normalize, then flag each row collected in memory.
 * Returns copies — inputs are never mutated, no funds move, no I/O.
 */
export function markCollected(receipts, at) {
  const stamp = text(at) || new Date().toISOString();
  const out = [];
  for (const r of Array.isArray(receipts) ? receipts : []) {
    const row = receiptToRow(r);
    if (row) out.push({ ...row, collected: true, collected_at: stamp });
  }
  return out;
}
