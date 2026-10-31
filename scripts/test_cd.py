"""Offline regression checks for production CI gating and HTTP smoke checks."""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from email.message import Message
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

import check_deployment
import verify_production_ci


class ProductionCiTest(unittest.TestCase):
    def setUp(self):
        self.run = {
            "id": 10, "run_number": 10, "head_sha": "a" * 40,
            "head_branch": "main", "head_repository": {"full_name": "owner/repo"},
            "event": "push", "status": "completed", "conclusion": "success",
        }

    def verify(self, runs):
        return verify_production_ci.verify_ci(runs, "a" * 40, "owner/repo")

    def test_accepts_tested_commit_for_push_and_manual_ci(self):
        for event in ("push", "workflow_dispatch"):
            with self.subTest(event=event):
                self.run["event"] = event
                self.assertEqual(self.verify([self.run]), 10)

    def test_rejects_missing_ci_and_untrusted_or_different_commits(self):
        changes = [
            {"head_sha": "b" * 40}, {"head_branch": "develop"},
            {"head_repository": {"full_name": "fork/repo"}},
            {"head_repository": None}, {"event": "pull_request"},
        ]
        with self.assertRaises(RuntimeError):
            self.verify([])
        for change in changes:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                self.verify([self.run | change])

    def test_newer_failure_or_running_ci_cannot_use_an_older_success(self):
        for status, conclusion in (("completed", "failure"), ("queued", None),
                                   ("in_progress", None), ("completed", "cancelled"),
                                   ("completed", "skipped")):
            newer = self.run | {"id": 11, "run_number": 11,
                                "status": status, "conclusion": conclusion}
            for runs in ([newer, self.run], [self.run, newer]):
                with self.subTest(status=status, conclusion=conclusion), self.assertRaises(RuntimeError):
                    self.verify(runs)

    def test_accepts_latest_success_instead_of_older_failure(self):
        old = self.run | {"id": 9, "run_number": 9, "conclusion": "failure"}
        self.assertEqual(self.verify([old, self.run]), 10)

    def test_cli_reads_paginated_gh_output_and_fails_closed(self):
        env = os.environ | {"TESTED_SHA": "a" * 40, "GITHUB_REPOSITORY": "owner/repo",
                            "PYTHONIOENCODING": "utf-8"}
        command = [sys.executable, "-B", str(Path(__file__).with_name("verify_production_ci.py"))]
        for runs, expected_code in (([self.run], 0), ([], 1)):
            with self.subTest(expected_code=expected_code):
                result = subprocess.run(command, env=env, text=True, encoding="utf-8",
                        input=json.dumps([{"workflow_runs": []}, {"workflow_runs": runs}]),
                        capture_output=True)
                self.assertEqual(result.returncode, expected_code, result.stderr)
        result = subprocess.run(command, env=env, input="", text=True, encoding="utf-8", capture_output=True)
        self.assertNotEqual(result.returncode, 0)


class DeploymentHealthTest(unittest.TestCase):
    def response(self, body, content_type="application/json", status=200):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = status
        response.headers = Message()
        response.headers["Content-Type"] = content_type
        response.read.return_value = body.encode()
        return response

    def test_backend_retries_until_expected_service_is_up_without_credentials(self):
        with patch.object(check_deployment, "urlopen", side_effect=[
            URLError("starting"),
            self.response('{"status":"DOWN","service":"scms-api"}'),
            self.response('{"status":"UP","service":"scms-api"}'),
        ]) as fetch, patch.object(check_deployment.time, "sleep") as sleep:
            check_deployment.check("https://backend.example/api/v1/health", "backend", attempts=3)
        self.assertEqual(fetch.call_count, 3)
        self.assertEqual(sleep.call_count, 2)
        self.assertNotIn("Authorization", fetch.call_args.args[0].headers)

    def test_bad_backend_response_fails_after_bounded_retries(self):
        for body in ('<html>not JSON</html>', '{"status":"UP","service":"another-api"}',
                     '{"status":"DOWN","service":"scms-api"}', '[]'):
            with self.subTest(body=body), patch.object(check_deployment, "urlopen",
                    return_value=self.response(body)), patch.object(check_deployment.time, "sleep") as sleep:
                with self.assertRaises(RuntimeError):
                    check_deployment.check("https://backend.example/api/v1/health", "backend", attempts=2)
                sleep.assert_called_once()

    def test_accepts_frontend_app_shell(self):
        body = '<html><div id="root"></div><script type="module" src="/assets/app.js"></script></html>'
        with patch.object(check_deployment, "urlopen", return_value=self.response(body, "text/html")):
            check_deployment.check("https://frontend.example", "frontend", attempts=1)

    def test_rejects_login_pages_json_and_http_failures(self):
        failures = [
            self.response('<html>Sign in to Vercel</html>', "text/html"),
            self.response('{"id":"root"}'),
            self.response('<div id="root"></div>', "text/html"),
            self.response('error', "text/html", status=503),
            HTTPError("https://frontend.example", 401, "Unauthorized", {}, io.BytesIO()),
        ]
        for failure in failures:
            with self.subTest(failure=failure):
                kwargs = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
                with patch.object(check_deployment, "urlopen", **kwargs), self.assertRaises(RuntimeError):
                    check_deployment.check("https://frontend.example", "frontend", attempts=1)

    def test_invalid_url_never_sends_a_request(self):
        for url in ("", "file:///etc/passwd", "https://token@example.com", "https:///missing-host"):
            with self.subTest(url=url), patch.object(check_deployment, "urlopen") as fetch:
                with self.assertRaises(ValueError):
                    check_deployment.check(url, "backend")
                fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
