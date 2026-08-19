/**
 * TruGame rent desk — retired.
 * $3.99 / 7-day SKU is gone. Engine seats only.
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  res.statusCode = 410;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      ok: false,
      retired: true,
      error: "rent_desk_gone",
      message: "The rent desk is retired. TruGame is the engine. No $3.99 / 7-day SKU.",
      buy: {
        month: { sku: "trugame-month", usd: 12, href: "/pay?sku=trugame-month" },
        year: { sku: "trugame-year", usd: 79, href: "/pay?sku=trugame-year" },
        lab_pass: { sku: "lab-pass", usd: 1088, href: "/pay?sku=lab-pass" },
      },
      page: "/trugame",
    })
  );
}
