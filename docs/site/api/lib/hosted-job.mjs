import { classify, encodeHosted, MAX_RAW } from "./specialist.mjs";
import { addUsage, identityFromReq, meterSnapshot } from "./usage-meter.mjs";

export async function runHostedEncode(req, raw) {
  if (!raw || !raw.length) return { status: 400, body: { ok: false, error: "empty_body" } };
  if (raw.length > MAX_RAW) {
    return { status: 413, body: { ok: false, error: "too_large", max_raw: MAX_RAW } };
  }
  const cls = classify(raw);
  const fill = cls.seat === "fill";
  const usage = meterSnapshot(req, fill ? 0 : raw.length);
  if (!fill && usage.over && usage.would_charge && !usage.would_charge.free) {
    return {
      status: 402,
      body: {
        ok: false,
        error: "paywall",
        plain: usage.would_charge.plain,
        usage,
        buy: {
          gc_month: "https://www.slidphilabs.com/pay?sku=gc-month",
          gc_year: "https://www.slidphilabs.com/pay?sku=gc-year",
        },
      },
    };
  }
  const out = await encodeHosted(raw);
  if (!fill) {
    const id = identityFromReq(req);
    addUsage(id.key, raw.length);
  }
  return { status: 200, body: { ...out, usage: meterSnapshot(req) } };
}
