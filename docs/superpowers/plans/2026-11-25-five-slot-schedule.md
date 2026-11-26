# 5-Slot Fixed Schedule System (07:00–19:30) Implementation Plan

> **For agentic workers:** Executed via 3 disjoint parallel subagents (Backend `apps/api/**`, Frontend `apps/web/**` excluding `explore3d/**`, Docs `AGENTS.md` + `DESIGN.md` + `docs/**`), followed by coordinator integration review, full verification, PR, CI, merge to `main`, and VPS deployment.

**Goal:** Replace continuous-hour scheduling (`06:00–22:00`, 1h PT slots) across the entire portal and backend with 5 fixed canonical slots (`Slot 1`–`Slot 5`, `07:00–19:30`) shared by group classes and 1:1 PT, remove the 3-consecutive-slot coach rest limit, reset legacy non-slot schedule data cleanly on startup and reseed fresh 5-slot data, and refine calendar event cards (remove left 4px stripe border and display coach name underneath).

**Architecture:** Keep existing `start_time`/`end_time` TIME columns in PostgreSQL and enforce exact 1-to-1 membership in `ScheduleSlot` (`SLOT_1`..`SLOT_5`) at service and PostgreSQL trigger layers. On frontend, replace all continuous-hour grids (`WeeklyTimetable`, `MemberCalendar`) with 5 fixed Slot rows whose left header renders `Slot N` above `HH:mm – HH:mm`, replace free `TimePicker` inputs in Manager forms and 15-hour pills in Member PT booking with 5-slot selectors, and show coach names on clean uniform-border event cards.

**Tech Stack:** Java 21, Spring Boot 3, JPA/Hibernate, PostgreSQL triggers, React 19, TypeScript, Vitest, Maven.

**Spec:** `docs/superpowers/specs/2026-11-25-five-slot-schedule-design.md`

## Global Constraints
- Exactly 5 valid slots across BOTH group classes and 1:1 PT:
  - `Slot 1`: `07:00:00` – `09:30:00` (`07:00 – 09:30`)
  - `Slot 2`: `09:45:00` – `11:15:00` (`09:45 – 11:15`)
  - `Slot 3`: `11:30:00` – `14:00:00` (`11:30 – 14:00`)
  - `Slot 4`: `14:15:00` – `16:45:00` (`14:15 – 16:45`)
  - `Slot 5`: `17:00:00` – `19:30:00` (`17:00 – 19:30`)
- Coach 3-consecutive-slot rest rule (`requiresCoachRest` / `trg_coach_bookings_rest_required` / `coach_rest`) is REMOVED completely.
- PT 1:1 pricing (`200,000 VND / slot` or 1 package PT quota) and 2-hour advance booking (`ADVANCE_MINUTES_REQUIRED = 120`) are PRESERVED.
- 3 active disciplines (`Gym`, `Boxing`, `Yoga`), max 1 active recurring class per discipline, no ad-hoc `+ Thêm buổi` UI, 3D hidden (`explore3d/**` untouched).
- All 3 i18n bundles (`messages.properties`, `messages_vi.properties`, `messages_en.properties`) must stay 100% synchronized.
- Calendar event cards must have NO thick left border stripe (`border-left: 4px`) and MUST display coach name underneath.

