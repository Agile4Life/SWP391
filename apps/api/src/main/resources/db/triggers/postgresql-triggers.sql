-- Các trigger nghiệp vụ bất biến cho PostgreSQL
-- Tự động khởi tạo sau khi Hibernate sinh schema theo hướng Code-First

CREATE OR REPLACE FUNCTION scms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
    NEW.updated_at := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh');
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
SET search_path FROM CURRENT
AS $$
DECLARE
    previous_class_id BIGINT;
    class_capacity INTEGER;
    booked_count BIGINT;
    busiest_session BIGINT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        previous_class_id := OLD.class_id;
    END IF;

    -- Giữ nhất quán thứ tự khóa với session_bookings (khóa member-schedule trước classes FOR UPDATE) để triệt tiêu deadlock AB-BA.
    IF NEW.status = 'booked' THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(current_schema() || ':member-schedule:' || NEW.member_id::TEXT, 0));
    END IF;

    PERFORM id
    FROM classes
    WHERE id = NEW.class_id OR id = previous_class_id
    ORDER BY id
    FOR UPDATE;

    -- Lưu lại chỗ đã được giữ sẵn trong cùng lớp thì không chiếm thêm chỗ mới.
    IF NEW.status = 'booked' AND NOT (TG_OP = 'UPDATE' AND OLD.status = 'booked' AND OLD.class_id = NEW.class_id) THEN
        SELECT capacity INTO class_capacity FROM classes WHERE id = NEW.class_id;
        SELECT COUNT(*) INTO booked_count
        FROM class_enrollments
        WHERE class_id = NEW.class_id AND status = 'booked';
        -- Lượt đặt theo từng buổi cũng chiếm chỗ: một suất đăng ký cả lớp phải vừa với buổi đông nhất.
        SELECT COALESCE(MAX(per_session), 0) INTO busiest_session
        FROM (SELECT COUNT(*) AS per_session
              FROM session_bookings b JOIN class_sessions s ON s.id = b.session_id
              WHERE s.class_id = NEW.class_id AND b.status = 'booked'
              GROUP BY b.session_id) counts;

        IF booked_count + busiest_session > class_capacity THEN
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

