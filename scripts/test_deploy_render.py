"""Offline checks: python -m unittest discover -s scripts -p test_deploy_render.py."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError


class RenderDeployTest(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location(
            "deploy_render", Path(__file__).with_name("deploy-render.py")
        )
        self.deploy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.deploy)

    def test_deploys_exact_commit_and_waits_for_live(self):
        with patch.object(self.deploy, "request", side_effect=[
            {"id": "dep-test"}, {"status": "build_in_progress"}, {"status": "live"}
        ]) as request, patch.object(self.deploy.time, "sleep"):
            self.deploy.deploy("srv-test", "secret", "a" * 40)
        self.assertEqual(request.call_args_list[0].args, (
            "services/srv-test/deploys", "secret", {"commitId": "a" * 40}
        ))
        self.assertEqual(request.call_count, 3)
        self.assertEqual(request.call_args.args[0], "services/srv-test/deploys/dep-test")

    def test_configures_only_public_realtime_keys_before_deploy(self):
        with patch.object(self.deploy, "request", side_effect=[{}, {}, {"id": "dep-test"}, {"status": "live"}]) as request:
            self.deploy.deploy("srv-test", "secret", "a" * 40,
                    "https://abcdefghijklmnopqrst.supabase.co", "sb_publishable_test")
        self.assertEqual(request.call_args_list[0].args,
                ("services/srv-test/env-vars/SUPABASE_URL", "secret", {"value": "https://abcdefghijklmnopqrst.supabase.co"}))
        self.assertEqual(request.call_args_list[0].kwargs, {"method": "PUT"})
        self.assertEqual(request.call_args_list[1].args[0], "services/srv-test/env-vars/SUPABASE_PUBLISHABLE_KEY")
        self.assertEqual(request.call_args_list[2].args[0], "services/srv-test/deploys")

    def test_rejects_partial_or_secret_realtime_config_without_writes(self):
        for url, key in [("https://abcdefghijklmnopqrst.supabase.co", ""), ("", "sb_publishable_test"),
                         ("https://abcdefghijklmnopqrst.supabase.co", "sb_secret_forbidden")]:
            with self.subTest(url=url), patch.object(self.deploy, "request") as request:
                with self.assertRaises(ValueError):
                    self.deploy.deploy("srv-test", "secret", "a" * 40, url, key)
                request.assert_not_called()

    def test_terminal_failures_fail_the_job(self):
        for status in ("build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"):
            with self.subTest(status=status), patch.object(self.deploy, "request", side_effect=[
                {"id": "dep-test"}, {"status": status}
            ]), self.assertRaisesRegex(RuntimeError, status):
                self.deploy.deploy("srv-test", "secret", "a" * 40)

    def test_polling_has_a_deadline(self):
        with patch.object(self.deploy, "request", return_value={"id": "dep-test"}), \
                patch.object(self.deploy.time, "monotonic", side_effect=[0, 1801]), \
                self.assertRaises(TimeoutError):
            self.deploy.deploy("srv-test", "secret", "a" * 40)

    def test_invalid_configuration_never_calls_render(self):
        for arguments in (("", "secret", "a" * 40), ("srv-test", "", "a" * 40), ("srv-test", "secret", "main")):
            with self.subTest(arguments=arguments), patch.object(self.deploy, "request") as request:
                with self.assertRaises(ValueError):
                    self.deploy.deploy(*arguments)
                request.assert_not_called()

    def test_api_error_does_not_expose_credentials(self):
        error = HTTPError("https://api.render.com", 401, "secret-token", {}, None)
        with patch.object(self.deploy, "urlopen", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "^Render API returned HTTP 401$"):
                self.deploy.request("services/srv-test/deploys", "secret-token", {"commitId": "a" * 40})


if __name__ == "__main__":
    unittest.main()
