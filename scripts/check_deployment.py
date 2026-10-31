"""Bounded HTTPS smoke checks; never send deployment credentials to the app."""
import argparse
import json
import sys
import time
from html.parser import HTMLParser
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class AppShell(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = False
        self.script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.root |= tag == "div" and attrs.get("id") == "root"
        self.script |= tag == "script" and attrs.get("type") == "module" and bool(attrs.get("src"))


def check(url, kind, attempts=12):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Health check requires an HTTPS URL without embedded credentials")
    if kind not in {"backend", "frontend"} or attempts < 1:
        raise ValueError("Invalid health check kind or attempt count")
    for attempt in range(1, attempts + 1):
        try:
            req = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "SCMS-CD-health-check"})
            with urlopen(req, timeout=10) as response:
                if response.status != 200:
                    raise ValueError("Expected HTTP 200")
                body = response.read().decode("utf-8")
                if kind == "backend":
                    data = json.loads(body)
                    if not isinstance(data, dict) or data.get("status") != "UP" or data.get("service") != "scms-api":
                        raise ValueError("Expected scms-api with status UP")
                else:
                    shell = AppShell()
                    shell.feed(body)
                    if response.headers.get_content_type() != "text/html" or not (shell.root and shell.script):
                        raise ValueError("Expected frontend HTML with React root and module script")
            print(f"{kind} smoke check passed", flush=True)
            return
        except (URLError, OSError, ValueError) as error:
            # Do not print response bodies, headers, or credentials in CI logs.
            print(f"{kind} check {attempt}/{attempts} failed ({type(error).__name__})", flush=True)
            if attempt == attempts:
                raise RuntimeError(f"{kind} smoke check failed after {attempts} attempts") from None
            time.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=("backend", "frontend"))
    parser.add_argument("url")
    args = parser.parse_args()
    try:
        check(args.url, args.kind)
    except (RuntimeError, ValueError) as error:
        print(f"Deployment verification failed: {error}", file=sys.stderr)
        sys.exit(1)
