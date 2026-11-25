# Implementation Plan: Restore Group Classes (Overlap-Proof Manager Schedule) & Standardize 5-Role Sidebar

**Spec:** `docs/superpowers/specs/2026-11-25-group-classes-and-sidebar-design.md`
**Branch:** `feat/group-classes-and-sidebar`

## Task Breakdown & Verification Order

### Task 1: Backend — Enable Group Classes, 2-Way PT Conflict Guard & Complete Class Notifications
- `apps/api/src/main/resources/application.yml`: set `app.legacy.classes-enabled: ${APP_LEGACY_CLASSES_ENABLED:true}`.
- `apps/api/src/main/java/com/swp391/scms/scheduling/ClassController.java`: align `@PreAuthorize` on `createSession` & `rescheduleSession` to `hasAnyRole('CENTER_MANAGER', 'MANAGER')`.
- `apps/api/src/main/java/com/swp391/scms/scheduling/service/ClassService.java`:
  - Inject optional `@Autowired(required = false) CoachBookingRepository` (null-safe for standalone unit tests) and check active coach PT bookings in `ensureNoSessionConflict`, throwing `ConflictException("SCHEDULING_COACH_PT_CONFLICT", "error.scheduling.coach_pt_conflict", ...)`.
  - In `rescheduleSession`, notify all `booked` enrolled members (`schedule_change`, `class_session`, `sessionId`) and the assigned coach (`schedule_change`, `class_session`, `sessionId`).
- `apps/api/src/main/java/com/swp391/scms/scheduling/service/ClassSessionService.java`:
  - In `cancelSession`, when cancelled by someone other than the assigned coach, also notify the assigned coach (`schedule_change`, `class_session`, `sessionId`).
- `apps/api/src/main/java/com/swp391/scms/scheduling/service/EnrollmentService.java`:
  - Send `class_enrollment` notification on paid `checkoutCourse` and on `cancelCourseEnrollment`.
- `apps/api/src/main/java/com/swp391/scms/coaching/service/CoachAssignmentService.java`:
  - Fix member PT reassignment notification `actionPath` from `/member/classes?tab=coach_booking` → `/member/classes?tab=pt`.
- `apps/api/src/main/resources/i18n/messages{,_vi,_en}.properties`:
  - Add synchronized keys: `error.scheduling.coach_pt_conflict`, `notifications.session.rescheduled.title`, `notifications.session.rescheduled.body`, `notifications.session.rescheduled.coach_body`, `notifications.session.cancelled.coach_body`, `notifications.booking.course_checkout.body`.
- **Tests:** Add/update unit tests in `CoachBookingServiceTest`, `ClassServiceTest`, `ClassSessionServiceTest`, `EnrollmentServiceTest`, `CoachAssignmentServiceTest`, `NotificationSchedulerTest`, `MessageBundlesConsistencyTest`. Run `./mvnw test`.

### Task 2: Frontend Shared — Standardize 5-Role Sidebar, Routes, `TimePicker`, and `schedule/` Primitives
- Restore `apps/web/src/shared/ui/TimePicker.tsx` and its styles (`timepicker.css` / `datepicker.css` tokens) from git history (`9cd7a3a0^1`).
- Standardize `apps/web/src/features/portal/portalNavigation.ts`, `PortalShell.tsx`, `MemberNotificationsPage.tsx`, `MemberCardPage.tsx`, `CoachTrainingPlanPage.tsx`, `staffSourceCatalog.ts` across all 5 roles (`MEMBER`, `COACH`, `STAFF`, `MANAGER`, `ADMIN`).
- Update `apps/web/src/app/router.tsx`: add `/manager/classes`, `/coach/attendance`, `/coach/attendance/:sessionId`, and redirect `/staff/classes` role-aware (`/manager/classes` for MANAGER, `/staff/reception` for STAFF).
- Restore & upgrade `apps/web/src/features/schedule/`:
  - `timetable.ts`: add `groupVisibleLanes(positioned, maxVisible)` + discipline accent helper.
  - `WeeklyTimetable.tsx`: render max visible lanes + `+N lớp` overflow trigger + interactive overflow list modal/popover.
  - `RoomDayTimetable.tsx`: new resource-grid (`Phòng × Khung giờ`) with sticky room columns, day selector strip, discipline color badges, zero-overlap layout, and slot click passing `{ date, startTime, endTime, roomId }`.
  - `calendar.css`: add styles for overflow button/modal & `RoomDayTimetable` using `--sol-accent*` / `--portal-*` tokens.
