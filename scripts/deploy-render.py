"""Deploy the tested Git commit to an existing Render service; wait until live."""
import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request(path, token, body=None, method=None):
    payload = None if body is None else json.dumps(body).encode()
    req = Request(
        f"https://api.render.com/v1/{path}",
        data=payload,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        # Never include request headers or response bodies containing credentials.
        raise RuntimeError(f"Render API returned HTTP {error.code}") from None
    except URLError:
        raise RuntimeError("Unable to reach the Render API") from None


def deploy(service, token, commit, supabase_url="", supabase_publishable_key=""):
    if not re.fullmatch(r"srv-[a-zA-Z0-9-]+", service):
        raise ValueError("Set RENDER_SERVICE_ID to your existing srv-... service ID")
    if not token:
        raise ValueError("Set the RENDER_API_KEY secret")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("DEPLOY_COMMIT must be the full tested Git commit SHA")
    if supabase_url or supabase_publishable_key:
        if not re.fullmatch(r"https://[a-z0-9]{20}\.supabase\.co", supabase_url) or not supabase_publishable_key.startswith("sb_publishable_"):
            raise ValueError("Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY; never use a secret key")
        for key, value in (("SUPABASE_URL", supabase_url), ("SUPABASE_PUBLISHABLE_KEY", supabase_publishable_key)):
            request(f"services/{service}/env-vars/{key}", token, {"value": value}, method="PUT")
    path = f"services/{service}/deploys"
    deployment = request(path, token, {"commitId": commit})
    deploy_id = deployment["id"]
    print(f"Render deployment {deploy_id}, commit {commit}", flush=True)
    deadline = time.monotonic() + 1800
    while time.monotonic() < deadline:
        status = request(f"{path}/{deploy_id}", token)["status"]
        print(f"Render status: {status}", flush=True)
        if status == "live":
            return
        if status in {"build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"}:
            raise RuntimeError(f"Render deployment ended with status: {status}")
        time.sleep(15)
    raise TimeoutError("Render deployment did not become live within 30 minutes; inspect Render before retrying")


if __name__ == "__main__":
    try:
        deploy(
            os.environ.get("RENDER_SERVICE_ID", ""),
            os.environ.get("RENDER_API_KEY", ""),
            os.environ.get("DEPLOY_COMMIT", ""),
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_PUBLISHABLE_KEY", ""),
        )
    except (RuntimeError, ValueError, TimeoutError, KeyError) as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        sys.exit(1)
