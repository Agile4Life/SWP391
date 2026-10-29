# Direct chat implementation plan

> **For agentic workers:** Use executing-plans inline, task by task. The user authorized implementation and separate commits on 29/10/2026.

**Goal:** Private Member ↔ Receptionist/Coach chat with persistent history and Supabase Realtime updates.
**Architecture:** Spring Boot owns authorization and writes; JPA owns schema. Supabase private Broadcast invalidates each participant's authenticated API data.
**Tech Stack:** Java 21 / Spring Boot 3 / PostgreSQL / React TypeScript / installed supabase-js 2.118.0.
**Spec:** `docs/superpowers/specs/2026-10-29-direct-chat-design.md`.

## Global constraints

- Database only Supabase PostgreSQL, profile supabase, JDBC TLS, Hibernate ddl-auto update; no DDL migrations.
- Chat supports MEMBER ↔ RECEPTIONIST/COACH only. Preserve existing support/AI features.
- API messages/validation in messages.properties, messages_vi.properties and messages_en.properties.
- Existing portal tokens and native scrolling; no new UI dependencies.
- Server secrets never enter browser, broadcast payloads, logs or committed files.

## Review focus

- Concurrent conversation creation and retry after an ambiguous send must not duplicate records.
- Other users, manager accounts and inactive/deleted identities cannot access private chat.
- Late responses after switching chats or unmounting cannot mix transcripts or clear another draft.
- Realtime reconnection/token renewal catches up messages missed during disconnection without losing old history.
- Long text, keyboard navigation and mobile viewport remain usable; browser cannot publish forged chat events.

## Task 1 — Contract and design

Files: this plan, linked spec, `docs/api-contracts/openapi-direct-chat.yaml`.
- [ ] Write request/response schemas and explicit auth/pagination/idempotency errors for `/chat`.
- [ ] Review spec/contract consistency and `git diff --check`.
- [ ] Commit `docs(SCRUM-106): define private direct chat API and implementation plan`.

## Task 2 — Persistent authorized API

Files: `apps/api/src/main/java/com/swp391/scms/chat/{entity,repository,dto,service,controller}/`, matching chat tests and the three message bundles.
Produces: `/chat/contacts?query&page`, `/chat/conversations?page`, POST `/chat/conversations` with `{contactId}`, GET `/chat/conversations/{id}/messages?beforeId&afterId`, POST with `{clientMessageId,message}`. History returns `{items,hasMore}` in chronological order, 50 per fetch. Conversation DTO has peer, timestamps; message DTO has senderId, mine, text and timestamp.
- [ ] Write service/security/controller tests for ownership, roles, inactive/deleted users, validation, cursor behavior and idempotency. Run `./mvnw.cmd -Dtest=ChatServiceTest,ChatControllerTest,ChatSecurityTest test` and observe missing feature failure.
- [ ] Define conversation/message JPA entities, unique pairs and unique `(conversation,sender,clientMessageId)` plus indexes. Use dedicated chat queries instead of changing identity feature behavior.
- [ ] Implement transactions, pair creation serialized on Member's user row, send serialized on conversation row, DTO mapping and i18n. Run focused tests green.
- [ ] Add/run isolated Supabase integration tests when configured; run Maven suite and database config check. Commit `feat(SCRUM-106): add authorized direct chat persistence and API`.

## Task 3 — Private Supabase Broadcast

Files: chat realtime service/controller/DTO/test, current trigger provider script, `application.yml`, `.env.example`, setup guide.
Consumes: active authenticated user from ChatService. Produces POST `/chat/realtime-session`: `{enabled,userId,url,publishableKey,topic,token,expiresAt}` with `Cache-Control: no-store`.
- [ ] Write/run token tests for expiry, scoped signed claims, invalid/missing key and forbidden user.
- [ ] Implement short-lived HS256 JWT with separate server secret and validate publishable key; missing config returns disabled metadata.
- [ ] Add post-insert invalidation trigger for both users; private receiver policy and restrictive chat send/receive policies through existing provider. Never ALTER RLS of realtime.messages; skip global policy installation outside public schema.
- [ ] Verify token tests plus existing provider/database policy suite. Document setup, secret rotation, restrictive policies and manual two-browser authorization check.
- [ ] Commit `feat(SCRUM-106): deliver private chat updates through Supabase Realtime`.

## Task 4 — Chat UI and verification

Files: `apps/web/src/features/chat/` API, subscription, hook, page and CSS/tests; router and portal navigation; DESIGN.md; QA report.
Consumes task 2/3 DTOs. Produces `/messages` with guarded route shared by MEMBER, STAFF and COACH.
- [ ] Write/run subscription/hook/component tests before production UI: private setAuth subscription, token renewal, reconnect catch-up, cleanup, late request isolation, UUID retry/draft preservation and older/newer pagination.
- [ ] Build responsive flat inbox/thread with member contact search and existing portal controls; pure text rendering, live announcements without rereading full transcript, explicit connection state/retry, keyboard labels/focus and scroll preservation.
- [ ] Add guarded route/navigation and document current design. Run all frontend tests, build and lint; run backend suite/database policy after any new fixes.
- [ ] Exercise desktop/mobile and Member/Receptionist/Coach with browser API fixtures, plus real Realtime when dev/test configuration exists. Record exact results and skips in `docs/qa/direct-chat-verification.md`.
- [ ] Update graphify, review diff, fresh whole-branch review, fix important issues with tests. Commit `feat(SCRUM-128): add realtime direct messaging to member and staff portals`.

## Execution record

Implementation runs inline in this workspace on a feature branch to preserve the user's existing checkout and available dependencies. User approval applies to the complete plan already presented; no repeated approval gates. Record task results and any material deviations below as work proceeds.
