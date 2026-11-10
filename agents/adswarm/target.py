"""Reverse search: advertisers stock arrays, user queries retrieve from them.

Forward search maps query -> web. This maps inventory -> query: each ad
declares subjects, an optional geo fence, and a schedule window. A user
search returns matching array entries, filtered by the user's own
settings (blocklist, max distance) before any ranking. stdlib only.
"""
import json
import math
import os
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS ads(
  id TEXT PRIMARY KEY, advertiser TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', subjects TEXT NOT NULL DEFAULT '',
  lat REAL, lon REAL, radius_km REAL,
  sched_start TEXT, sched_end TEXT,
  claim_refs TEXT NOT NULL DEFAULT '[]', created TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS ads_fts USING fts5(
  title, body, subjects, content='ads', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS ads_ai AFTER INSERT ON ads BEGIN
  INSERT INTO ads_fts(rowid, title, body, subjects)
  VALUES (new.rowid, new.title, new.body, new.subjects);
END;
CREATE TRIGGER IF NOT EXISTS ads_ad AFTER DELETE ON ads BEGIN
  INSERT INTO ads_fts(ads_fts, rowid, title, body, subjects)
  VALUES ('delete', old.rowid, old.title, old.body, old.subjects);
END;
"""


def open_array(path=":memory:"):
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def _terms(query):
    return [t for t in "".join(c.lower() if c.isalnum() else " " for c in query).split() if t]


def stock(conn, ad):
    """Validate and shelve one ad. Returns its id."""
    ad = dict(ad)
    if not ad.get("id") or not ad.get("advertiser") or not ad.get("title"):
        return None, "id, advertiser, and title are required"
    subjects = ad.get("subjects") or []
    if not subjects:
        return None, "at least one subject is required"
    if ad.get("radius_km") is not None and not ad["radius_km"] > 0:
        return None, "radius_km must be positive or null (global)"
    if (ad.get("lat") is None) != (ad.get("lon") is None):
        return None, "lat and lon come as a pair or not at all"
    ad.setdefault("body", "")
    ad["subjects"] = " ".join(subjects)
    ad.setdefault("claim_refs", [])
    ad["claim_refs"] = json.dumps(ad["claim_refs"])
    ad["created"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    cols = ("id", "advertiser", "title", "body", "subjects", "lat", "lon",
            "radius_km", "sched_start", "sched_end", "claim_refs", "created")
    conn.execute("INSERT OR REPLACE INTO ads(%s) VALUES(%s)" % (
        ",".join(cols), ",".join("?" for _ in cols)),
        [ad.get(c) for c in cols])
    conn.commit()
    return ad["id"], None


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(d))


def search(conn, query, lat=None, lon=None, max_km=None, blocked=(), top_k=5, now=None):
    """Retrieve array entries for a user query. Filters before ranking."""
    terms = _terms(query)
    if not terms:
        return []
    match = " OR ".join('"%s"' % t for t in terms)
    rows = conn.execute(
        "SELECT ads.id, ads.advertiser, ads.title, ads.body, ads.subjects,"
        " ads.lat, ads.lon, ads.radius_km,"
        " ads.sched_start, ads.sched_end, ads.claim_refs, rank FROM ads"
        " JOIN ads_fts ON ads.rowid = ads_fts.rowid"
        " WHERE ads_fts MATCH ? ORDER BY rank LIMIT 50", (match,)).fetchall()
    now = now or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    blocked = set(blocked or [])
    out = []
    for (aid, adv, title, body, subjects, alat, alon, rad, s0, s1, refs, rank) in rows:
        if adv in blocked:
            continue
        if s0 and now < s0:
            continue
        if s1 and now > s1:
            continue
        dist = None
        if alat is not None and lat is not None and lon is not None:
            dist = haversine_km(lat, lon, alat, alon)
            fence = rad if rad else (max_km if max_km else float("inf"))
            if dist > fence:
                continue
            if max_km is not None and dist > max_km:
                continue
        elif max_km is not None and alat is not None:
            continue  # user set a distance but gave no position: skip fenced ads
        prox = 1.0 / (1.0 + (dist or 0.0) / 10.0)
        text = 1.0 / (1.0 + abs(rank))
        out.append({"id": aid, "advertiser": adv, "title": title,
                    "subjects": subjects.split(), "distance_km": dist,
                    "claim_refs": json.loads(refs),
                    "score": round(0.7 * text + 0.3 * prox, 4),
                    "why": "subjects [%s]%s" % (
                        ", ".join(s for s in subjects.split() if s in terms),
                        " · %.1f km away" % dist if dist is not None else "")})
    out.sort(key=lambda e: -e["score"])
    return out[:top_k]


def receipt(query, results, array="default"):
    return {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "array": array, "query": query,
            "served": [r["id"] for r in results]}
