"""rerank-svc — production MiniLM reranker web endpoint (compressor 0.2 default).

Fine-tuned weights: /hf-cache/minilm-ft on Modal volume 'hf-cache'
(shared mount; this app only reads the weights, never writes the volume).
Lab nDCG@10 of these weights: 0.9562.

API:
  POST /  { query: str, docs: [{ id, text }], top_k?: int }
    -> 200 [{ id, score }] sorted by score desc (scores are FLOAT logits)
  Errors are fail-closed JSON { ok: false, error } with 4xx/5xx status.

Auth: shared-secret bearer token from Modal Secret 'rerank-auth'
(key RERANK_TOKEN), sent as `Authorization: Bearer <token>`.

Perf policy: start on CPU; if warm p50 over the 50-doc lab fixture
exceeds 750ms, flip USE_GPU below to True (T4) and redeploy.

Deploy:  python -m modal deploy modal/rerank_svc.py   (from repo root)
Serve:    python -m modal serve modal/rerank_svc.py   (dev loop)
"""

import hmac
import os

import modal
from fastapi import FastAPI, Request

APP_NAME = "rerank-svc"
VOLUME_NAME = "hf-cache"
VOLUME_PATH = "/hf-cache"
MODEL_PATH = "/hf-cache/minilm-ft"

# Perf switch: False = CPU (default). True = NVIDIA T4, device auto-detects.
USE_GPU = False

CPU_IMAGE = modal.Image.debian_slim(python_version="3.12").pip_install(
    "sentence-transformers==5.1.1",
    "fastapi[standard]",
    index_url="https://download.pytorch.org/whl/cpu",
    extra_index_url="https://pypi.org/simple",
)
GPU_IMAGE = modal.Image.debian_slim(python_version="3.12").pip_install(
    "sentence-transformers==5.1.1",
    "fastapi[standard]",
)

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=False)
image = GPU_IMAGE if USE_GPU else CPU_IMAGE

AUTH_SECRET = modal.Secret.from_name("rerank-auth")


def _fail(message, status):
    from fastapi.responses import JSONResponse

    return JSONResponse({"ok": False, "error": message}, status_code=status)


_model = None


def _get_model():
    """Lazy-load the fine-tuned CrossEncoder once per container."""
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder

        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = CrossEncoder(MODEL_PATH, device=device, trust_remote_code=False)
        _model.predict([("warmup query", "warmup document text")])
    return _model


web_app = FastAPI()


@web_app.post("/")
async def rerank(request: Request):
    import asyncio

    from fastapi.responses import JSONResponse

    expected = os.environ.get("RERANK_TOKEN", "")
    auth = request.headers.get("authorization", "")
    if not expected or not hmac.compare_digest(auth, "Bearer " + expected):
        return _fail("unauthorized", 401)

    try:
        body = await request.json()
    except Exception:
        return _fail("invalid_json", 400)
    if not isinstance(body, dict):
        return _fail("invalid_json", 400)

    query = body.get("query", "")
    docs = body.get("docs", None)
    top_k = body.get("top_k", None)

    if not isinstance(query, str) or not query.strip():
        return _fail("missing_query", 400)
    if not isinstance(docs, list) or len(docs) == 0:
        return _fail("missing_docs", 400)
    if len(docs) > 200:
        return _fail("too_many_docs", 400)
    ids = []
    texts = []
    for d in docs:
        if not isinstance(d, dict) or d.get("id") is None or not isinstance(d.get("text"), str):
            return _fail("invalid_doc", 400)
        ids.append(d["id"])
        texts.append(d["text"])
    if top_k is None:
        top_k = len(ids)
    if not isinstance(top_k, int) or isinstance(top_k, bool) or top_k < 1:
        return _fail("invalid_top_k", 400)
    top_k = min(top_k, len(ids))

    try:
        model = _get_model()
        pairs = [(query, t) for t in texts]
        raw = await asyncio.to_thread(model.predict, pairs)
        scores = [float(s) for s in raw]
    except Exception:
        return _fail("scoring_failed", 502)

    ranked = sorted(
        ({"id": i, "score": s} for i, s in zip(ids, scores)),
        key=lambda r: r["score"],
        reverse=True,
    )
    return JSONResponse(ranked[:top_k])


@app.function(
    image=image,
    volumes={VOLUME_PATH: volume},
    secrets=[AUTH_SECRET],
    cpu=2.0,
    gpu="T4" if USE_GPU else None,
    timeout=300,
)
@modal.asgi_app()
def fastapi_app():
    return web_app
