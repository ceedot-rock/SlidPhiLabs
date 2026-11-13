"""Path and 402 checks for the lab calls client. No live host."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

import spl_lab_calls as lab


def test_paths_and_prices():
    assert lab.endpoint("compress").endswith("/v1/compress")
    assert lab.endpoint("pcc_compress").endswith("/v1/pcc-compress")
    assert lab.endpoint("warrant_issue").endswith("/v1/warrant/issue")
    assert lab.endpoint("chamber_seal").endswith("/v1/chamber-seal")
    assert lab.endpoint("fetch").endswith("/v1/fetch")
    assert "chamber-month" not in lab.CALLS
    assert "tnssrc-grant" not in lab.CALLS
    assert lab.PRICES_USD["check"] == "0.05"
    assert lab.PRICES_USD["squeeze"] == "0.10"
    assert lab.PRICES_USD["fetch"] == "0.02"
    assert lab.PRICES_USD["audit"] == "1.00"
    assert lab.PRICES_USD["awlpay_quote"] == "0.005"
    assert "compress" not in lab.PRICES_USD
    assert "seal" not in lab.PRICES_USD


def test_402_raises():
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            body = json.loads(raw.decode() or "{}")
            assert self.path == "/v1/fetch"
            assert body["url"] == "https://example.com"
            payload = json.dumps({"ok": False, "error": "payment required", "sku": "quikgater"}).encode()
            self.send_response(402)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        try:
            lab.fetch({"url": "https://example.com"}, base=f"http://{host}:{port}")
            raise AssertionError("expected PaymentRequired")
        except lab.PaymentRequired as pay:
            assert pay.status == 402
            assert pay.body["sku"] == "quikgater"
    finally:
        server.shutdown()