-- 5 khung giờ cố định (07:00 – 20:30, mỗi slot 2h30) dùng chung cho lớp học nhóm và buổi PT 1:1.
CREATE OR REPLACE FUNCTION scms_is_valid_schedule_slot(p_start TIME, p_end TIME)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path FROM CURRENT
AS $$
    SELECT COALESCE(
        (p_start = TIME '07:00:00' AND p_end = TIME '09:30:00')
        OR (p_start = TIME '09:45:00' AND p_end = TIME '12:15:00')
        OR (p_start = TIME '12:30:00' AND p_end = TIME '15:00:00')
        OR (p_start = TIME '15:15:00' AND p_end = TIME '17:45:00')
        OR (p_start = TIME '18:00:00' AND p_end = TIME '20:30:00'),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION scms_check_session_conflict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    session_coach_id BIGINT;
    session_room_id BIGINT;
    session_discipline_id BIGINT;
    session_class_status VARCHAR(20);
    lock_key BIGINT;
BEGIN
    IF NEW.status <> 'scheduled' THEN
        RETURN NEW;
    END IF;
    IF NOT scms_is_valid_schedule_slot(NEW.start_time, NEW.end_time) THEN
        RAISE EXCEPTION 'trg_schedule_invalid_slot'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_schedule_invalid_slot';
    END IF;
    SELECT coach_id, room_id, discipline_id, status
    INTO session_coach_id, session_room_id, session_discipline_id, session_class_status
    FROM classes WHERE id = NEW.class_id FOR SHARE;

    -- ponytail: một khóa chung bảo vệ giới hạn hai bộ môn; tách theo ngày/slot nếu đo thấy tranh chấp cao.
    FOR lock_key IN
        SELECT DISTINCT hashtextextended(current_schema() || ':' || resource_key, 0)
        FROM unnest(ARRAY[
            'slot-discipline-limit',
            'coach:' || session_coach_id::TEXT,
            'room:' || session_room_id::TEXT,
            'discipline:' || session_discipline_id::TEXT
        ]) AS resources(resource_key)
        WHERE resource_key IS NOT NULL
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

    IF NEW.status <> 'cancelled' AND COALESCE(session_class_status, 'active') = 'active' AND EXISTS (
        SELECT 1
        FROM class_sessions existing_session
        JOIN classes existing_class ON existing_class.id = existing_session.class_id
        WHERE existing_session.id <> NEW.id
          AND existing_session.session_date = NEW.session_date
          AND existing_session.status <> 'cancelled'
          AND existing_class.status = 'active'
          AND NEW.start_time < existing_session.end_time
          AND NEW.end_time > existing_session.start_time
          AND existing_class.discipline_id = session_discipline_id
    ) THEN
        RAISE EXCEPTION 'Bộ môn này đã có lớp học khác trùng khung giờ.'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_check_discipline_conflict';
    END IF;

    IF COALESCE(session_class_status, 'active') = 'active' AND (
        SELECT COUNT(DISTINCT existing_class.discipline_id)
        FROM class_sessions existing_session
        JOIN classes existing_class ON existing_class.id = existing_session.class_id
        WHERE existing_session.id <> NEW.id
          AND existing_session.session_date = NEW.session_date
          AND NEW.start_time < existing_session.end_time AND NEW.end_time > existing_session.start_time
          AND existing_session.status = 'scheduled' AND existing_class.status = 'active'
          AND existing_class.discipline_id <> session_discipline_id
    ) >= 2 THEN
        RAISE EXCEPTION 'trg_sessions_slot_discipline_limit'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_slot_discipline_limit';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_check_conflict ON class_sessions;
CREATE TRIGGER trg_sessions_check_conflict
AFTER INSERT OR UPDATE OF class_id, session_date, start_time, end_time, status ON class_sessions
FOR EACH ROW EXECUTE FUNCTION scms_check_session_conflict();

-- Kiểm tra lại xung đột HLV, phòng tập và cùng bộ môn cho toàn bộ buổi học tương lai khi cập nhật lớp (coach/room/discipline/kích hoạt lại).
CREATE OR REPLACE FUNCTION scms_check_class_sessions_conflict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    business_date date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    lock_key BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM class_sessions s
        WHERE s.class_id = NEW.id
          AND s.status = 'scheduled'
          AND s.session_date >= business_date
    ) THEN
        RETURN NEW;
    END IF;

    FOR lock_key IN
        SELECT DISTINCT hashtextextended(current_schema() || ':' || resource_key, 0)
        FROM unnest(ARRAY[
            'slot-discipline-limit',
            'coach:' || NEW.coach_id::TEXT,
            'room:' || NEW.room_id::TEXT,
            'discipline:' || NEW.discipline_id::TEXT
        ]) AS resources(resource_key)
        WHERE resource_key IS NOT NULL
        ORDER BY 1
    LOOP
        PERFORM pg_advisory_xact_lock(lock_key);
    END LOOP;

    IF (OLD.coach_id IS DISTINCT FROM NEW.coach_id
        OR OLD.room_id IS DISTINCT FROM NEW.room_id
        OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'))
       AND EXISTS (
        SELECT 1
        FROM class_sessions my_session
        JOIN class_sessions existing_session
          ON existing_session.session_date = my_session.session_date
         AND existing_session.id <> my_session.id
         AND existing_session.status <> 'cancelled'
         AND my_session.start_time < existing_session.end_time
         AND my_session.end_time > existing_session.start_time
        JOIN classes existing_class
          ON existing_class.id = existing_session.class_id
        WHERE my_session.class_id = NEW.id
          AND my_session.status = 'scheduled'
          AND my_session.session_date >= business_date
          AND (existing_class.coach_id = NEW.coach_id OR existing_class.room_id = NEW.room_id)
    ) THEN
        RAISE EXCEPTION 'Huấn luyện viên hoặc phòng tập đã có lịch trùng khung giờ này.'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_check_conflict';
    END IF;

    IF COALESCE(NEW.status, 'active') = 'active'
       AND (OLD.discipline_id IS DISTINCT FROM NEW.discipline_id
            OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'))
       AND EXISTS (
        SELECT 1
        FROM class_sessions my_session
        JOIN class_sessions existing_session
          ON existing_session.session_date = my_session.session_date
         AND existing_session.id <> my_session.id
         AND existing_session.status <> 'cancelled'
         AND my_session.start_time < existing_session.end_time
         AND my_session.end_time > existing_session.start_time
        JOIN classes existing_class
          ON existing_class.id = existing_session.class_id
        WHERE my_session.class_id = NEW.id
          AND my_session.status = 'scheduled'
          AND my_session.session_date >= business_date
          AND existing_class.status = 'active'
          AND existing_class.discipline_id = NEW.discipline_id
    ) THEN
        RAISE EXCEPTION 'Bộ môn này đã có lớp học khác trùng khung giờ.'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_check_discipline_conflict';
    END IF;

    IF NEW.status = 'active'
       AND (OLD.discipline_id IS DISTINCT FROM NEW.discipline_id
            OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'))
       AND EXISTS (
        SELECT 1 FROM class_sessions my_session
        WHERE my_session.class_id = NEW.id AND my_session.status = 'scheduled'
          AND my_session.session_date >= business_date
          AND (SELECT COUNT(DISTINCT other_class.discipline_id)
               FROM class_sessions other_session JOIN classes other_class ON other_class.id = other_session.class_id
               WHERE other_session.class_id <> NEW.id
                 AND other_session.session_date = my_session.session_date
                 AND my_session.start_time < other_session.end_time AND my_session.end_time > other_session.start_time
                 AND other_session.status = 'scheduled' AND other_class.status = 'active'
                 AND other_class.discipline_id <> NEW.discipline_id) >= 2
    ) THEN
        RAISE EXCEPTION 'trg_sessions_slot_discipline_limit'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_sessions_slot_discipline_limit';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_check_session_conflict ON classes;
CREATE TRIGGER trg_classes_check_session_conflict
AFTER UPDATE OF coach_id, room_id, discipline_id, status ON classes
FOR EACH ROW
WHEN (
    OLD.coach_id IS DISTINCT FROM NEW.coach_id
    OR OLD.room_id IS DISTINCT FROM NEW.room_id
    OR OLD.discipline_id IS DISTINCT FROM NEW.discipline_id
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active')
)
EXECUTE FUNCTION scms_check_class_sessions_conflict();

-- Gỡ bỏ các trigger và hàm đặt sân cũ trên CSDL đã tồn tại (tính năng đặt sân đã ngừng).
DROP TRIGGER IF EXISTS trg_classes_check_court_room ON classes;
DROP FUNCTION IF EXISTS scms_guard_class_court_room();
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'court_bookings'
    ) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS trg_court_bookings_check_conflict ON %I.court_bookings', current_schema());
    END IF;
END;
$$;
DROP FUNCTION IF EXISTS scms_guard_court_booking();

CREATE OR REPLACE FUNCTION scms_require_active_membership_for_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    business_date date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
    IF NEW.status = 'booked' AND NOT EXISTS (
        SELECT 1
        FROM membership_subscriptions subscription
        WHERE subscription.member_id = NEW.member_id
          AND subscription.status = 'active'
          AND subscription.start_date <= business_date
          AND subscription.end_date >= business_date
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

-- Đặt chỗ theo buổi: mỗi buổi có danh sách chỗ riêng. Các lượt ghi danh toàn lớp (dữ liệu cũ) cũng chiếm một chỗ trong
-- mọi buổi của lớp đó, nên cả hai đều được cộng lại để đối chiếu với sức chứa lớp.
CREATE OR REPLACE FUNCTION scms_check_session_booking_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    target_class_id BIGINT;
    class_capacity INTEGER;
    class_wide_count BIGINT;
    booked_count BIGINT;
BEGIN
    IF NEW.status <> 'booked' THEN
        RETURN NEW;
    END IF;

    SELECT class_id INTO target_class_id FROM class_sessions WHERE id = NEW.session_id;
    SELECT capacity INTO class_capacity FROM classes WHERE id = target_class_id FOR UPDATE;

    SELECT COUNT(*) INTO class_wide_count
    FROM class_enrollments
    WHERE class_id = target_class_id AND status = 'booked';

    SELECT COUNT(*) INTO booked_count
    FROM session_bookings
    WHERE session_id = NEW.session_id AND status = 'booked';

    IF class_wide_count + booked_count > class_capacity THEN
        RAISE EXCEPTION 'Buổi học đã đầy chỗ (vượt quá capacity cho phép).'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_session_bookings_check_capacity';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_bookings_check_capacity ON session_bookings;
CREATE TRIGGER trg_session_bookings_check_capacity
AFTER INSERT OR UPDATE OF session_id, status ON session_bookings
FOR EACH ROW EXECUTE FUNCTION scms_check_session_booking_capacity();

CREATE OR REPLACE FUNCTION scms_require_membership_for_session_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    business_date date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    target_date date;
BEGIN
    IF NEW.status <> 'booked' OR (TG_OP = 'UPDATE' AND OLD.status = 'booked'
            AND OLD.session_id = NEW.session_id AND OLD.member_id = NEW.member_id) THEN
        RETURN NEW;
    END IF;
    SELECT session_date INTO target_date FROM class_sessions WHERE id = NEW.session_id;
    IF NOT EXISTS (
        SELECT 1
        FROM membership_subscriptions subscription
        WHERE subscription.member_id = NEW.member_id
          AND subscription.status = 'active'
          AND subscription.start_date <= LEAST(business_date, target_date)
          AND subscription.end_date >= GREATEST(business_date, target_date)
        FOR SHARE
    ) THEN
        RAISE EXCEPTION 'Học viên không có gói thành viên còn hiệu lực để đăng ký lớp.'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_enrollments_check_membership';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_bookings_check_membership ON session_bookings;
CREATE TRIGGER trg_session_bookings_check_membership
BEFORE INSERT OR UPDATE OF session_id, member_id, status ON session_bookings
FOR EACH ROW EXECUTE FUNCTION scms_require_membership_for_session_booking();

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_booking_active ON session_bookings (session_id, member_id) WHERE status = 'booked';

CREATE OR REPLACE FUNCTION scms_require_active_membership_for_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    business_date date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.member_id IS NOT DISTINCT FROM NEW.member_id
       AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    IF (NEW.status IS NULL OR NEW.status = 'GRANTED') AND NOT EXISTS (
        SELECT 1
        FROM membership_subscriptions subscription
        WHERE subscription.member_id = NEW.member_id
          AND subscription.status = 'active'
          AND subscription.start_date <= business_date
          AND subscription.end_date >= business_date
          AND NOT (
              UPPER(COALESCE(subscription.hold_status, '')) = 'APPROVED'
              AND subscription.hold_start_date IS NOT NULL
              AND subscription.hold_end_date IS NOT NULL
              AND business_date BETWEEN subscription.hold_start_date AND subscription.hold_end_date
          )
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
BEFORE INSERT OR UPDATE OF member_id, status ON center_checkins
FOR EACH ROW EXECUTE FUNCTION scms_require_active_membership_for_checkin();

-- Các unique index có điều kiện lọc (không thể biểu diễn độc lập nền tảng trong JPA)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_active ON class_enrollments (class_id, member_id) WHERE status = 'booked';

DO $$
DECLARE
    has_duplicate_active_plans BOOLEAN := FALSE;
BEGIN
    PERFORM set_config('lock_timeout', '10s', true);

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'notifications'
          AND column_name = 'message'
          AND is_nullable = 'NO'
    ) THEN
        EXECUTE format('ALTER TABLE %I.notifications ALTER COLUMN message DROP NOT NULL', current_schema());
    END IF;

    -- Lễ tân và quản lý có các phiên chat AI riêng không gắn với hội viên (dùng staff_user_id thay thế).
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ai_chat_sessions'
          AND column_name = 'member_id'
          AND is_nullable = 'NO'
    ) THEN
        EXECUTE format('ALTER TABLE %I.ai_chat_sessions ALTER COLUMN member_id DROP NOT NULL', current_schema());
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'membership_subscriptions'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname = 'membership_subscriptions'
          AND c.conname = 'ck_subscriptions_status'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%pending_payment%'
          AND pg_get_constraintdef(c.oid) LIKE '%active%'
          AND pg_get_constraintdef(c.oid) LIKE '%frozen%'
          AND pg_get_constraintdef(c.oid) LIKE '%expired%'
          AND pg_get_constraintdef(c.oid) LIKE '%cancelled%'
    ) THEN
        EXECUTE format('ALTER TABLE %I.membership_subscriptions DROP CONSTRAINT IF EXISTS ck_subscriptions_status', current_schema());
        EXECUTE format('ALTER TABLE %I.membership_subscriptions ADD CONSTRAINT ck_subscriptions_status CHECK (status IN (''pending_payment'',''active'',''frozen'',''expired'',''cancelled''))', current_schema());
    END IF;

    -- Mỗi cặp hội viên–HLV chỉ có một giáo án đang hoạt động; giáo án bị thay thế được lưu làm lịch sử ('superseded') và có thể áp dụng lại.
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'training_plans'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema()
              AND t.relname = 'training_plans'
              AND c.conname = 'ck_plans_status'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%draft%'
              AND pg_get_constraintdef(c.oid) LIKE '%active%'
              AND pg_get_constraintdef(c.oid) LIKE '%superseded%'
              AND pg_get_constraintdef(c.oid) LIKE '%completed%'
              AND pg_get_constraintdef(c.oid) LIKE '%cancelled%'
        ) THEN
            EXECUTE format('ALTER TABLE %I.training_plans DROP CONSTRAINT IF EXISTS ck_plans_status', current_schema());
            EXECUTE format('ALTER TABLE %I.training_plans ADD CONSTRAINT ck_plans_status CHECK (status IN (''draft'',''active'',''superseded'',''completed'',''cancelled''))', current_schema());
        END IF;
        -- Các giáo án được kích hoạt trước quy tắc này có thể để một HLV có nhiều giáo án active cho cùng hội viên: giữ lại bản mới nhất
        -- cho mỗi cặp hội viên–HLV và chuyển phần còn lại sang lịch sử. Giáo án từ các HLV khác của hội viên vẫn giữ trạng thái active.
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %1$I.training_plans p WHERE p.status = ''active'' AND EXISTS (SELECT 1 FROM %1$I.training_plans newer WHERE newer.member_id = p.member_id AND newer.coach_id = p.coach_id AND newer.status = ''active'' AND (newer.created_at > p.created_at OR (newer.created_at = p.created_at AND newer.id > p.id))))', current_schema())
        INTO has_duplicate_active_plans;
        IF has_duplicate_active_plans THEN
            EXECUTE format('UPDATE %1$I.training_plans p SET status = ''superseded'' WHERE p.status = ''active'' AND EXISTS (SELECT 1 FROM %1$I.training_plans newer WHERE newer.member_id = p.member_id AND newer.coach_id = p.coach_id AND newer.status = ''active'' AND (newer.created_at > p.created_at OR (newer.created_at = p.created_at AND newer.id > p.id)))', current_schema());
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'member_trial_redemptions'
          AND column_name = 'cccd'
          AND is_nullable = 'NO'
    ) THEN
        EXECUTE format('ALTER TABLE %I.member_trial_redemptions ALTER COLUMN cccd DROP NOT NULL', current_schema());
        EXECUTE format('ALTER TABLE %I.member_trial_redemptions DROP CONSTRAINT IF EXISTS uq_trial_cccd', current_schema());
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'member_trial_redemptions'
          AND column_name = 'subscription_id'
          AND is_nullable = 'NO'
    ) THEN
        EXECUTE format('ALTER TABLE %I.member_trial_redemptions ALTER COLUMN subscription_id DROP NOT NULL', current_schema());
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'member_trial_redemptions'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'document_type'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN document_type VARCHAR(20) DEFAULT ''CCCD'' NOT NULL', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'nationality'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN nationality VARCHAR(100)', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'front_image_url'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN front_image_url TEXT', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'back_image_url'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN back_image_url TEXT', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'status'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN status VARCHAR(30) DEFAULT ''APPROVED'' NOT NULL', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'reviewed_by'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN reviewed_by BIGINT', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'reviewed_at'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN reviewed_at TIMESTAMP', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'member_trial_redemptions'
              AND column_name = 'rejection_reason'
        ) THEN
            EXECUTE format('ALTER TABLE %I.member_trial_redemptions ADD COLUMN rejection_reason VARCHAR(500)', current_schema());
        END IF;

        EXECUTE format('UPDATE %I.member_trial_redemptions SET document_type = ''CCCD'' WHERE document_type IS NULL', current_schema());
        EXECUTE format('UPDATE %I.member_trial_redemptions SET status = CASE WHEN subscription_id IS NOT NULL THEN ''APPROVED'' ELSE ''PENDING_APPROVAL'' END WHERE status IS NULL', current_schema());
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'members'
          AND column_name = 'identity_verified'
    ) THEN
        EXECUTE format('UPDATE %I.members SET identity_verified = FALSE WHERE identity_verified IS NULL', current_schema());
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'vnpay_transactions'
    ) THEN
        -- Chỉ đánh dấu hết hạn các giao dịch đã quá expires_at (giờ Việt Nam); khởi động lại không được làm lỗi thanh toán vẫn còn mở trên cổng.
        EXECUTE format('UPDATE %I.vnpay_transactions SET status = ''failed'' WHERE status = ''pending'' AND gateway_transaction_no IS NULL AND expires_at < (CURRENT_TIMESTAMP AT TIME ZONE ''Asia/Ho_Chi_Minh'')', current_schema());
    END IF;

    -- Chuẩn hóa các giá trị thông báo cũ, sau đó áp dụng cùng danh sách ràng buộc như Notification.java (bỏ qua nếu constraint đã khớp).
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'notifications'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema()
              AND t.relname = 'notifications'
              AND c.conname = 'ck_notifications_type'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%schedule_change%'
              AND pg_get_constraintdef(c.oid) LIKE '%package_expiry%'
              AND pg_get_constraintdef(c.oid) LIKE '%class_reminder%'
              AND pg_get_constraintdef(c.oid) LIKE '%system%'
              AND pg_get_constraintdef(c.oid) LIKE '%support_reply%'
              AND pg_get_constraintdef(c.oid) LIKE '%payment%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''order''%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''booking''%'
        ) THEN
            EXECUTE format('UPDATE %I.notifications SET type = CASE WHEN lower(type) IN (''order'',''wallet'') THEN ''payment'' WHEN lower(type) = ''booking'' THEN ''class_reminder'' ELSE ''system'' END WHERE type NOT IN (''schedule_change'',''package_expiry'',''class_reminder'',''system'',''support_reply'',''payment'')', current_schema());
            EXECUTE format('ALTER TABLE %I.notifications DROP CONSTRAINT IF EXISTS ck_notifications_type', current_schema());
            EXECUTE format('ALTER TABLE %I.notifications ADD CONSTRAINT ck_notifications_type CHECK (type IN (''schedule_change'',''package_expiry'',''class_reminder'',''system'',''support_reply'',''payment''))', current_schema());
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema()
              AND t.relname = 'notifications'
              AND c.conname = 'ck_notifications_entity_type'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%class_session%'
              AND pg_get_constraintdef(c.oid) LIKE '%membership_subscription%'
              AND pg_get_constraintdef(c.oid) LIKE '%payment%'
              AND pg_get_constraintdef(c.oid) LIKE '%support_request%'
              AND pg_get_constraintdef(c.oid) LIKE '%class_enrollment%'
              AND pg_get_constraintdef(c.oid) LIKE '%training_plan%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''wallet''%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''product_order''%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''booking''%'
              AND pg_get_constraintdef(c.oid) NOT LIKE '%''session_booking''%'
        ) THEN
            EXECUTE format('UPDATE %I.notifications SET related_entity_type = CASE WHEN lower(related_entity_type) IN (''wallet'',''product_order'') THEN ''payment'' WHEN lower(related_entity_type) IN (''booking'',''session_booking'') THEN ''class_session'' ELSE NULL END WHERE related_entity_type IS NOT NULL AND related_entity_type NOT IN (''class_session'',''membership_subscription'',''payment'',''support_request'',''class_enrollment'',''training_plan'')', current_schema());
            EXECUTE format('ALTER TABLE %I.notifications DROP CONSTRAINT IF EXISTS ck_notifications_entity_type', current_schema());
            EXECUTE format('ALTER TABLE %I.notifications ADD CONSTRAINT ck_notifications_entity_type CHECK (related_entity_type IS NULL OR related_entity_type IN (''class_session'',''membership_subscription'',''payment'',''support_request'',''class_enrollment'',''training_plan''))', current_schema());
        END IF;
    END IF;
