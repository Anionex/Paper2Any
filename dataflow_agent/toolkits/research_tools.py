from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

import httpx


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data:
            self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(self._parts)


def _safe_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        return parsed.netloc or url
    except Exception:
        return url


async def serpapi_search(query: str, api_key: str, engine: str = "google", num: int = 10) -> List[Dict[str, Any]]:
    params = {
        "engine": engine,
        "q": query,
        "api_key": api_key,
        "num": num,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get("https://serpapi.com/search.json", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("organic_results", [])[:num]:
        url = item.get("link") or item.get("url") or ""
        snippet = item.get("snippet") or item.get("snippet_highlighted_words") or ""
        if isinstance(snippet, list):
            snippet = " ".join(str(s) for s in snippet)
        results.append({
            "title": item.get("title") or item.get("snippet") or "Untitled",
            "url": url,
            "snippet": snippet,
            "source": _safe_domain(url)
        })
    return results


async def google_cse_search(query: str, api_key: str, cx: str, num: int = 10, start: int = 1) -> List[Dict[str, Any]]:
    params = {
        "key": api_key,
        "cx": cx,
        "q": query,
        "num": max(1, min(10, num)),
        "start": max(1, start),
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get("https://www.googleapis.com/customsearch/v1", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("items", [])[:num]:
        url = item.get("link") or ""
        results.append({
            "title": item.get("title") or item.get("snippet") or "Untitled",
            "url": url,
            "snippet": item.get("snippet") or "",
            "source": _safe_domain(url)
        })
    return results


async def brave_search(query: str, api_key: str, count: int = 10, *, enable_summary: bool = False) -> Dict[str, Any]:
    headers = {"X-Subscription-Token": api_key}
    params = {"q": query, "count": max(1, min(20, count))}
    if enable_summary:
        params["summary"] = 1
    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        resp = await client.get("https://api.search.brave.com/res/v1/web/search", params=params)
        resp.raise_for_status()
        return resp.json()


def _extract_brave_results(payload: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
    results = []
    for item in payload.get("web", {}).get("results", [])[:limit]:
        url = item.get("url") or ""
        results.append({
            "title": item.get("title") or item.get("description") or "Untitled",
            "url": url,
            "snippet": item.get("description") or "",
            "source": _safe_domain(url)
        })
    return results


async def brave_summarizer(summary_key: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not summary_key:
        return None
    headers = {"X-Subscription-Token": api_key}
    params = {"key": summary_key, "inline_references": "true"}
    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        resp = await client.get("https://api.search.brave.com/res/v1/summarizer/search", params=params)
        if resp.status_code >= 400:
            return None
        return resp.json()


async def search_web(
    provider: str,
    query: str,
    api_key: str,
    *,
    engine: str = "google",
    num: int = 10,
    google_cse_id: Optional[str] = None,
    brave_enable_summarizer: bool = False,
) -> Dict[str, Any]:
    provider = (provider or "serpapi").lower()
    if provider == "serpapi":
        results = await serpapi_search(query=query, api_key=api_key, engine=engine, num=num)
        return {"results": results, "summary": None}
    if provider == "google_cse":
        if not google_cse_id:
            raise ValueError("google_cse_id required")
        results = await google_cse_search(query=query, api_key=api_key, cx=google_cse_id, num=num)
        return {"results": results, "summary": None}
    if provider == "brave":
        payload = await brave_search(query=query, api_key=api_key, count=num, enable_summary=brave_enable_summarizer)
        results = _extract_brave_results(payload, num)
        summary = None
        if brave_enable_summarizer:
            summary_key = payload.get("summarizer", {}).get("key") or ""
            summary = await brave_summarizer(summary_key, api_key)
        return {"results": results, "summary": summary}
    raise ValueError("Unsupported search provider")


def _strip_html(html: str) -> str:
    if not html:
        return ""
    html = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html)
    parser = _TextExtractor()
    parser.feed(html)
    text = parser.get_text()
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def fetch_page_text(url: str, max_chars: int = 8000) -> str:
    if not url:
        return ""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; Paper2Any/1.0; +https://paper2any.ai)"
    }
    try:
        async with httpx.AsyncClient(timeout=20, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type:
                return ""
            html = resp.text
    except Exception:
        return ""

    text = _strip_html(html)
    if max_chars and len(text) > max_chars:
        return text[:max_chars] + "..."
    return text
