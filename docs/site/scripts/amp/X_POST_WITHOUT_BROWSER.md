# Post as @slidphilabs WITHOUT the authorize browser flow

The “Authorize app” page often fails on free / new X apps.  
**Skip it.** Generate tokens **inside the Developer Portal** instead.

## Where to click (logged in as @slidphilabs)

1. Open **https://developer.x.com** (or console.x.com)
2. Your **Project** → your **App**
3. **Keys and tokens** tab (not “User authentication settings”)
4. Find **Authentication Tokens** / **Access Token and Secret**
5. Click **Generate** (or **Regenerate**)

You need **four** values from that same page:

| Portal name | Env name |
|-------------|----------|
| API Key / Consumer Key | `X_API_KEY` |
| API Key Secret / Consumer Secret | `X_API_SECRET` |
| Access Token | `X_ACCESS_TOKEN` |
| Access Token Secret | `X_ACCESS_SECRET` |

**Before Generate:** App permissions must be **Read and write**  
(User authentication settings → Save → then **Regenerate** Access Token).

## Send them here

```text
[sS]
API_KEY=...
API_SECRET=...
ACCESS_TOKEN=...
ACCESS_SECRET=...
[/sS]
```

We’ll verify and post the amp thread.

## What you can ignore

- Browser link `/api/x-oauth-start` (3-legged OAuth) — optional, often blocked
- Bearer Token alone — cannot post
- Client ID / Client Secret alone — cannot post without user tokens

## Manual backup (always works)

Paste thread from `X_THREAD_SITE_BREATHES.md` as @slidphilabs in the normal X app.
