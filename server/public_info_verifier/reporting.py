from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TEMPLATE_PATH = Path(__file__).with_name("templates") / "report.html"


def _calculate_overall_score(results: dict[str, Any]) -> float:
    checks: list[float] = []
    for field in ("name", "email", "phone", "address", "website"):
        entry = results.get("fieldChecks", {}).get(field)
        if not isinstance(entry, dict):
            continue
        confidence = entry.get("confidence")
        if isinstance(confidence, (int, float)):
            checks.append(float(confidence))

    username_hits = results.get("usernameResults") or []
    if username_hits:
        verified_scores = [float(item.get("confidence", 0.0)) for item in username_hits if item.get("verified")]
        if verified_scores:
            checks.append(sum(verified_scores) / len(verified_scores))

    if not checks:
        return 0.0
    return round(sum(checks) / len(checks), 4)


def generate_html_report(results: dict[str, Any]) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    score = _calculate_overall_score(results)
    return template.format(
        generated_at=datetime.now(timezone.utc).isoformat(),
        overall_score=f"{score:.0%}",
        subject=_escape(results.get("subject", "Unknown subject")),
        summary=_escape(results.get("summary", "No summary generated.")),
        pretty_json=_escape_json(results),
    )


def _escape(value: Any) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _escape_json(results: dict[str, Any]) -> str:
    import json

    return _escape(json.dumps(results, indent=2, sort_keys=True))
