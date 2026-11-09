"""Read and accept the EVREN LLM gateway terms of service.

The official ``evren-sdk`` client does not expose the one-time terms endpoints,
so this small helper calls them directly on the same gateway with the same
Bearer authentication that the SDK uses.

Usage (from the project root, with the virtual environment active):

    python -m backend.evren_terms            # print the current terms
    python -m backend.evren_terms --accept   # accept the current version

The API key is read from ``EVREN_LLM_API_KEY`` in ``.env`` and is never printed.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from evren_sdk import __version__

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BASE_URL = "https://evren-llmapi.ssyz.org.tr"


def _key() -> str:
    return (os.getenv("EVREN_LLM_API_KEY") or "").strip()


def _base_url() -> str:
    return (os.getenv("EVREN_LLM_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def _client(key: str) -> httpx.Client:
    return httpx.Client(
        base_url=_base_url(),
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": f"evren-sdk/{__version__} (python)",
        },
        timeout=60.0,
    )


def _fail(response: httpx.Response, key: str) -> None:
    """Print a short error without ever exposing credentials."""

    detail = response.text.strip().replace(key, "[REDACTED]") if key else response.text.strip()
    print(f"EVREN isteği başarısız oldu (HTTP {response.status_code}).")
    if detail:
        print(detail[:1000])
    raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="EVREN LLM kullanım şartlarını okuyun veya kabul edin.",
    )
    parser.add_argument(
        "--accept",
        action="store_true",
        help="Mevcut şart sürümünü kabul et (hukuki onay).",
    )
    args = parser.parse_args()

    load_dotenv(PROJECT_ROOT / ".env")
    key = _key()
    if not key:
        print(
            "EVREN_LLM_API_KEY bulunamadı. .env dosyasına anahtarınızı ekleyin.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    with _client(key) as client:
        terms_response = client.get("/v1/terms/text")
        if terms_response.status_code != 200:
            _fail(terms_response, key)

        terms = terms_response.json()
        version = terms.get("version")
        if not isinstance(version, int):
            print("EVREN yanıtında geçerli bir şart sürümü bulunamadı.", file=sys.stderr)
            raise SystemExit(1)

        title = terms.get("title") or "EVREN LLM Kullanım Şartları"
        print(f"{title} — sürüm {version}")
        doc_path = terms.get("doc_path")
        if doc_path:
            print(f"Belge: {doc_path}")
        print("-" * 72)
        print(terms.get("content", "").strip())
        print("-" * 72)

        if not args.accept:
            print(
                "Şartları kabul etmek için: python -m backend.evren_terms --accept"
            )
            return

        accept_response = client.post("/v1/terms/accept", json={"version": version})
        if accept_response.status_code != 200:
            _fail(accept_response, key)

        accepted = accept_response.json()
        print(
            "Kabul edildi: sürüm "
            f"{accepted.get('accepted_version', version)}"
            f" ({accepted.get('accepted_at', 'zaman bilgisi yok')})"
        )


if __name__ == "__main__":
    main()