END;
$$;

-- SCRUM-86: Supabase Broadcast không mang dữ liệu thanh toán/hội viên/số tiền/trạng thái.
-- Mã kênh ẩn danh chỉ được API trả về cho đúng chủ sở hữu đã xác thực.
-- Lệnh gửi tham gia cùng transaction nên thanh toán bị rollback sẽ không phát sự kiện.
CREATE OR REPLACE FUNCTION scms_membership_realtime_invalidation()
RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE channel_id uuid;
BEGIN
    IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT payment_realtime_topic INTO channel_id FROM members WHERE user_id = NEW.member_id;
    IF channel_id IS NOT NULL THEN
        PERFORM realtime.send('{}'::jsonb, 'changed', 'membership:' || channel_id::text, false);
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Sự cố dịch vụ thông báo không bao giờ được làm rollback một thanh toán hợp lệ.
    RAISE WARNING 'Membership invalidation unavailable (SQLSTATE %)', SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_realtime ON payments;
CREATE TRIGGER trg_payments_realtime AFTER INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION scms_membership_realtime_invalidation();

-- SCRUM-106: vô hiệu hóa cache cho chat riêng tư; nội dung tin nhắn không bao giờ rời khỏi API đã xác thực.
CREATE OR REPLACE FUNCTION scms_chat_realtime_invalidation()
RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE member_id bigint; staff_id bigint;
BEGIN
    IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT member_user_id, staff_user_id INTO member_id, staff_id
    FROM chat_conversations WHERE id = NEW.conversation_id;
    PERFORM realtime.send('{}'::jsonb, 'changed', 'scms:chat:' || member_id::text, true);
    PERFORM realtime.send('{}'::jsonb, 'changed', 'scms:chat:' || staff_id::text, true);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Vẫn lưu tin nhắn ngay cả khi Realtime gián đoạn; khi kết nối lại hoặc quay lại cửa sổ sẽ tải phần dữ liệu bị lỡ.
    RAISE WARNING 'Chat invalidation unavailable (SQLSTATE %)', SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_message_realtime ON chat_messages;
