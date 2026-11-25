# API contract workflow

Active scope (updated 25/11/2026): **3 active disciplines** (`Gym` primary, `Boxing`, `Yoga`) across **4 rooms** (`Phòng Gym Tiêu chuẩn`, `Phòng Gym VIP`, `Zen Garden Studio`, `Ring Arena 01`). Recurring group classes (`/api/v1/classes/**`, max 1 `active` class per discipline — `409 SCHEDULING_DISCIPLINE_CLASS_EXISTS`) and session attendance (`/api/v1/attendance/**`) are active (`app.legacy.classes-enabled=true`), keeping `SingleSessionPolicy` (per-session / one-off booking remains disabled) and bidirectional PT 1:1 ↔ group-class conflict guards; see [`openapi-group-classes-restored.yaml`](openapi-group-classes-restored.yaml) and `openapi-sprint3-operations.yaml`.
**Completely removed:** court booking (`com.swp391.scms.courts.*`, `/api/v1/courts/**`, `/api/v1/court-bookings/**`, database triggers, UI/routes, and its OpenAPI contract) as well as disciplines outside `Gym`/`Boxing`/`Yoga` (along with their rooms, routes, demo classes, and AI knowledge).
**Disabled via legacy flags (off by default):** equipment-management and member favorite-discipline endpoints, plus coach reviews, session evaluations, monthly coach reviews, the coach leaderboard (`app.coaching.*`), health metrics/training completion/progress/check-in streak (`app.health.metrics.enabled`), and the Supplement Shop (`app.shop.enabled`). Their historical schemas below remain for reference only; those operations are not part of the active API.
PT 1:1, recurring group classes, group class attendance, memberships/holds, center QR check-in, VNPay/wallet/invoices, training plans, direct chat/support, SÖL AI, and operations are active.

The API team publishes an OpenAPI YAML/JSON export here when an endpoint is ready for frontend integration. Every change must specify request, successful response and common error response.

Frontend may use a local mock matching the contract, but must remove the mock before the Jira ticket is moved to Done.

`openapi-public.yaml` defines the anonymous, read-only landing catalog (`GET /api/v1/public/catalog`) covering active packages, coaches, and upcoming 7-day recurring group-class sessions across the 3 active disciplines (`Gym`, `Boxing`, `Yoga`). It shares package, coach and session data with the authenticated portal; fixture data in browser verification scripts is never used by the application.

[`openapi-pwa-checkin.yaml`](openapi-pwa-checkin.yaml) defines signed gate QR generation and authenticated Member self check-in for the Android/iOS portal PWA (SCRUM-75/83/87 extension).

[`openapi-session-booking.yaml`](openapi-session-booking.yaml) defines per-session class booking: one session, any hand-picked set, a week or a month, and their cancellation.

[`openapi-admin-reconciliation.yaml`](openapi-admin-reconciliation.yaml) defines the read-only admin payment reconciliation: VNPay attempts, recorded IPN/return callbacks, automatic late-confirmation wallet refunds and a per-payment timeline (ADMIN only).

[`openapi-tester-report-2026-11-12.yaml`](openapi-tester-report-2026-11-12.yaml) adds the service description to member payments, the desk history of processed membership requests and the "course already started" enrolment error.

## Sprint 3 Contract Files
- `openapi-sprint3-operations.yaml`: Session attendance and class session cancellation (`SCRUM-111` to `SCRUM-115`).
- `openapi-sprint3-coaching-analytics.yaml`: Training plans, AI workout recommendations and class utilization reports (`SCRUM-116`, `SCRUM-117`, `SCRUM-120`).
- `openapi-sprint3-ai-chat.yaml`: Member AI Chatbot sessions and messages (`SCRUM-118`, `SCRUM-126`).

[`openapi-gym-rooms-equipment-trial.yaml`](openapi-gym-rooms-equipment-trial.yaml) defines room tiers (STANDARD/PLATINUM), equipment management and the 3-day Gold trial verified by CCCD. Member package cancellation requests can no longer be created (the `POST /memberships/cancellations/subscriptions/{id}` endpoint was removed); manager list/approve/reject remain only to resolve legacy pending requests.



