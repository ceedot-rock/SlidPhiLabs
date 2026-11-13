"""Channel adapters. One interface: publish(channel, draft) -> receipt dict.

Default is dry-run: the piece lands in outbox/ and the receipt says so.
Live publishing needs ADSWARM_LIVE=1 in the environment AND the channel's
credential variable present. Missing creds is a normal state, never an
error: the swarm drafts and queues regardless. No spend path exists in
any adapter by construction.
"""
import json
import os
import time

CREDENTIALS = {
    "dev.to": "DEVTO_API_KEY",
    "hashnode": "HASHNODE_TOKEN",
    "x": "X_BEARER_TOKEN",
    "reddit": "REDDIT_REFRESH_TOKEN",
    "lab-blog": None,  # file drop reviewed with the site repo
}


def live_ready(channel):
    """True only when live mode is armed and this channel has creds."""
    if os.environ.get("ADSWARM_LIVE") != "1":
        return False
    var = CREDENTIALS.get(channel)
    if var is None:
        return channel == "lab-blog"
    return bool(os.environ.get(var))


def publish(home, channel, draft):
    """Publish one draft. Always dry-run unless live_ready()."""
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if not live_ready(channel):
        out = os.path.join(home, "outbox")
        os.makedirs(out, exist_ok=True)
        path = os.path.join(out, "%s.%s.md" % (draft["id"], channel))
        with open(path, "w", encoding="utf-8") as f:
            f.write(draft["body"])
        return {"ok": True, "dry_run": True, "channel": channel,
                "path": path, "at": stamp,
                "note": "no live creds or live mode off; queued, not posted"}
    if channel == "dev.to":
        return _live_devto(draft, stamp)
    return {"ok": False, "dry_run": False, "channel": channel,
            "at": stamp, "error": "no_live_adapter",
            "note": "credentials present but no live adapter written yet"}


def _post_json(url, payload, token):
    import urllib.request
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "api-key": token},
        method="POST")
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def _live_devto(draft, stamp):
    """Post one article to dev.to. Reads DEVTO_API_KEY at call time."""
    token = os.environ.get("DEVTO_API_KEY", "")
    lines = draft["body"].strip().splitlines()
    title = lines[0].lstrip("# ").strip() if lines else draft["id"]
    try:
        data = _post_json("https://dev.to/api/articles",
                          {"article": {"title": title[:120],
                                       "body_markdown": draft["body"],
                                       "published": True}}, token)
    except Exception as e:
        return {"ok": False, "dry_run": False, "channel": "dev.to",
                "at": stamp, "error": "post_failed: %s" % str(e)[:160]}
    art = data if isinstance(data, dict) else {}
    return {"ok": True, "dry_run": False, "channel": "dev.to",
            "url": art.get("url"), "id": art.get("id"), "at": stamp}