CREATE TRIGGER trg_chat_message_realtime AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION scms_chat_realtime_invalidation();

-- Chỉ bản cài đặt ứng dụng ở schema public mới sở hữu các global policy đặt tên này.
-- Các schema integration-test cô lập tuyệt đối không được thay đổi policy trên realtime.messages.
-- RLS đã được bật sẵn trên bảng của Supabase; không dùng ALTER để thay đổi.
DO $$
BEGIN
    IF current_schema() = 'public' AND to_regclass('realtime.messages') IS NOT NULL THEN
        DROP POLICY IF EXISTS scms_chat_receive ON realtime.messages;
        CREATE POLICY scms_chat_receive ON realtime.messages FOR SELECT TO authenticated
        USING (extension = 'broadcast'
            AND (auth.jwt() ->> 'scms_chat_scope') = 'receive'
            AND realtime.topic() = 'scms:chat:' || (auth.jwt() ->> 'scms_chat_user_id'));

        -- PostgreSQL gộp các permissive policy bằng toán tử OR: cần thêm ràng buộc restrictive cho các topic chat
        -- để một receive policy rộng có sẵn không thể làm lộ hộp thư của người dùng khác.
        DROP POLICY IF EXISTS scms_chat_receive_guard ON realtime.messages;
        CREATE POLICY scms_chat_receive_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO PUBLIC
        USING (realtime.topic() NOT LIKE 'scms:chat:%' OR (
            extension = 'broadcast' AND (auth.jwt() ->> 'scms_chat_scope') = 'receive'
            AND realtime.topic() = 'scms:chat:' || (auth.jwt() ->> 'scms_chat_user_id')));

        DROP POLICY IF EXISTS scms_chat_send_guard ON realtime.messages;
        CREATE POLICY scms_chat_send_guard ON realtime.messages AS RESTRICTIVE FOR INSERT TO PUBLIC
        WITH CHECK (realtime.topic() NOT LIKE 'scms:chat:%');
    END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_subscriptions_realtime ON membership_subscriptions;
