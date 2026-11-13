"""Thin wrapper around the `gh` CLI. Stdlib only, no tokens here.

All auth rides gh's own credential store / environment. Every function
returns (ok: bool, output: str). `runner` is injectable for tests:
pass run_gh=<fake> to employee commands.
"""
import subprocess


def run_gh(args):
    try:
        proc = subprocess.run(
            ["gh"] + args, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        return False, "gh CLI is not installed (https://cli.github.com)."
    except subprocess.TimeoutExpired:
        return False, "gh timed out."
    ok = proc.returncode == 0
    return ok, (proc.stdout if ok else proc.stderr).strip()[:4000]


def issue_list(repo, limit=20):
    return run_gh(["issue", "list", "--repo", repo, "--limit", str(limit)])


def pr_list(repo, limit=20):
    return run_gh(["pr", "list", "--repo", repo, "--limit", str(limit)])


def pr_view(repo, number):
    return run_gh(["pr", "view", str(number), "--repo", repo,
                   "--comments", "--commits"])


def pr_diff(repo, number):
    return run_gh(["pr", "diff", str(number), "--repo", repo])


def pr_checks(repo, number):
    return run_gh(["pr", "checks", str(number), "--repo", repo])


def pr_create(repo, title, body, branch):
    return run_gh(["pr", "create", "--repo", repo, "--title", title,
                   "--body", body, "--head", branch])


def pr_merge(repo, number):
    return run_gh(["pr", "merge", str(number), "--repo", repo,
                   "--merge", "--delete-branch"])
