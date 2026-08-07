#!/usr/bin/env node
/**
 * SPL Pay Per Suite CLI
 *   spl-pps quote --bytes 1048576 --class zeros --product zrw --op compress
 *   spl-pps quote ./data.bin
 *   spl-pps pay --bytes ... [--email you@x.com]
 *   spl-pps job --email you@x.com --paid --file data.bin
 *   spl-pps mcp   (hint: run MCP server)
 */
import {
  computeQuote,
  quoteRemote,
  createCheckout,
  submitJob,
  quoteFile,
  agentDiscovery,
  x402Catalog,
  x402ProductRequirements,
  x402BuyProduct,
  x402Requirements,
  x402SubmitJob,
  X402_SUITE_URL,
  X402_PRODUCTS_URL,
  SERVICE_NAME,
  SITE_PPS,
  STRIPE_PAYMENT_LINK,
  PRODUCT_BASE,
  DATA_MULT,
  OP_MULT,
} from "./index.mjs";

function usage() {
  console.log(`
${SERVICE_NAME} — humans: Stripe · agents: x402

Usage:
  spl-pps quote [file] [--bytes N] [--class CLASS] [--product P] [--op compress|decompress|roundtrip]
  spl-pps pay   [file] [same flags] [--email you@domain.com]     # Stripe (humans)
  spl-pps job   --email you@domain.com [--paid] [--file path]   # after Stripe
  spl-pps x402                 # agent discovery
  spl-pps catalog              # standing products (x402)
  spl-pps buy --sku cddg-split [--email] [--payment HDR | --dev-bypass]
  spl-pps x402-req [flags]     # metered suite job 402 probe
  spl-pps x402-job [flags]     # metered suite job submit
  spl-pps products
  spl-pps open

Suite tools: ${Object.keys(PRODUCT_BASE).join(", ")}
Classes:     ${Object.keys(DATA_MULT).join(", ")}
Ops:         ${Object.keys(OP_MULT).join(", ")}

Site:          ${SITE_PPS}
Stripe:        ${STRIPE_PAYMENT_LINK}
x402 products: ${X402_PRODUCTS_URL}
x402 jobs:     ${X402_SUITE_URL}
Agent pay:     x402-client payFetch against product or job URL
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bytes" || a === "-b") args.bytes = Number(argv[++i]);
    else if (a === "--class" || a === "-c") args.dataClass = argv[++i];
    else if (a === "--product" || a === "-p") args.product = argv[++i];
    else if (a === "--op" || a === "-o") args.op = argv[++i];
    else if (a === "--email" || a === "-e") args.email = argv[++i];
    else if (a === "--file" || a === "-f") args.file = argv[++i];
    else if (a === "--note") args.note = argv[++i];
    else if (a === "--paid") args.paid = true;
    else if (a === "--remote") args.remote = true;
    else if (a === "--payment") args.payment = argv[++i];
    else if (a === "--sku") args.sku = argv[++i];
    else if (a === "--dev-bypass") args.devBypass = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("-")) {
      console.error("Unknown flag:", a);
      process.exit(2);
    } else args._.push(a);
  }
  return args;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || "help";
  const args = parseArgs(argv.slice(1));

  if (cmd === "help" || args.help) {
    usage();
    return;
  }

  if (cmd === "products") {
    console.log(JSON.stringify({ service: SERVICE_NAME, products: PRODUCT_BASE, classes: DATA_MULT, ops: OP_MULT }, null, 2));
    return;
  }

  if (cmd === "open") {
    console.log(SITE_PPS);
    return;
  }

  if (cmd === "mcp") {
    console.log("Start MCP:  node src/mcp-server.mjs");
    console.log("Or:         npm run mcp --prefix packages/spl-pay-per-suite");
    console.log("Config:     { \"command\": \"npx\", \"args\": [\"-y\", \"spl-pay-per-suite\", \"mcp-serve\"] }");
    return;
  }

  if (cmd === "mcp-serve") {
    await import("./mcp-server.mjs");
    return;
  }

  if (cmd === "x402" || cmd === "agent") {
    console.log(JSON.stringify(await agentDiscovery(), null, 2));
    return;
  }

  if (cmd === "catalog" || cmd === "x402-catalog") {
    console.log(JSON.stringify(await x402Catalog(), null, 2));
    return;
  }

  if (cmd === "buy" || cmd === "x402-buy") {
    const sku = args.sku || args.product || args._[0];
    if (!sku) {
      console.error("--sku required (e.g. cddg-split, zrw-n00b, blackjack)");
      process.exit(1);
    }
    const opts = {
      sku,
      email: args.email || "",
      note: args.note || "",
      paymentHeader: args.payment,
      devBypass: !!args.devBypass,
    };
    try {
      // no payment → show requirements
      if (!opts.paymentHeader && !opts.devBypass) {
        console.log(JSON.stringify(await x402ProductRequirements(opts), null, 2));
        return;
      }
      console.log(JSON.stringify(await x402BuyProduct(opts), null, 2));
    } catch (e) {
      if (e.status === 402) {
        console.error("# Payment required — pay accepts[0] then: spl-pps buy --sku " + sku + " --payment <HDR>");
        console.log(JSON.stringify(e.requirements, null, 2));
        process.exit(402 % 256);
      }
      throw e;
    }
    return;
  }

  if (cmd === "x402-req" || cmd === "x402-requirements") {
    const file = args.file || args._[0];
    let opts = {
      product: args.product || "auto",
      dataClass: args.dataClass || "unknown",
      op: args.op || "compress",
      bytes: args.bytes || 0,
      email: args.email || "",
      note: args.note || "",
    };
    if (file) {
      const qf = await quoteFile(file, args);
      opts = {
        ...opts,
        product: args.product || qf.classification.tool || "auto",
        dataClass: args.dataClass || qf.classification.dataClass,
        bytes: qf.bytes,
        fileName: qf.fileName,
      };
    }
    console.log(JSON.stringify(await x402Requirements(opts), null, 2));
    return;
  }

  if (cmd === "x402-job") {
    const file = args.file || args._[0];
    let opts = {
      product: args.product || "auto",
      dataClass: args.dataClass || "unknown",
      op: args.op || "compress",
      bytes: args.bytes || 0,
      email: args.email || "",
      note: args.note || "",
      paymentHeader: args.payment,
      devBypass: !!args.devBypass,
    };
    if (file) {
      const qf = await quoteFile(file, args);
      opts.bytes = qf.bytes;
      opts.fileName = qf.fileName;
      opts.product = args.product || qf.classification.tool || "auto";
      opts.dataClass = args.dataClass || qf.classification.dataClass;
    }
    try {
      console.log(JSON.stringify(await x402SubmitJob(opts), null, 2));
    } catch (e) {
      if (e.status === 402) {
        console.error("# Payment required — pay accepts[0] then retry with --payment");
        console.log(JSON.stringify(e.requirements, null, 2));
        process.exit(402 % 256);
      }
      throw e;
    }
    return;
  }

  if (cmd === "quote") {
    const file = args.file || args._[0];
    let result;
    if (file) {
      result = await quoteFile(file, args);
    } else {
      const opts = {
        product: args.product || "auto",
        dataClass: args.dataClass || "unknown",
        op: args.op || "compress",
        bytes: args.bytes || 0,
      };
      result = args.remote ? await quoteRemote(opts) : computeQuote(opts);
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "pay") {
    const file = args.file || args._[0];
    let opts = {
      product: args.product || "auto",
      dataClass: args.dataClass || "unknown",
      op: args.op || "compress",
      bytes: args.bytes || 0,
      email: args.email || "",
    };
    if (file) {
      const qf = await quoteFile(file, args);
      opts = {
        ...opts,
        product: args.product || qf.classification.tool || "auto",
        dataClass: args.dataClass || qf.classification.dataClass,
        bytes: qf.bytes,
      };
      console.error(`# ${SERVICE_NAME} quote for ${qf.fileName}: $${qf.quote.amount_display}`);
    } else {
      const q = computeQuote(opts);
      console.error(`# ${SERVICE_NAME} quote: $${q.amount_display}`);
    }
    const chk = await createCheckout(opts);
    console.log(JSON.stringify(chk, null, 2));
    if (chk.url) console.error(`\nOpen: ${chk.url}`);
    if (chk.instructions) console.error(chk.instructions);
    return;
  }

  if (cmd === "job") {
    if (!args.email) {
      console.error("--email required");
      process.exit(1);
    }
    let opts = {
      email: args.email,
      product: args.product || "auto",
      dataClass: args.dataClass || "unknown",
      op: args.op || "compress",
      bytes: args.bytes || 0,
      paidConfirm: !!args.paid,
      note: args.note || "",
      fileName: "",
    };
    const file = args.file || args._[0];
    if (file) {
      const qf = await quoteFile(file, args);
      opts.fileName = qf.fileName;
      opts.bytes = qf.bytes;
      opts.product = args.product || qf.classification.tool;
      opts.dataClass = args.dataClass || qf.classification.dataClass;
      opts.amount_display = qf.quote.amount_display;
      opts.tool = qf.classification.tool;
    } else {
      opts.amount_display = computeQuote(opts).amount_display;
    }
    const job = await submitJob(opts);
    console.log(JSON.stringify(job, null, 2));
    return;
  }

  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
