/**
 * AI Planetary Assistant frontend controller.
 *
 * The browser only talks to the local FastAPI backend. The EVREN API key is
 * never present in this file or in any other frontend asset. The backend is
 * expected at http://127.0.0.1:8001 unless overridden before this module runs:
 *
 *   window.__ASSISTANT_API_BASE__ = "http://127.0.0.1:8001";
 */

const DEFAULT_API_BASE = 'http://127.0.0.1:8001';
const MAX_QUESTION_LENGTH = 2000;

function resolveApiBase() {
  const configured = window.__ASSISTANT_API_BASE__;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE;
}

function fallbackMessage(status) {
  switch (status) {
    case 402:
      return 'EVREN kredi bakiyesi yetersiz. EVREN hesabınızdaki kullanım kotasını kontrol edin.';
    case 403:
      return (
        'EVREN LLM kullanım şartları henüz kabul edilmemiş. Sunucuda ' +
        "'python -m backend.evren_terms --accept' komutunu çalıştırın."
      );
    case 429:
      return 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.';
    case 503:
      return (
        'AI asistanı yapılandırılmamış. Sunucudaki .env dosyasında ' +
        'EVREN_LLM_API_KEY değişkenini ayarlayın.'
      );
    case 502:
      return 'EVREN servisine ulaşılamadı. Lütfen tekrar deneyin.';
    case 422:
      return 'Soru geçersiz. Lütfen 1–2000 karakter arasında bir soru yazın.';
    default:
      return 'Asistan şu anda yanıt veremiyor. Lütfen tekrar deneyin.';
  }
}

export function createAssistant() {
  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-question');
  const sendButton = document.getElementById('assistant-send');
  const status = document.getElementById('assistant-status');
  const response = document.getElementById('assistant-response');
  const answer = document.getElementById('assistant-answer');

  if (!form || !input || !sendButton || !status || !response || !answer) {
    return null;
  }

  const apiBase = resolveApiBase();
  let busy = false;

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    sendButton.textContent = value ? 'Gönderiliyor…' : 'Gönder';
    form.setAttribute('aria-busy', String(value));
    status.hidden = !value;
  }

  function showError(message) {
    answer.textContent = message;
    response.hidden = false;
    response.classList.add('is-error');
  }

  function showAnswer(text) {
    answer.textContent = text;
    response.hidden = false;
    response.classList.remove('is-error');
  }

  async function ask(question) {
    if (busy) {
      return;
    }

    response.hidden = true;
    answer.textContent = '';
    response.classList.remove('is-error');
    setBusy(true);

    try {
      const result = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      const raw = await result.text();
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!result.ok) {
        const detail = data && typeof data.detail === 'string' ? data.detail : '';
        throw new Error(detail || fallbackMessage(result.status));
      }

      const text = data && typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!text) {
        throw new Error('Asistan boş bir yanıt döndürdü. Lütfen tekrar deneyin.');
      }

      showAnswer(text);
    } catch (error) {
      if (error instanceof TypeError) {
        showError(
          'Asistan sunucusuna ulaşılamadı. FastAPI sunucusunun 8001 portunda ' +
          'çalıştığını kontrol edin.',
        );
      } else {
        showError(
          error instanceof Error
            ? error.message
            : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();

    if (!question) {
      showError('Lütfen bir soru yazın.');
      input.focus();
      return;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      showError(
        `Soru çok uzun. Lütfen ${MAX_QUESTION_LENGTH} karakterden kısa bir soru yazın.`,
      );
      input.focus();
      return;
    }

    ask(question);
  });

  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  return {
    apiBase,
    ask,
    get busy() {
      return busy;
    },
  };
}
