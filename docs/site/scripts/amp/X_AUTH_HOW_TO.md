# How to get working X (@slidphilabs) API keys — plain English

You do **not** need API keys to post manually.  
Open https://x.com/compose and paste the thread from `X_THREAD_SITE_BREATHES.md`.

Use this guide only if you want **automated** posts (scripts, MidPoint, agents).

---

## What “401 Unauthorized” means

Your machine **has** four strings in `.env`, but X rejects them. Usual reasons:

1. Access token was created as **Read only** (must be **Read and write**).
2. You changed permissions but **did not regenerate** Access Token + Secret after.
3. API Key was regenerated → old Access Token is dead (regenerate all four).
4. Keys belong to a **different** X account / app, not @slidphilabs.
5. App is not inside a **Project**, or Free / pay-per-use billing isn’t set up.

---

## The four secrets we need (names must match)

| Env name | Portal label | What it is |
|----------|--------------|------------|
| `X_API_KEY` | API Key / Consumer Key | App identity |
| `X_API_SECRET` | API Key Secret / Consumer Secret | App password |
| `X_ACCESS_TOKEN` | Access Token | “Post as this user” |
| `X_ACCESS_SECRET` | Access Token Secret | User token password |

Also accepted: `X_ACCESS_TOKEN_SECRET` (same as Access Secret).

**Not enough alone:** Bearer Token — that is app-only and **cannot post**.

---

## Step-by-step (do this on a laptop, signed into @slidphilabs)

### 1) Sign into the right account

1. Log out of personal X if needed.
2. Log in as **@slidphilabs** (the account that should own the posts).
3. Open: **https://developer.x.com**  
   (or **https://console.x.com** if they redirect you — same ecosystem).

If X asks you to “sign up as a developer” / accept terms / describe use case, do it.  
Use case example (honest):

> Post product updates and proof metrics for Slid Phi Labs (our own account only). No scraping, no spam.

### 2) Create a Project + App (if you don’t have one)

1. **Create Project** → name e.g. `SlidPhiLabs`.
2. **Create App** under that project → name e.g. `slidphilabs-poster`.
3. Save whatever keys it shows **once** (they may only show the secret once).

### 3) Turn on OAuth 1.0a + **Read and write**

In the App settings:

1. Find **User authentication settings** (or “Set up” under auth).
2. Enable **OAuth 1.0a**.
3. App permissions: **Read and write** (not Read only).
4. Type of app: **Web App** or **Native** is fine for server posting.
5. Callback URL (required field even if unused):  
   `https://www.slidphilabs.com/`  
   Website URL: `https://www.slidphilabs.com/`
6. Save.

### 4) Generate **Access Token and Secret** (user context)

1. Open the App → **Keys and tokens**.
2. Under **Authentication Tokens** / Access Token:
   - Click **Generate** (or Regenerate).
3. Confirm the UI says permissions are **Read and write** (or “Created with Read and Write”).
4. Copy **all four**:
   - API Key  
   - API Key Secret  
   - Access Token  
   - Access Token Secret  

**Critical:** If you ever change Read → Read and write, you **must regenerate** the Access Token pair again.

### 5) Put them on the host (never git)

Edit (host only):

`/home/cee/projects/midpoint-news-agency/.env`

```bash
X_API_KEY=paste_api_key
X_API_SECRET=paste_api_key_secret
X_ACCESS_TOKEN=paste_access_token
X_ACCESS_SECRET=paste_access_token_secret
# or:
# X_ACCESS_TOKEN_SECRET=same_as_access_secret

MIDPOINT_X_POSTING=0
```

Optional for Slid-only env file:

```bash
# /home/cee/projects/SlidPhiLabs/.env.x  (create, chmod 600)
```

### 6) Verify before posting

```bash
cd /home/cee/projects/SlidPhiLabs/docs/site
./scripts/amp/x_verify_auth.sh
```

Expect: `ok: true` and screen_name `slidphilabs`.

Then flip posting:

```bash
# in .env
MIDPOINT_X_POSTING=1
```

### 7) Billing / Free tier reality check (2025–2026)

X has moved around Free / pay-per-use / credit models.  
If Keys look correct but post still fails with **403 / payment / access level**:

- Open Developer Console billing / credits.
- Ensure the Project/App is allowed to call **create post** (manage tweets).
- Free tiers often allow **posting your own content** but are strict — still needs user OAuth, not Bearer.

---

## What you can do **today** without any keys

| Channel | How |
|---------|-----|
| X public | Paste thread: `scripts/amp/X_THREAD_SITE_BREATHES.md` |
| Discord | One-liner: `scripts/amp/ONE_LINER.txt` |
| Partners | Forward Gmail draft already in **Drafts** for corey@ |

Site is already green (proof bar, standings, metrics). Amplify does not depend on API keys.

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Only copied Bearer Token | Need Access Token + Secret too |
| Read-only access token | Set Read and write → **Regenerate** access token |
| Regenerated API Key only | Regenerate Access Token pair too |
| Logged into personal account | Log in as @slidphilabs first |
| Keys in Notion / git | Host `.env` only, `chmod 600` |
| Spaces / quotes when pasting | No spaces at ends; no smart quotes |

---

## After keys work — one post test

```bash
cd /home/cee/projects/midpoint-news-agency
set -a && source .env && set +a
export X_ACCESS_SECRET="${X_ACCESS_SECRET:-$X_ACCESS_TOKEN_SECRET}"
export MIDPOINT_X_POSTING=1
export PYTHONPATH=src
.venv/bin/python - <<'PY'
from midpoint.x_thread import ThreadPlan, ThreadPost
from midpoint.x_post import post_thread
t = "Slid Phi Labs pulse check — compression that knows it is alive. https://www.slidphilabs.com"
plan = ThreadPlan(topic="pulse", posts=[ThreadPost(index=1, text=t, chars=len(t))])
print(post_thread(plan, dry_run=False))
PY
```

If that prints `tweet_ids`, you’re done. Delete the test post on X if you want.
