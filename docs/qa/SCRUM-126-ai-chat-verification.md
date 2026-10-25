# SCRUM-126 — AI chatbot verification

Member Portal mounts the existing LiquidGlassChatbot once. Session list/create/history/message APIs use JWT through shared apiFetch. The backend returns complete JSON; the frontend applies a short typing effect and respects reduced motion.

## Provider configuration

The new chat-only adapter uses these backend environment variables (mapped in application.yml):

- SCMS_AI_CHAT_PROVIDER: openai or gemini (default disabled).
- SCMS_AI_CHAT_API_KEY: authorized provider credential, backend only.
- SCMS_AI_CHAT_MODEL: an available model ID authorized for that account; required, no assumed default.

No .env values were changed. No paid provider requests were made during implementation. Existing MockAiClient/OpenAiRestClient/GeminiRestClient remain outside the chat path; they are used by the separate recommendation feature and are not proof of real provider integration.

Chat calls fixed provider HTTPS endpoints with 10-second connect and 30-second read timeouts. Missing configuration, upstream errors or empty content return sanitized 503 errors; they never produce a fake answer. A successful call persists the question and answer in the existing transaction. Frontend network uncertainty triggers history reconciliation instead of repeating POST; known provider failures permit resending because the transaction has not persisted messages.

Request formats: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat), [Gemini generateContent](https://ai.google.dev/api/generate-content).

## E2E pending

Visual fixtures (API intercepted in a temporary test page, removed after capture): `scrum126-desktop.png` at 1440×900 and `scrum126-mobile.png` at 390×844. Browser used software rendering in the test environment; hardware GPU shader performance still needs checking on the target device. The generated browser profiles and temporary fixture were removed.

Use a backend reviewed for safe startup and an isolated Supabase dev/test environment. Configure an authorized model/key with explicit approval for provider costs, then verify MEMBER login, actual provider response, persisted chronological history after reload, New Chat retaining old sessions, and rejection of another MEMBER's session. Check 401/403/503 and interrupted requests. No schema changes are required by SCRUM-126. Do not restart a shared Supabase backend solely to run this checklist.
