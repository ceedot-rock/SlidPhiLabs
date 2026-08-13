# You only got 2 keys — that’s normal now

X’s new portal often shows **only**:

1. **Client ID**
2. **Client Secret**

Those are **OAuth 2.0 app credentials**.  
They are **not** broken. They just **cannot post by themselves**.

Old tutorials talk about 4 keys (OAuth 1.0a). You may never see those. **Use this path instead.**

---

## One-time setup in the X portal (5 minutes)

Logged in as **@slidphilabs** → your App → **User authentication settings** → Edit/Set up:

| Field | Value |
|--------|--------|
| **App permissions** | Read and write |
| **Type of App** | Web App, Automated App or Bot |
| **Callback URI #1** | `http://127.0.0.1:8787/callback` |
| **Callback URI #2** | `https://www.slidphilabs.com/x-oauth/callback` |
| **Website URL** | `https://www.slidphilabs.com` |

Save.

Scopes / permissions must allow posting (tweet.write / Read and write).

---

## Connect the account (one browser login)

On the **host machine** (where the engineer/scripts run):

```bash
cd /home/cee/projects/SlidPhiLabs/docs/site/scripts/amp
python3 x_oauth2_login.py
```

1. Script prints a long URL (or opens a browser).
2. You must be logged into **@slidphilabs** in that browser.
3. Click **Authorize**.
4. Browser hits `http://127.0.0.1:8787/callback` → “Connected”.
5. Terminal saves tokens to `~/.config/slidphilabs/x_oauth2_tokens.json`.

Then test post:

```bash
python3 x_oauth2_post.py "Site breathes. Compression that knows it is alive. https://www.slidphilabs.com"
```

---

## If login fails

| Error | Fix |
|--------|-----|
| redirect_uri mismatch | Add exact `http://127.0.0.1:8787/callback` in portal (no trailing slash unless you used one) |
| unauthorized_client | App type / OAuth 2.0 not enabled |
| 403 on post | Free/pay tier or missing tweet.write — check portal access level |
| Wrong @user | Log out of personal X, log into @slidphilabs, run login again |

---

## What we already have stored

- Client ID + Client Secret (the 2 you sent) — on the host only
- Post helper scripts ready
- Site callback page for the https URL

You do **not** need to find four old-style keys.