CREATE TRIGGER trg_subscriptions_realtime AFTER INSERT OR UPDATE ON membership_subscriptions
FOR EACH ROW EXECUTE FUNCTION scms_membership_realtime_invalidation();

DROP TRIGGER IF EXISTS trg_coach_bookings_realtime ON coach_bookings;
CREATE TRIGGER trg_coach_bookings_realtime AFTER INSERT OR UPDATE ON coach_bookings
FOR EACH ROW EXECUTE FUNCTION scms_membership_realtime_invalidation();

-- SCRUM-128: vô hiệu hóa cache riêng tư theo transaction, không chứa dữ liệu phiếu hỗ trợ/tin nhắn.
CREATE OR REPLACE FUNCTION scms_support_realtime_invalidation()
RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE ticket_id bigint;
BEGIN
    IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'support_requests' THEN ticket_id := NEW.id;
    ELSE ticket_id := NEW.support_request_id; END IF;
    PERFORM realtime.send('{}'::jsonb, 'changed', 'scms:support:ticket:' || ticket_id::text, true);
    PERFORM realtime.send('{}'::jsonb, 'changed', 'scms:support:inbox', true);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Support invalidation unavailable (SQLSTATE %)', SQLSTATE;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_support_request_realtime ON support_requests;
CREATE TRIGGER trg_support_request_realtime AFTER INSERT OR UPDATE ON support_requests
FOR EACH ROW EXECUTE FUNCTION scms_support_realtime_invalidation();
DROP TRIGGER IF EXISTS trg_support_message_realtime ON support_request_messages;
CREATE TRIGGER trg_support_message_realtime AFTER INSERT ON support_request_messages
FOR EACH ROW EXECUTE FUNCTION scms_support_realtime_invalidation();

