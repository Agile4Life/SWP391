"""Verify CI runs returned by gh api --paginate --slurp before production deploy."""
import json
import os
import sys


def verify_ci(runs, commit, repository):
    eligible = [run for run in runs if
                run.get("head_sha") == commit
                and run.get("head_branch") == "main"
                and (run.get("head_repository") or {}).get("full_name") == repository
                and run.get("event") in {"push", "workflow_dispatch"}]
    if not eligible:
        raise RuntimeError("Không tìm thấy CI của đúng SHA trên main trong repository này.")
    latest = max(eligible, key=lambda run: run["run_number"])
    if latest.get("status") != "completed" or latest.get("conclusion") != "success":
        raise RuntimeError("CI mới nhất của SHA này chưa thành công; hãy chạy CI trước khi deploy.")
    return latest["id"]


if __name__ == "__main__":
    try:
        pages = json.load(sys.stdin)
        run_id = verify_ci([run for page in pages for run in page["workflow_runs"]],
                           os.environ["TESTED_SHA"], os.environ["GITHUB_REPOSITORY"])
        print(f"CI verified: run {run_id}, commit {os.environ['TESTED_SHA']}")
    except (RuntimeError, ValueError, KeyError, TypeError) as error:
        print(f"CI verification failed: {error}", file=sys.stderr)
        sys.exit(1)
