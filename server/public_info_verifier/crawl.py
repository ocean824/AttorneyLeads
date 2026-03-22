from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from .settings import Settings
from .tracers import TracersClient
from .url_safety import validate_public_url
from .usernames import find_username_profiles


@dataclass(slots=True)
class CrawlPage:
    url: str
    title: str
    markdown: str
    text_excerpt: str
    links: list[str]


class CrawlClient:
    def __init__(self) -> None:
        self._async_crawler = None
        try:
            from crawl4ai import AsyncWebCrawler  # type: ignore
            self._async_crawler = AsyncWebCrawler
        except Exception:
            self._async_crawler = None

    def fetch_page(self, url: str) -> CrawlPage:
        if self._async_crawler:
            return self._fetch_with_crawl4ai(url)
        return self._fetch_with_requests(url)

    def _fetch_with_requests(self, url: str) -> CrawlPage:
        response = requests.get(
            url,
            timeout=20,
            headers={"User-Agent": "AttorneyLeadsVerifier/1.0 (+public-info-verifier)"},
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")
        title = (soup.title.string or "").strip() if soup.title and soup.title.string else url
        text = " ".join(soup.stripped_strings)
        links = _extract_same_doc_links(url, soup)
        return CrawlPage(url=url, title=title, markdown=text, text_excerpt=text[:500], links=links)

    def _fetch_with_crawl4ai(self, url: str) -> CrawlPage:
        import asyncio

        async def runner() -> CrawlPage:
            crawler_cls = self._async_crawler
            assert crawler_cls is not None
            async with crawler_cls() as crawler:
                result = await crawler.arun(url=url)
                markdown = getattr(result, "markdown", None)
                if hasattr(markdown, "fit_markdown"):
                    markdown_text = str(markdown.fit_markdown)
                else:
                    markdown_text = str(markdown or "")
                html = getattr(result, "html", "") or ""
                soup = BeautifulSoup(html, "lxml") if html else BeautifulSoup("", "lxml")
                title = (soup.title.string or "").strip() if soup.title and soup.title.string else url
                links = _extract_same_doc_links(url, soup)
                excerpt = markdown_text[:500]
                return CrawlPage(url=url, title=title, markdown=markdown_text, text_excerpt=excerpt, links=links)

        return asyncio.run(runner())


def _extract_same_doc_links(base_url: str, soup: BeautifulSoup) -> list[str]:
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = urljoin(base_url, anchor["href"])
        parsed = urlparse(href)
        if parsed.scheme not in {"http", "https"}:
            continue
        links.append(href)
    deduped: list[str] = []
    seen: set[str] = set()
    for link in links:
        if link in seen:
            continue
        deduped.append(link)
        seen.add(link)
    return deduped


def deep_crawl(start_url: str, max_depth: int, max_pages: int, allowlist: list[str]) -> dict[str, Any]:
    validated = validate_public_url(start_url, allowlist)
    crawler = CrawlClient()
    queue = deque([(validated.url, 0)])
    visited: set[str] = set()
    pages: list[dict[str, Any]] = []
    root_host = validated.hostname

    while queue and len(visited) < max_pages:
        url, depth = queue.popleft()
        if url in visited or depth > max_depth:
            continue
        safe = validate_public_url(url, allowlist)
        if safe.hostname != root_host:
            continue
        page = crawler.fetch_page(safe.url)
        visited.add(safe.url)
        pages.append(
            {
                "url": page.url,
                "title": page.title,
                "excerpt": page.text_excerpt,
                "depth": depth,
                "linkCount": len(page.links),
            }
        )
        if depth < max_depth:
            for link in page.links:
                if link not in visited:
                    queue.append((link, depth + 1))

    return {
        "startUrl": validated.url,
        "pages": pages,
        "pageCount": len(pages),
        "visited": sorted(visited),
    }


def verify_public_info(payload: dict[str, Any], settings: Settings) -> dict[str, Any]:
    subject = payload.get("subject") or payload.get("name") or payload.get("website") or "Unknown subject"
    field_checks: dict[str, Any] = {}
    crawler = CrawlClient()

    website = payload.get("website")
    crawled_page: dict[str, Any] | None = None
    if website:
        validated = validate_public_url(str(website), settings.public_crawl_allowlist)
        page = crawler.fetch_page(validated.url)
        crawled_page = {
            "url": page.url,
            "title": page.title,
            "excerpt": page.text_excerpt,
        }
        haystack = f"{page.title}\n{page.markdown}".lower()
        for field in ("name", "email", "phone", "address"):
            expected = payload.get(field)
            if not expected:
                continue
            needle = str(expected).strip().lower()
            verified = needle in haystack
            field_checks[field] = {
                "claimed": expected,
                "verified": verified,
                "confidence": 0.9 if verified else 0.2,
                "source": validated.url,
            }
        field_checks["website"] = {
            "claimed": website,
            "verified": True,
            "confidence": 1.0,
            "source": validated.url,
        }

    username_results: list[dict[str, Any]] = []
    if payload.get("username"):
        username_results = find_username_profiles(str(payload["username"]))

    tracers_results = _check_tracers(payload, settings)

    summary_bits = []
    verified_count = sum(1 for item in field_checks.values() if item.get("verified"))
    if field_checks:
        summary_bits.append(f"Verified {verified_count} of {len(field_checks)} claimed fields from public sources.")
    if username_results:
        matches = sum(1 for item in username_results if item.get("verified"))
        summary_bits.append(f"Found {matches} probable public username profile matches.")
    if tracers_results.get("matches"):
        summary_bits.append(f"Tracers returned {len(tracers_results['matches'])} record candidates.")
    summary = " ".join(summary_bits) or "Verification completed with limited evidence."

    return {
        "subject": subject,
        "summary": summary,
        "fieldChecks": field_checks,
        "usernameResults": username_results,
        "tracers": tracers_results,
        "crawl": crawled_page,
    }


def _check_tracers(payload: dict[str, Any], settings: Settings) -> dict[str, Any]:
    client = TracersClient(settings)
    query = {
        key: value
        for key, value in {
            "name": payload.get("name"),
            "email": payload.get("email"),
            "phone": payload.get("phone"),
            "address": payload.get("address"),
        }.items()
        if value
    }
    if not query:
        return {"enabled": settings.tracers_enabled, "matches": [], "raw": None}
    try:
        return client.search_person(query)
    except Exception as exc:
        return {
            "enabled": settings.tracers_enabled,
            "matches": [],
            "error": str(exc),
            "raw": None,
        }
