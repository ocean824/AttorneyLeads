from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip().lower() for item in value.split(",") if item.strip()]


@dataclass(slots=True)
class Settings:
    public_crawl_allowlist: list[str]
    tracers_api_key: Optional[str]
    tracers_api_base_url: Optional[str]
    tracers_person_search_path: str
    tracers_http_method: str
    tracers_api_key_header: str
    tracers_api_key_prefix: str
    tracers_timeout_seconds: int
    tracers_enabled: bool

    @classmethod
    def from_env(cls) -> "Settings":
        api_key = os.getenv("TRACERS_API_KEY")
        base_url = os.getenv("TRACERS_API_BASE_URL")
        return cls(
            public_crawl_allowlist=_split_csv(os.getenv("PUBLIC_CRAWL_ALLOWLIST")),
            tracers_api_key=api_key,
            tracers_api_base_url=base_url,
            tracers_person_search_path=os.getenv("TRACERS_PERSON_SEARCH_PATH", "/api/person-search"),
            tracers_http_method=os.getenv("TRACERS_HTTP_METHOD", "POST").upper(),
            tracers_api_key_header=os.getenv("TRACERS_API_KEY_HEADER", "Authorization"),
            tracers_api_key_prefix=os.getenv("TRACERS_API_KEY_PREFIX", "Bearer "),
            tracers_timeout_seconds=int(os.getenv("TRACERS_TIMEOUT_SECONDS", "20")),
            tracers_enabled=bool(api_key and base_url),
        )
