from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

DEFAULT_USERNAME_PLATFORMS = [
    {"platform": "GitHub", "url": "https://github.com/{username}"},
    {"platform": "LinkedIn", "url": "https://www.linkedin.com/in/{username}"},
    {"platform": "X", "url": "https://x.com/{username}"},
    {"platform": "Facebook", "url": "https://www.facebook.com/{username}"},
    {"platform": "Instagram", "url": "https://www.instagram.com/{username}"},
    {"platform": "TikTok", "url": "https://www.tiktok.com/@{username}"},
]


def _check_platform(username: str, spec: dict[str, str]) -> dict[str, Any]:
    url = spec["url"].format(username=username)
    try:
        response = requests.get(
            url,
            timeout=8,
            allow_redirects=True,
            headers={"User-Agent": "AttorneyLeadsVerifier/1.0 (+public-info-verifier)"},
        )
        verified = 200 <= response.status_code < 300
        confidence = 0.9 if verified else 0.15
        return {
            "platform": spec["platform"],
            "username": username,
            "claimed": username,
            "verified": verified,
            "confidence": confidence,
            "url": response.url or url,
            "statusCode": response.status_code,
            "source": "public-web",
        }
    except requests.RequestException:
        return {
            "platform": spec["platform"],
            "username": username,
            "claimed": username,
            "verified": False,
            "confidence": 0.0,
            "url": url,
            "statusCode": None,
            "source": "public-web",
        }


def find_username_profiles(username: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(6, len(DEFAULT_USERNAME_PLATFORMS))) as pool:
        futures = [pool.submit(_check_platform, username, spec) for spec in DEFAULT_USERNAME_PLATFORMS]
        for future in as_completed(futures):
            results.append(future.result())
    results.sort(key=lambda item: (not item["verified"], item["platform"]))
    return results
