# GitHub audit change log

2026-11-09 gap-fill pass. One draft PR per repo, files only, nothing
overwritten. **No repo settings were changed** (no visibility, archive,
branch protection, Pages, Discussions, or tag changes), so there are no old
setting values to record. This file logs the before-state found in each root
tree and what each PR adds.

## Before-state (verified via API root listing)

- Slid-Phi-Labs/cuni (master): had SECURITY.md, CONTRIBUTING.md,
  .github/PULL_REQUEST_TEMPLATE.md, workflows, Cargo.toml, package.json.
  Lacked: dependabot.yml, CODEOWNERS.
  PR #31 adds: .github/dependabot.yml (cargo, npm), .github/CODEOWNERS.
- Slid-Phi-Labs/CuNIverse (master): same shape as cuni.
  PR #3 adds: .github/dependabot.yml (cargo, npm), .github/CODEOWNERS.
- Slid-Phi-Labs/slid-phi-mcp (main): had LICENSE, README.md, glama.json,
  server.json. No package manifest, no workflow: Dependabot/CODEOWNERS
  skipped per rule.
  PR #2 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md.
- ceedot-rock/nebius-nvidia-entry (main): had Dockerfile, requirements.txt,
  fly.toml. No .github dir.
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md, .github/dependabot.yml (pip, docker),
  .github/CODEOWNERS.
- ceedot-rock/AgentBibleCodec (main): data repo, no manifest, no .github.
  Dependabot/CODEOWNERS skipped per rule.
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md.
- ceedot-rock/proofline (main): had .github/workflows, Makefile, C sources.
  No package manifest: Dependabot skipped per rule.
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md, .github/CODEOWNERS.
- ceedot-rock/HonorAnchor (main): had package.json + package-lock.json, no
  .github dir, **no LICENSE file** (see license note below).
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md, .github/dependabot.yml (npm),
  .github/CODEOWNERS.
- ceedot-rock/shard-tsdb (main): had package.json, no .github dir.
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md, .github/dependabot.yml (npm),
  .github/CODEOWNERS.
- ceedot-rock/shard-zip (main): had package.json, .github/workflows.
  PR #1 adds: SECURITY.md, CONTRIBUTING.md,
  .github/pull_request_template.md, .github/dependabot.yml (npm),
  .github/CODEOWNERS.

## License note (no license chosen for anyone)

HonorAnchor has no LICENSE file. No license was added. Recommendation:
match the lab standard dual license (AGPL-3.0-or-later OR Commercial), the
same pair shard-tsdb and shard-zip carry. Owner decides; until then the
CONTRIBUTING.md in its PR states the repo is all-rights-reserved by default.
All other repos already carried a LICENSE and none was touched.