DO $$
BEGIN
    IF current_schema() = 'public' AND to_regclass('realtime.messages') IS NOT NULL THEN
        DROP POLICY IF EXISTS scms_support_receive ON realtime.messages;
        CREATE POLICY scms_support_receive ON realtime.messages FOR SELECT TO authenticated
        USING (extension = 'broadcast' AND (auth.jwt() ->> 'scms_support_scope') = 'receive'
            AND realtime.topic() = (auth.jwt() ->> 'scms_support_topic')
            AND realtime.topic() LIKE 'scms:support:%');
        DROP POLICY IF EXISTS scms_support_receive_guard ON realtime.messages;
        CREATE POLICY scms_support_receive_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO PUBLIC
        USING (realtime.topic() NOT LIKE 'scms:support:%' OR (
            extension = 'broadcast' AND (auth.jwt() ->> 'scms_support_scope') = 'receive'
            AND realtime.topic() = (auth.jwt() ->> 'scms_support_topic')));
        DROP POLICY IF EXISTS scms_support_send_guard ON realtime.messages;
        CREATE POLICY scms_support_send_guard ON realtime.messages AS RESTRICTIVE FOR INSERT TO PUBLIC
        WITH CHECK (realtime.topic() NOT LIKE 'scms:support:%');
    END IF;
END;
$$;

-- SCRUM-133: Lịch tập PT và lịch lớp nhóm phải dùng chung bộ bảo vệ ở tầng database.
CREATE OR REPLACE FUNCTION scms_guard_pt_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    business_date DATE := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    target_coach BIGINT;
    schedule_conflict BOOLEAN := FALSE;