## Review Focus
1. Legacy DB rows on VPS with old hours (`06:30`, `07:30`, `19:00`, 1h PT) must be wiped cleanly without FK violation and reseeded into the 5 canonical slots on first boot, while remaining a no-op on every subsequent boot.
2. PostgreSQL trigger `scms_is_valid_schedule_slot` must allow `DELETE` and status transitions to `'cancelled'` / `'completed'` on any row while rejecting `INSERT`/`UPDATE` of active/confirmed sessions outside the 5 slots.
3. All existing backend tests using hardcoded 1h times (e.g. `10:00–11:00`, `18:00–19:00`) must be updated to canonical `ScheduleSlot` ranges, plus explicit rejection tests for non-slot ranges (`08:00–09:00`, `07:00–09:00`, `19:30–20:30`).
4. Frontend `WeeklyTimetable` and `MemberCalendar` must keep `+N lớp` overflow clustering working when 3 disciplines overlap in the same slot (e.g. all 3 in Slot 1 on Manager's Full Week tab).
5. Bilingual coverage (`website.coverage.test.ts`), ESLint (`--max-warnings=0`), and `tsc -b && vite build` must pass with 0 errors and 0 warnings.

---

### Track 1 (Backend Subagent — `apps/api/**`)
- **Create:** `apps/api/src/main/java/com/swp391/scms/common/ScheduleSlot.java`, `apps/api/src/test/java/com/swp391/scms/common/ScheduleSlotTest.java`, `apps/api/src/main/java/com/swp391/scms/facilities/LegacyScheduleSlotResetRunner.java`, `apps/api/src/test/java/com/swp391/scms/facilities/LegacyScheduleSlotResetRunnerTest.java`
- **Modify:**
  - `apps/api/src/main/java/com/swp391/scms/scheduling/service/ClassService.java`
  - `apps/api/src/main/java/com/swp391/scms/coaching/dto/CoachAvailableSlotDto.java`
  - `apps/api/src/main/java/com/swp391/scms/coaching/service/CoachBookingService.java`
  - `apps/api/src/main/java/com/swp391/scms/common/GlobalExceptionHandler.java`
  - `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql`
  - `apps/api/src/main/java/com/swp391/scms/demo/DemoClassSeeder.java`
  - `apps/api/src/main/java/com/swp391/scms/demo/DemoDataSeeder.java`
  - `apps/api/src/main/java/com/swp391/scms/ai/service/AiChatService.java`
  - `apps/api/src/main/resources/ai/sol-knowledge.md`
  - `apps/api/src/main/resources/i18n/messages.properties`, `messages_vi.properties`, `messages_en.properties`
  - All impacted tests under `apps/api/src/test/**`
- **Verify:** `cd apps/api && ./mvnw test` → 0 failures, 0 errors.

### Track 2 (Frontend Subagent — `apps/web/**`, excluding `apps/web/src/features/explore3d/**`)
- **Create:** `apps/web/src/features/schedule/slots.ts`, `apps/web/src/features/schedule/slots.test.ts`
- **Modify:**
  - `apps/web/src/features/schedule/timetable.ts`, `WeeklyTimetable.tsx`, `WeeklyTimetable.test.tsx`, `calendar.css`
  - `apps/web/src/features/member/components/MemberCalendar.tsx`, `MemberCalendar.css`, `MemberCalendar.test.tsx`
  - `apps/web/src/features/classes/components/ClassFormModals.tsx`, `ClassListTable.tsx`, `ClassSessionDetailModal.tsx`, `ManagerClassesPage.tsx`, `ManagerClassesPage.test.tsx`
  - `apps/web/src/features/member/coachBookingApi.ts`, `components/MemberCoachBookingView.tsx`, `components/MemberCoachBookingView.test.tsx`, `components/MemberGroupClassesView.tsx`, `components/MemberGroupClassesView.test.tsx`, `memberLabels.ts`
  - `apps/web/src/features/coaching/CoachClassesPage.tsx`, `CoachClassesPage.test.tsx`, `coachTimetable.ts`, `CoachAttendancePage.tsx`, `PtAttendancePage.tsx`
  - `apps/web/src/features/landing/components/CatalogSections.tsx`
  - Any impacted tests under `apps/web/src/**` (outside `explore3d/**`)
- **Verify:** `cd apps/web && npm test && npm run lint && npm run build` → 0 failures, 0 warnings, exit 0.

### Track 3 (Docs & OpenAPI Subagent — `AGENTS.md`, `DESIGN.md`, `docs/**` excluding `docs/superpowers/**`)
- **Modify:** `AGENTS.md`, `DESIGN.md`, `docs/BUSINESS_FLOWS.md`, `docs/api-contracts/openapi-group-classes-restored.yaml`, `docs/api-contracts/openapi-public.yaml`
- **Verify:** OpenAPI YAML parses cleanly and all active docs describe the exact 5 slots (`07:00–19:30`), removal of 3-consecutive-slot coach rest, and slot-based portal calendars.
