#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "python") not in sys.path:
    sys.path.insert(0, str(ROOT / "python"))

from bridge import EUROPEPMC_SEARCH_URL, OPENALEX_WORKS_URL, make_reader  # noqa: E402

SOURCE_ORDER = ["arxiv", "openalex", "europepmc"]
DEFAULT_QUERY = "agent memory"
HTTP_TIMEOUT = 30


def fetch_json(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(f"{url}?{query}", headers={"User-Agent": "OhMyPaper/1.0"})
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def run_probe(name: str, callback: Callable[[], Dict[str, Any]]) -> Dict[str, Any]:
    started = time.perf_counter()
    try:
        details = callback()
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        return {"source": name, "ok": True, "duration_ms": duration_ms, "details": details}
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        return {"source": name, "ok": False, "duration_ms": duration_ms, "error": str(exc)}


def probe_arxiv(query: str) -> Dict[str, Any]:
    reader = make_reader()
    result = reader.search(query, size=3, search_mode="hybrid") or {}
    papers = result.get("results") or []
    if not papers:
        raise RuntimeError("arXiv search returned no results")
    first = papers[0]
    return {
        "query": query,
        "total": result.get("total", len(papers)),
        "sample": {
            "arxiv_id": first.get("arxiv_id"),
            "title": first.get("title"),
        },
    }


def probe_openalex(query: str) -> Dict[str, Any]:
    result = fetch_json(OPENALEX_WORKS_URL, {"search": query, "per-page": 3})
    works = result.get("results") or []
    if not works:
        raise RuntimeError("OpenAlex search returned no results")
    first = works[0]
    return {
        "query": query,
        "count": result.get("meta", {}).get("count"),
        "sample": {
            "id": first.get("id"),
            "title": first.get("display_name") or first.get("title"),
            "publication_date": first.get("publication_date"),
        },
    }


def probe_europepmc(query: str) -> Dict[str, Any]:
    result = fetch_json(
        EUROPEPMC_SEARCH_URL,
        {"query": query, "format": "json", "pageSize": 3, "resultType": "lite"},
    )
    papers = ((result.get("resultList") or {}).get("result") or [])
    if not papers:
        raise RuntimeError("Europe PMC search returned no results")
    first = papers[0]
    return {
        "query": query,
        "hit_count": result.get("hitCount"),
        "sample": {
            "id": first.get("id"),
            "source": first.get("source"),
            "title": first.get("title"),
            "firstPublicationDate": first.get("firstPublicationDate"),
        },
    }


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe the actual keyword-search sources used by the desktop app.")
    parser.add_argument(
        "--sources",
        default=",".join(SOURCE_ORDER),
        help="Comma-separated sources to test: arxiv,openalex,europepmc",
    )
    parser.add_argument("--query", default=DEFAULT_QUERY, help="Keyword query used for all probes")
    parser.add_argument("--json", action="store_true", help="Print JSON output")
    return parser.parse_args(argv)


def format_text_report(results: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for item in results:
        status = "✓" if item["ok"] else "✕"
        lines.append(f"{status} {item['source']} ({item['duration_ms']} ms)")
        if item["ok"]:
            for key, value in item.get("details", {}).items():
                lines.append(f"  - {key}: {value}")
        else:
            lines.append(f"  - error: {item.get('error', 'unknown error')}")
    passed = sum(1 for item in results if item["ok"])
    lines.append(f"\nSummary: {passed}/{len(results)} passed")
    return "\n".join(lines)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    requested_sources = [part.strip() for part in args.sources.split(",") if part.strip()]
    unknown = [item for item in requested_sources if item not in SOURCE_ORDER]
    if unknown:
        print(f"Unsupported sources: {', '.join(unknown)}", file=sys.stderr)
        return 2

    probes: Dict[str, Callable[[], Dict[str, Any]]] = {
        "arxiv": lambda: probe_arxiv(args.query),
        "openalex": lambda: probe_openalex(args.query),
        "europepmc": lambda: probe_europepmc(args.query),
    }
    results = [run_probe(source, probes[source]) for source in requested_sources]

    if args.json:
        print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
    else:
        print(format_text_report(results))

    return 0 if all(item["ok"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