BEGIN
    -- Các dòng rời khỏi trạng thái đang hoạt động (hủy, hoàn thành) không thể gây trùng lịch: bỏ qua hoàn toàn bước khóa.
    -- Dùng nhánh IF lồng theo TG_TABLE_NAME vì PL/pgSQL không short-circuit phân giải tên cột trên biến record OLD/NEW.
    IF TG_TABLE_NAME = 'coach_bookings' THEN
        IF NEW.status <> 'confirmed' THEN
            RETURN NEW;
        END IF;
        -- Bỏ qua cập nhật không đổi lịch hẹn PT (ví dụ điểm danh quá khứ hoặc xác nhận thu tiền) để không khóa toàn cục và không kiểm tra lại gói tập.
        IF TG_OP = 'UPDATE' THEN
            IF OLD.status = 'confirmed'
               AND OLD.member_id = NEW.member_id AND OLD.coach_id = NEW.coach_id
               AND OLD.booking_date = NEW.booking_date
               AND OLD.start_time = NEW.start_time AND OLD.end_time = NEW.end_time THEN
                RETURN NEW;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME IN ('class_enrollments', 'session_bookings') THEN
        IF NEW.status <> 'booked' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
        IF NEW.status <> 'scheduled' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_TABLE_NAME = 'classes' THEN
        IF TG_OP = 'UPDATE' THEN
            IF OLD.coach_id IS NOT DISTINCT FROM NEW.coach_id THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;
    -- ponytail: tuần tự hóa các thao tác ghi lịch trong phạm vi MVP này; chuyển sang khóa theo thứ tự từng bên tham gia nếu tranh chấp tăng cao.
    -- Không bao giờ chờ khóa khi bên gọi có thể đang giữ sẵn khóa dòng trên bảng classes.
    IF NOT pg_try_advisory_xact_lock(hashtext(current_schema()), 391133) THEN
        RAISE EXCEPTION 'trg_pt_schedule_busy'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_pt_schedule_busy';
    END IF;
    IF TG_TABLE_NAME = 'coach_bookings' THEN
        IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
        IF NOT scms_is_valid_schedule_slot(NEW.start_time, NEW.end_time) THEN
            RAISE EXCEPTION 'trg_schedule_invalid_slot'
                USING ERRCODE = '23514', CONSTRAINT = 'trg_schedule_invalid_slot';
        END IF;
        -- Hỗ trợ gia hạn sớm nối tiếp: chỉ cần có gói active không bảo lưu phủ hôm nay VÀ có gói active không bảo lưu phủ ngày tập (có FOR SHARE chống race đóng băng/hủy).
        IF NOT EXISTS (
            SELECT 1 FROM membership_subscriptions m
            WHERE m.member_id = NEW.member_id
              AND m.status = 'active'
              AND m.start_date <= business_date
              AND m.end_date >= business_date
              AND NOT (
                  UPPER(COALESCE(m.hold_status, '')) = 'APPROVED'
                  AND m.hold_start_date IS NOT NULL
                  AND m.hold_end_date IS NOT NULL
                  AND business_date BETWEEN m.hold_start_date AND m.hold_end_date
              )
            FOR SHARE
        ) OR NOT EXISTS (
            SELECT 1 FROM membership_subscriptions m
            WHERE m.member_id = NEW.member_id
              AND m.status = 'active'
              AND m.start_date <= NEW.booking_date
              AND m.end_date >= NEW.booking_date
              AND NOT (
                  UPPER(COALESCE(m.hold_status, '')) = 'APPROVED'
                  AND m.hold_start_date IS NOT NULL
                  AND m.hold_end_date IS NOT NULL
                  AND NEW.booking_date BETWEEN m.hold_start_date AND m.hold_end_date
              )
            FOR SHARE
        ) THEN
            RAISE EXCEPTION 'trg_enrollments_check_membership'
                USING ERRCODE = '23514', CONSTRAINT = 'trg_enrollments_check_membership';
        END IF;
        SELECT EXISTS (
            SELECT 1 FROM coach_bookings b
            WHERE b.id IS DISTINCT FROM NEW.id AND b.status = 'confirmed'
              AND b.booking_date = NEW.booking_date
              AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time
              AND (b.coach_id = NEW.coach_id OR b.member_id = NEW.member_id)
        ) OR EXISTS (
            SELECT 1 FROM class_sessions s JOIN classes c ON c.id = s.class_id
            WHERE s.status = 'scheduled' AND s.session_date = NEW.booking_date
              AND s.start_time < NEW.end_time AND s.end_time > NEW.start_time
              AND (c.coach_id = NEW.coach_id OR EXISTS (
                  SELECT 1 FROM class_enrollments e WHERE e.class_id = c.id
                    AND e.member_id = NEW.member_id AND e.status = 'booked')
                  OR EXISTS (
                  SELECT 1 FROM session_bookings sb WHERE sb.session_id = s.id
                    AND sb.member_id = NEW.member_id AND sb.status = 'booked'))
        ) INTO schedule_conflict;
    ELSIF TG_TABLE_NAME = 'class_enrollments' THEN
        IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
        SELECT EXISTS (
            SELECT 1 FROM class_sessions s JOIN coach_bookings b ON b.booking_date = s.session_date
            WHERE s.class_id = NEW.class_id AND s.status = 'scheduled'
              AND b.member_id = NEW.member_id AND b.status = 'confirmed'
              AND b.start_time < s.end_time AND b.end_time > s.start_time
        ) INTO schedule_conflict;
    ELSIF TG_TABLE_NAME = 'session_bookings' THEN
        IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
        SELECT EXISTS (
            SELECT 1 FROM class_sessions s JOIN coach_bookings b ON b.booking_date = s.session_date
            WHERE s.id = NEW.session_id AND s.status = 'scheduled'
              AND b.member_id = NEW.member_id AND b.status = 'confirmed'
              AND b.start_time < s.end_time AND b.end_time > s.start_time
        ) INTO schedule_conflict;
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
        IF NEW.status <> 'scheduled' THEN RETURN NEW; END IF;
        SELECT coach_id INTO target_coach FROM classes WHERE id = NEW.class_id;
        SELECT EXISTS (
            SELECT 1 FROM coach_bookings b
            WHERE b.status = 'confirmed' AND b.booking_date = NEW.session_date
              AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time
              AND (b.coach_id = target_coach OR EXISTS (
                  SELECT 1 FROM class_enrollments e WHERE e.class_id = NEW.class_id
                    AND e.member_id = b.member_id AND e.status = 'booked')
                  OR EXISTS (
                  SELECT 1 FROM session_bookings sb WHERE sb.session_id = NEW.id
                    AND sb.member_id = b.member_id AND sb.status = 'booked'))
        ) INTO schedule_conflict;
    ELSIF TG_TABLE_NAME = 'classes' THEN
        SELECT EXISTS (
            SELECT 1 FROM class_sessions s JOIN coach_bookings b ON b.booking_date = s.session_date
            WHERE s.class_id = NEW.id
              AND s.status = 'scheduled'
              AND s.session_date >= business_date
              AND b.status = 'confirmed'
              AND b.coach_id = NEW.coach_id
              AND b.start_time < s.end_time AND b.end_time > s.start_time
        ) INTO schedule_conflict;
    END IF;
    IF schedule_conflict THEN
        RAISE EXCEPTION 'trg_sessions_check_conflict'
            USING ERRCODE = '23514', CONSTRAINT = 'trg_sessions_check_conflict';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pt_schedule_booking ON coach_bookings;
