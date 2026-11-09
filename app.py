"""FastAPI backend for the AI Planetary Assistant.

The browser never sees the EVREN API key. It sends the user's question to this
local backend, which forwards it to the EVREN LLM gateway through the official
``evren-sdk`` package. The key is read only from ``EVREN_LLM_API_KEY`` in the
project's ``.env`` file (or the process environment).

Run from the project root:

    uvicorn backend.app:app --reload --port 8001
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from evren_sdk import (
    EvrenLLMClient,
    EvrenLLMError,
    LLMAuthenticationError,
    LLMInsufficientCreditsError,
    LLMNotFoundError,
    LLMRateLimitError,
    LLMServiceError,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("planetary.assistant")

MODEL = (os.getenv("EVREN_LLM_MODEL") or "auto").strip() or "auto"
MAX_TOKENS = int(os.getenv("EVREN_LLM_MAX_TOKENS") or "700")
DEFAULT_ORIGINS = "http://localhost:8000,http://127.0.0.1:8000"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in (os.getenv("ALLOWED_ORIGINS") or DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

SYSTEM_PROMPT = """Sen "AI Gezegen Asistanı" adlı, astronomi ve gezegen fiziği
konusunda uzmanlaşmış bir eğitim asistanısın. Görevin, kullanıcının Türkçe
sorularını anlaşılır, doğru ve eğitim amaçlı biçimde yanıtlamaktır.

Uzmanlık alanların:
- Gezegen hareketleri ve iki cisim problemi
- Newton'un evrensel kütleçekim yasası
- Kepler'in üç yasası
- Yörünge dışmerkezliği (e), yarı-büyük eksen (a), perihelion ve aphelion
- Yörünge hızı, vis-viva denklemi, özgül enerji ve açısal momentum
- Velocity Verlet gibi sayısal yörünge integrasyonu yöntemleri

Yanıt kuralları:
- Her zaman Türkçe yanıt ver.
- Yanıtı düz metin olarak yaz. Markdown yıldızları (**, *) veya LaTeX $ işaretleri
  kullanma; sembolleri doğrudan yaz (örneğin e = 0.5, a = 1 AU).
- Önce kısa ve sezgisel bir açıklama yap; gerektiğinde denklemi ve sembollerin
  anlamını da ver.
- Sayısal bir örnek verirken birimleri açıkça belirt.
- Bu simülatörün ideal iki cisim modelini kullandığını, gezegen kütlesini,
  genel göreliliği, bozulmaları ve ışınım basıncını ihmal ettiğini hatırlat.
- Bilmediğin veya emin olmadığın bir konuda uydurma; belirsizliği açıkça söyle.
- Yanıtı gereksiz uzatma; eğitim amaçlı, sıcak ve anlaşılır bir ton kullan.
- Kullanıcı istemedikçe kod yazma; fizik kavramlarına odaklan."""


class ChatRequest(BaseModel):
    """A single user question sent by the browser."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Kullanıcının Türkçe sorusu.",
    )


class ChatResponse(BaseModel):
    """The assistant's Turkish answer."""

    answer: str
    model: str


app = FastAPI(
    title="AI Planetary Assistant",
    description=(
        "Planetary Orbit Simulator için EVREN LLM destekli, yalnızca yerel "
        "ağdan erişilen soru-cevap servisi."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


def _api_key() -> str:
    """Read the key from the environment without ever logging or returning it."""

    return (os.getenv("EVREN_LLM_API_KEY") or "").strip()


def _retry_message(exc: LLMRateLimitError) -> str:
    retry_after = getattr(exc, "retry_after", None)
    if isinstance(retry_after, (int, float)) and retry_after > 0:
        return (
            "EVREN istek sınırına ulaşıldı. Lütfen yaklaşık "
            f"{int(retry_after)} saniye sonra tekrar deneyin."
        )
    return "EVREN istek sınırına ulaşıldı. Lütfen bir süre sonra tekrar deneyin."


def _log_llm_error(exc: EvrenLLMError) -> None:
    """Log only non-sensitive error metadata (never the key, prompt, or answer)."""

    logger.warning(
        "EVREN request failed: type=%s status=%s code=%s request_id=%s",
        type(exc).__name__,
        getattr(exc, "status_code", None),
        getattr(exc, "code", None),
        getattr(exc, "request_id", None),
    )


@app.get("/api/health")
def health() -> dict[str, object]:
    """Lightweight readiness check. Never exposes the API key."""

    return {
        "status": "ok",
        "service": "ai-planetary-assistant",
        "model": MODEL,
        "configured": bool(_api_key()),
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    """Forward one Turkish question to the EVREN LLM gateway."""

    question = payload.message.strip()
    if not question:
        raise HTTPException(
            status_code=422,
            detail="Lütfen boş olmayan bir soru yazın.",
        )

    api_key = _api_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI asistanı yapılandırılmamış. Sunucudaki .env dosyasında "
                "EVREN_LLM_API_KEY değişkenini ayarlayın."
            ),
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    try:
        with EvrenLLMClient(api_key=api_key) as client:
            result = client.chat(
                MODEL,
                messages,
                max_tokens=MAX_TOKENS,
            )
    except LLMAuthenticationError as exc:
        _log_llm_error(exc)
        if getattr(exc, "code", None) == "terms_not_accepted":
            raise HTTPException(
                status_code=403,
                detail=(
                    "EVREN LLM kullanım şartları henüz kabul edilmemiş. "
                    "Sunucuda 'python -m backend.evren_terms' ile metni okuyup "
                    "'python -m backend.evren_terms --accept' ile kabul edin."
                ),
            ) from None
        raise HTTPException(
            status_code=502,
            detail=(
                "EVREN API anahtarı doğrulanamadı. Anahtarın etkin olduğundan "
                "ve .env dosyasında doğru tanımlandığından emin olun."
            ),
        ) from None
    except LLMInsufficientCreditsError as exc:
        _log_llm_error(exc)
        raise HTTPException(
            status_code=402,
            detail=(
                "EVREN kredi bakiyesi yetersiz. EVREN hesabınızdaki kullanım "
                "kotalarını kontrol edin."
            ),
        ) from None
    except LLMRateLimitError as exc:
        _log_llm_error(exc)
        raise HTTPException(status_code=429, detail=_retry_message(exc)) from None
    except LLMNotFoundError as exc:
        _log_llm_error(exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "EVREN üzerinde istenen model bulunamadı. "
                "EVREN_LLM_MODEL ayarını kontrol edin."
            ),
        ) from None
    except LLMServiceError as exc:
        _log_llm_error(exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "EVREN servisi şu anda yanıt veremiyor. Lütfen kısa bir süre "
                "sonra tekrar deneyin."
            ),
        ) from None
    except EvrenLLMError as exc:
        _log_llm_error(exc)
        raise HTTPException(
            status_code=502,
            detail="EVREN isteği başarısız oldu. Lütfen tekrar deneyin.",
        ) from None
    except Exception as exc:  # noqa: BLE001 - keep unexpected details server-side
        # Log only the exception type: never log the key, prompt, or answer.
        logger.error("Unexpected assistant error: %s", type(exc).__name__)
        raise HTTPException(
            status_code=500,
            detail="Asistan beklenmeyen bir sunucu hatasıyla karşılaştı.",
        ) from None

    answer = (getattr(result, "content", "") or "").strip()
    if not answer:
        raise HTTPException(
            status_code=502,
            detail="Asistan boş bir yanıt döndürdü. Lütfen tekrar deneyin.",
        )

    return ChatResponse(answer=answer, model=MODEL)
