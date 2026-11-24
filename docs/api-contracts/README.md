# API contract workflow

The Gym-only scope retires the class, session attendance, equipment-management, court-booking,
and member favorite-discipline endpoints, plus coach reviews, session evaluations, monthly coach reviews, the coach leaderboard,
health metrics, training completion/progress, the check-in streak and the Supplement Shop. Their historical
schemas below remain for reference; the removed operations are no longer part of the active API.
PT 1:1, training plans and center check-in remain available.

The API team publishes an OpenAPI YAML/JSON export here when an endpoint is ready for frontend integration. Every change must specify request, successful response and common error response.

Frontend may use a local mock matching the contract, but must remove the mock before the Jira ticket is moved to Done.

`openapi-public.yaml` defines the anonymous, read-only landing catalog. It shares package, coach and session data with the authenticated portal; fixture data in browser verification scripts is never used by the application.

[`openapi-pwa-checkin.yaml`](openapi-pwa-checkin.yaml) defines signed gate QR generation and authenticated Member self check-in for the Android/iOS portal PWA (SCRUM-75/83/87 extension).

[`openapi-session-booking.yaml`](openapi-session-booking.yaml) defines per-session class booking: one session, any hand-picked set, a week or a month, and their cancellation.

[`openapi-admin-reconciliation.yaml`](openapi-admin-reconciliation.yaml) defines the read-only admin payment reconciliation: VNPay attempts, recorded IPN/return callbacks, automatic late-confirmation wallet refunds and a per-payment timeline (ADMIN only).

[`openapi-tester-report-2026-11-12.yaml`](openapi-tester-report-2026-11-12.yaml) adds the service description to member payments, the desk history of processed membership requests and the "course already started" enrolment error.

## Sprint 3 Contract Files
- `openapi-sprint3-operations.yaml`: Session attendance and class session cancellation (`SCRUM-111` to `SCRUM-115`).
- `openapi-sprint3-coaching-analytics.yaml`: Training plans, AI workout recommendations and class utilization reports (`SCRUM-116`, `SCRUM-117`, `SCRUM-120`).
- `openapi-sprint3-ai-chat.yaml`: Member AI Chatbot sessions and messages (`SCRUM-118`, `SCRUM-126`).

[`openapi-gym-rooms-equipment-trial.yaml`](openapi-gym-rooms-equipment-trial.yaml) defines room tiers (STANDARD/PLATINUM), equipment management and the 3-day Gold trial verified by CCCD. Member package cancellation requests can no longer be created (the `POST /memberships/cancellations/subscriptions/{id}` endpoint was removed); manager list/approve/reject remain only to resolve legacy pending requests.



