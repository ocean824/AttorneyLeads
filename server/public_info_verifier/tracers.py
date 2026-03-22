from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import requests

from .settings import Settings


@dataclass(slots=True)
class TracersClient:
    settings: Settings

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.settings.tracers_api_key:
            headers[self.settings.tracers_api_key_header] = f"{self.settings.tracers_api_key_prefix}{self.settings.tracers_api_key}"
        return headers

    def search_person(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.settings.tracers_enabled:
            return {"enabled": False, "matches": [], "raw": None}

        endpoint = urljoin(f"{self.settings.tracers_api_base_url.rstrip('/')}/", self.settings.tracers_person_search_path.lstrip('/'))
        method = self.settings.tracers_http_method
        if method == "GET":
            response = requests.get(
                endpoint,
                params=payload,
                headers=self._headers(),
                timeout=self.settings.tracers_timeout_seconds,
            )
        else:
            response = requests.post(
                endpoint,
                json=payload,
                headers=self._headers(),
                timeout=self.settings.tracers_timeout_seconds,
            )

        response.raise_for_status()
        data = response.json()
        return {
            "enabled": True,
            "matches": _normalize_matches(data),
            "raw": data,
        }


def _normalize_matches(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        for key in ("matches", "results", "data", "records"):
            if isinstance(data.get(key), list):
                items = data[key]
                break
        else:
            items = [data]
    else:
        return []

    normalized: list[dict[str, Any]] = []
    for item in items[:10]:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "name": item.get("name") or item.get("fullName") or item.get("full_name"),
                "address": item.get("address") or item.get("currentAddress"),
                "phone": item.get("phone") or item.get("phones"),
                "email": item.get("email") or item.get("emails"),
                "source": "tracers",
                "raw": item,
            }
        )
    return normalized