CREATE TRIGGER trg_pt_schedule_booking
BEFORE INSERT OR UPDATE OF member_id, coach_id, booking_date, start_time, end_time, status ON coach_bookings
FOR EACH ROW EXECUTE FUNCTION scms_guard_pt_schedule();
DROP TRIGGER IF EXISTS trg_pt_schedule_enrollment ON class_enrollments;
CREATE TRIGGER trg_pt_schedule_enrollment BEFORE INSERT OR UPDATE ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION scms_guard_pt_schedule();
DROP TRIGGER IF EXISTS trg_pt_schedule_session_booking ON session_bookings;
CREATE TRIGGER trg_pt_schedule_session_booking BEFORE INSERT OR UPDATE ON session_bookings
FOR EACH ROW EXECUTE FUNCTION scms_guard_pt_schedule();
DROP TRIGGER IF EXISTS trg_pt_schedule_session ON class_sessions;
CREATE TRIGGER trg_pt_schedule_session BEFORE INSERT OR UPDATE ON class_sessions
FOR EACH ROW EXECUTE FUNCTION scms_guard_pt_schedule();
DROP TRIGGER IF EXISTS trg_pt_schedule_class ON classes;
CREATE TRIGGER trg_pt_schedule_class
BEFORE UPDATE OF coach_id ON classes
FOR EACH ROW
WHEN (OLD.coach_id IS DISTINCT FROM NEW.coach_id)
EXECUTE FUNCTION scms_guard_pt_schedule();

-- Một hội viên không được học hai buổi lớp trùng giờ, dù giữ chỗ từng buổi (session_bookings) hay đăng ký cả lớp
-- (class_enrollments). Chặn cả khi Quản lý thêm/đổi giờ một buổi mà hội viên đã đặt làm buổi đó chồng lên lớp khác.
-- Chỉ xét buổi chưa qua để dữ liệu cũ không chặn các thao tác mới.
CREATE OR REPLACE FUNCTION scms_member_session_overlaps(p_member BIGINT, p_session BIGINT, p_today DATE)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM class_sessions target
        JOIN class_sessions other
          ON other.session_date = target.session_date
         AND other.id <> target.id
         AND other.class_id <> target.class_id
         AND other.status = 'scheduled'
         AND other.start_time < target.end_time
         AND other.end_time > target.start_time
        WHERE target.id = p_session
          AND target.status = 'scheduled'
          AND target.session_date >= p_today
          AND (EXISTS (SELECT 1 FROM session_bookings b
                       WHERE b.session_id = other.id AND b.member_id = p_member AND b.status = 'booked')
               OR EXISTS (SELECT 1 FROM class_enrollments e
                          WHERE e.class_id = other.class_id AND e.member_id = p_member AND e.status = 'booked'))
    );
$$;

CREATE OR REPLACE FUNCTION scms_guard_member_class_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
    today DATE := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    has_conflict BOOLEAN := FALSE;
BEGIN
    IF TG_TABLE_NAME = 'session_bookings' THEN
        IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND OLD.session_id = NEW.session_id
           AND OLD.member_id = NEW.member_id THEN
            RETURN NEW;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(current_schema() || ':member-schedule:' || NEW.member_id::TEXT, 0));
        has_conflict := scms_member_session_overlaps(NEW.member_id, NEW.session_id, today);
    ELSIF TG_TABLE_NAME = 'class_enrollments' THEN
        IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND OLD.class_id = NEW.class_id
           AND OLD.member_id = NEW.member_id THEN
            RETURN NEW;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(current_schema() || ':member-schedule:' || NEW.member_id::TEXT, 0));
        SELECT EXISTS (
            SELECT 1 FROM class_sessions s
            WHERE s.class_id = NEW.class_id AND s.status = 'scheduled' AND s.session_date >= today
              AND scms_member_session_overlaps(NEW.member_id, s.id, today)
        ) INTO has_conflict;
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
        IF NEW.status <> 'scheduled' OR NEW.session_date < today THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.class_id = NEW.class_id
           AND OLD.session_date = NEW.session_date AND OLD.start_time = NEW.start_time
           AND OLD.end_time = NEW.end_time THEN
            RETURN NEW;
        END IF;
        SELECT EXISTS (
            SELECT 1
            FROM (
                SELECT b.member_id FROM session_bookings b WHERE b.session_id = NEW.id AND b.status = 'booked'
                UNION
                SELECT e.member_id FROM class_enrollments e WHERE e.class_id = NEW.class_id AND e.status = 'booked'
            ) attendees
            WHERE scms_member_session_overlaps(attendees.member_id, NEW.id, today)
        ) INTO has_conflict;
    END IF;

    IF has_conflict THEN
        RAISE EXCEPTION 'trg_member_schedule_conflict'
            USING ERRCODE = '23P01', CONSTRAINT = 'trg_member_schedule_conflict';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_overlap_session_booking ON session_bookings;
CREATE TRIGGER trg_member_overlap_session_booking
AFTER INSERT OR UPDATE OF session_id, member_id, status ON session_bookings
FOR EACH ROW EXECUTE FUNCTION scms_guard_member_class_overlap();
DROP TRIGGER IF EXISTS trg_member_overlap_enrollment ON class_enrollments;
CREATE TRIGGER trg_member_overlap_enrollment
AFTER INSERT OR UPDATE OF class_id, member_id, status ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION scms_guard_member_class_overlap();
DROP TRIGGER IF EXISTS trg_member_overlap_session ON class_sessions;
CREATE TRIGGER trg_member_overlap_session
AFTER INSERT OR UPDATE OF class_id, session_date, start_time, end_time, status ON class_sessions
FOR EACH ROW EXECUTE FUNCTION scms_guard_member_class_overlap();
