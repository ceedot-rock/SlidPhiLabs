# SlidPhiLabs — command compiler

One place for every process we hit. Run from Termux/local shell.

**You are usually already in the repo.** Prompt shows `~/SlidPhiLabs $` → do **not** `cd \~/SlidPhiLabs` (backslash breaks `~`).

```bash
# only if you are NOT in the repo:
cd ~/SlidPhiLabs
```

---

## 1. Node / npm diagnostics

```bash
node -v
npm -v
npm config get registry
npm whoami
```

Expected:
- versions print
- registry: `https://registry.npmjs.org/`
- whoami: `cptasz13`

### Fix registry / login

```bash
npm config set registry https://registry.npmjs.org/
npm login
npm whoami
```

### Token login (if password/OTP awkward)

```bash
# create token on npmjs.com → Access Tokens
npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN
npm whoami
```

### Publish with OTP (only if 2FA on)

```bash
npm publish --access public --otp=123456
```

---

## 2. Git sync

```bash
cd ~/SlidPhiLabs
git status
git pull
```

### Local package.json blocks pull

```bash
git checkout -- package.json
git pull
```

### Or stash

```bash
git stash
git pull
git stash pop   # optional
```

### After pull — automation files

```bash
ls scripts/release.sh
npm run
```

---

## 3. Check what’s live on npm

```bash
npm view slid-phi version
npm view slid-phi
npm i slid-phi
```

---

## 4. Publish (manual)

**Never republish an existing version.**

```bash
cd ~/SlidPhiLabs
git pull
cat package.json | head -5    # check "version"
npm test                      # if tests exist
npm publish --access public
npm view slid-phi version
```

| Error | Meaning | Fix |
|-------|---------|-----|
| `cannot publish over … 2.1.0` | version already live | bump first |
| `cannot publish over … 2.1.1` | already published | done, or bump to 2.1.2 |
| `ENEEDAUTH` | not logged in | `npm login` |
| `EOTP` | 2FA required | `--otp=XXXXXX` from authenticator |

---

## 5. Automated versioning (after git pull)

### npm scripts

```bash
npm run version:patch    # x.y.Z + 1  (package.json only)
npm run version:minor    # x.Y.0
npm run version:major    # X.0.0

npm run release:patch    # bump + test + publish
npm run release:minor
npm run release:major
```

### release.sh

```bash
chmod +x scripts/release.sh

./scripts/release.sh patch     # bump patch, test, publish
./scripts/release.sh minor
./scripts/release.sh major
./scripts/release.sh publish   # publish current version only
```

### Manual bump only

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

### Optional git tag after release

```bash
VER=$(node -p "require('./package.json').version")
git add package.json
git commit -m "chore: release v$VER"
git tag v$VER
git push && git push --tags
```

---

## 6. Use the library

```bash
npm i slid-phi
```

```js
import { encode, decode, OMNI_META } from 'slid-phi'

encode('universe', ids, { M: 10000 })
encode('gaps', sortedIds)
encode('dense', ids)              // default profile: auto
encode('interp', sortedUnique)
decode(frame)                     // frame has bytes + bitLen
```

---

## 7. One-shot: “I’m clean and want latest tooling”

```bash
cd ~/SlidPhiLabs
git checkout -- package.json
git pull
npm whoami
npm view slid-phi version
chmod +x scripts/release.sh
npm run
```

---

## 8. One-shot: next release (e.g. 2.1.2)

```bash
cd ~/SlidPhiLabs
git pull
./scripts/release.sh patch
npm view slid-phi version
```

---

## 9. Status snapshot (as of 2.1.1 ship)

| Item | Value |
|------|--------|
| Package | `slid-phi` |
| Owner | `cptasz13` |
| Live | **2.1.1** (do not republish) |
| Repo | https://github.com/ceedot-rock/SlidPhiLabs |
| Registry | https://registry.npmjs.org/ |
| Ideal min (1..10k) | 13.29 bits — never claim below |
| universe | 14.00 |
| dense auto | ~14.57 |
| gaps | ~2–4 |

---

## 10. Don’t

```bash
cd \~/SlidPhiLabs          # wrong — escapes ~
npm publish                # if version already on npm
# paste recovery codes in chat
# claim compression below ideal minimum on uniform 1..10k
```
