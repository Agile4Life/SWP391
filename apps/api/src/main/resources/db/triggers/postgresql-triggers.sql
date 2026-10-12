-- Invariant business triggers for PostgreSQL
-- Automatically initialized after Hibernate Code-First schema generation

CREATE OR REPLACE FUNCTION scms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION scms_touch_updated_at();

CREATE OR REPLACE FUNCTION scms_check_enrollment_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    previous_class_id BIGINT;
    class_capacity INTEGER;
    booked_count BIGINT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        previous_class_id := OLD.class_id;
    END IF;

    PERFORM id
    FROM classes
    WHERE id = NEW.class_id OR id = previous_class_id
    ORDER BY id
    FOR UPDATE;

    IF NEW.status = 'booked' THEN
        SELECT capacity INTO class_capacity FROM classes WHERE id = NEW.class_id;
        SELECT COUNT(*) INTO booked_count
        FROM class_enrollments
        WHERE class_id = NEW.class_id AND status = 'booked';

        IF booked_count > class_capacity THEN
            RAISE EXCEPTION 'Lớp học đã đầy chỗ (vượt quá capacity cho phép).'
                USING ERRCODE = '23514', CONSTRAINT = 'trg_enrollments_check_capacity';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollments_check_capacity ON class_enrollments;
CREATE TRIGGER trg_enrollments_check_capacity
AFTER INSERT OR UPDATE OF class_id, status ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION scms_check_enrollment_capacity();

CREATE OR REPLACE FUNCTION scms_check_session_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    session_coach_id BIGINT;
    session_room_id BIGINT;
    lock_key BIGINT;
BEGIN
    SELECT coach_id, room_id INTO session_coach_id, session_room_id
    FROM classes WHERE id = NEW.class_id FOR SHARE;

    FOR lock_key IN
        SELECT DISTINCT hashtextextended(resource_key, 0)
        FROM unnest(ARRAY[
            'coach:' || session_coach_id::TEXT,
            'room:' || session_room_id::TEXT
        ]) AS resources(resource_key)
        ORDER BY 1
    LOOP
        PERFORM pg_advisory_xact_lock(lock_key);
    END LOOP;

    IF NEW.status <> 'cancelled' AND EXISTS (
        SELECT 1
        FROM class_sessions existing_session
        JOIN classes existing_class ON existing_class.id = existing_session.class_id
        WHERE existing_session.id <> NEW.id
          AND existing_session.session_date = NEW.session_date
          AND existing_session.status <> 'cancelled'
          AND NEW.start_time < existing_session.end_time
          AND NEW.end_time > existing_session.start_time
          AND (existing_class.coach_id = session_coach_id OR existing_class.room_id = session_room_id)
    ) THEN
        RAISE EXCEPTION 'Huấn luyện viên hoặc phòng tập đã có lịch trùng khung giờ này.'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_check_conflict';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_check_conflict ON class_sessions;
CREATE TRIGGER trg_sessions_check_conflict
AFTER INSERT OR UPDATE OF class_id, session_date, start_time, end_time, status ON class_sessions
FOR EACH ROW EXECUTE FUNCTION scms_check_session_conflict();

CREATE OR REPLACE FUNCTION scms_require_active_membership_for_enrollment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'booked' AND NOT EXISTS (
        SELECT 1
        FROM membership_subscriptions subscription
        WHERE subscription.member_id = NEW.member_id
          AND subscription.status = 'active'
          AND subscription.start_date <= CURRENT_DATE
          AND subscription.end_date >= CURRENT_DATE
        FOR SHARE
    ) THEN
        RAISE EXCEPTION 'Học viên không có gói thành viên còn hiệu lực để đăng ký lớp.'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_enrollments_check_membership';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollments_check_membership ON class_enrollments;
CREATE TRIGGER trg_enrollments_check_membership
BEFORE INSERT OR UPDATE OF member_id, status ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION scms_require_active_membership_for_enrollment();

CREATE OR REPLACE FUNCTION scms_require_active_membership_for_checkin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM membership_subscriptions subscription
        WHERE subscription.member_id = NEW.member_id
          AND subscription.status = 'active'
          AND subscription.start_date <= CURRENT_DATE
          AND subscription.end_date >= CURRENT_DATE
        FOR SHARE
    ) THEN
        RAISE EXCEPTION 'Học viên không có gói thành viên còn hiệu lực để check-in.'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_checkins_check_membership';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkins_check_membership ON center_checkins;
CREATE TRIGGER trg_checkins_check_membership
BEFORE INSERT ON center_checkins
FOR EACH ROW EXECUTE FUNCTION scms_require_active_membership_for_checkin();

-- Filtered unique indexes (cannot be expressed portably in JPA)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_active ON class_enrollments (class_id, member_id) WHERE status = 'booked';
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_active ON class_waitlists (class_id, member_id) WHERE status = 'waiting';