- **Tests:** `timetable.test.ts`, `WeeklyTimetable.test.tsx`, `RoomDayTimetable.test.tsx`, `portalNavigation.test.ts`, `AppLayout.test.tsx`.

### Task 3: Manager Classes UI (`/manager/classes`) & Manager Coach Assignments
- Restore `apps/web/src/features/classes/classesApi.ts` and build modular Manager Classes feature:
  - `ManagerClassesPage.tsx`: 1-click discipline filter chips (`Lịch tổng cả tuần` + each discipline with weekly session count), sub-filter by specific class/room/coach, 4 view tabs (`Lịch theo môn / lớp`, `Lịch tổng cả tuần`, `Tổng quan theo phòng`, `Danh sách khóa học`).
  - `ClassSessionDetailModal.tsx`: full session details + live enrolled student roster + Reschedule / Cancel / Edit actions.
  - `ClassFormModals.tsx`: Create recurring class / Add session / Edit class / Reschedule session / Cancel session modals using `Select`, `DatePicker`, `TimePicker`, client pre-conflict checks, and server error display.
  - `ClassListTable.tsx`: searchable course & session table.
- `apps/web/src/features/manager/ManagerCoachAssignmentsPage.tsx`: stop filtering out `'CLASS'` assignments so class trainees display cleanly.
- **Tests:** `classesApi.test.ts`, `ManagerClassesPage.test.tsx`.

### Task 4: Member & Coach Group-Class UI Restoration
- Restore `apps/web/src/features/member/memberClassesApi.ts` (course list, quota, checkout, enroll, cancel, my enrollments).
- Upgrade `apps/web/src/features/member/MemberClassesPage.tsx`: 3 tabs (`Lịch của tôi`, `Đăng ký lớp học`, `Đặt lịch HLV 1:1`), supporting `?tab=classes`, `?tab=pt`, `?tab=coach_booking`, `?discipline=...`.
- Restore group-class rendering in `apps/web/src/features/member/components/MemberCalendar.tsx` (merged group class + PT 1:1 timetable) and upcoming classes in `MemberDashboardPage.tsx`.
- Restore `apps/web/src/features/coaching/attendanceApi.ts` & `CoachAttendancePage.tsx` (batch present/absent + history) and update `CoachClassesPage.tsx` + `coachTimetable.ts` (merged group class + PT timetable, working `Học viên phụ trách` tab merging class + PT trainees).
- **Tests:** `MemberClassesPage.test.tsx`, `MemberCalendar.test.tsx`, `MemberDashboardPage*.test.tsx`, `CoachClassesPage.test.tsx`, `CoachAttendancePage.test.tsx`.

### Task 5: Notifications Routing Audit & Edge-Case Testing
- Update `apps/web/src/features/member/notificationsApi.ts` for all 5 roles (`MEMBER`, `COACH`, `MANAGER`, `STAFF`, `ADMIN`):
  - Member: `class_session`/`class_enrollment`/`class_reminder`/`schedule_change` → `/member/classes`; `coach_booking`/`pt_booking` → `/member/classes?tab=pt`.
  - Coach: `/staff/attendance/:id` → `/coach/attendance/:id`; `session_attendance` → `/coach/attendance`; `pt_attendance` → `/coach/pt-attendance`; `class_session`/`schedule_change`/`coach_booking` → `/coach/classes`.
  - Manager: `/staff/classes`, `class_session`, `class_enrollment`, `schedule_change` → `/manager/classes`.
- Update & expand `notificationsApi.test.ts` and `NotificationsPopover.test.tsx` covering every role and edge case.

### Task 6: Update Documentation & OpenAPI Contracts
- Update `AGENTS.md`, `DESIGN.md`, `docs/BUSINESS_FLOWS.md`, and `docs/api-contracts/` (`openapi-classes.yaml` / `README.md`) to reflect restored group classes and standardized 5-role sidebar.

### Task 7: Full Verification & Final Audit
- Backend: `cd apps/api && ./mvnw test` (verify 0 failures, 0 errors, check `MessageBundlesConsistencyTest`, `DatabasePolicyTest`, `DatabaseProfilesTest`).
- Frontend: `cd apps/web && npm test && npm run lint && npm run build` (verify 0 test failures, 0 lint warnings, clean `tsc -b && vite build`).
- Check `git diff --check`, inspect all changed files against `DESIGN.md` & `AGENTS.md` invariants, commit cleanly on `feat/group-classes-and-sidebar`.
