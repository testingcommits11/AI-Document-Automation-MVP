"""Non-secret OpenRouter configuration.

Keep provider settings here so the only OpenRouter value required in `.env`
is the secret OPENROUTER_API_KEY.
"""

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openrouter/free"

# Optional deterministic OpenRouter models to try after the free router.
# Leave empty unless you intentionally want to add specific models.
OPENROUTER_FALLBACK_MODELS: list[str] = []

OPENROUTER_TIMEOUT = 45.0
OPENROUTER_MAX_TOKENS = 4096

# These headers are optional metadata and do not contain secrets.
OPENROUTER_HTTP_REFERER = "http://localhost:3000"
OPENROUTER_APP_NAME = "AI Document Automation MVP"
