from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .crawl import deep_crawl, verify_public_info
from .reporting import generate_html_report
from .settings import Settings
from .url_safety import UnsafeUrlError, validate_public_url
from .usernames import find_username_profiles


def _read_payload(path: str | None) -> dict[str, Any]:
    if path:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    raw = sys.stdin.read().strip()
    return json.loads(raw) if raw else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Attorney Leads public info verifier")
    sub = parser.add_subparsers(dest="command", required=True)

    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("--input-json")

    crawl_parser = sub.add_parser("crawl")
    crawl_parser.add_argument("url")

    deep_parser = sub.add_parser("deep-crawl")
    deep_parser.add_argument("url")
    deep_parser.add_argument("--depth", type=int, default=1)
    deep_parser.add_argument("--max-pages", type=int, default=10)

    user_parser = sub.add_parser("username")
    user_parser.add_argument("username")

    report_parser = sub.add_parser("report")
    report_parser.add_argument("--input-json")

    args = parser.parse_args()
    settings = Settings.from_env()

    try:
        if args.command == "verify":
            payload = _read_payload(args.input_json)
            print(json.dumps(verify_public_info(payload, settings)))
        elif args.command == "crawl":
            validated = validate_public_url(args.url, settings.public_crawl_allowlist)
            print(json.dumps({"ok": True, "url": validated.url, "hostname": validated.hostname}))
        elif args.command == "deep-crawl":
            print(json.dumps(deep_crawl(args.url, args.depth, args.max_pages, settings.public_crawl_allowlist)))
        elif args.command == "username":
            print(json.dumps({"username": args.username, "results": find_username_profiles(args.username)}))
        elif args.command == "report":
            payload = _read_payload(args.input_json)
            results = verify_public_info(payload, settings)
            print(generate_html_report(results))
        else:
            parser.error("Unknown command")
            return 2
        return 0
    except UnsafeUrlError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
