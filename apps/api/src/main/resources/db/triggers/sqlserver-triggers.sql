-- Invariant business triggers for SQL Server
-- Automatically initialized after Hibernate Code-First schema generation

CREATE OR ALTER TRIGGER dbo.trg_enrollments_check_capacity
ON dbo.class_enrollments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.class_sessions s ON s.id = i.session_id
        INNER JOIN dbo.classes c ON c.id = s.class_id
        WHERE i.status = 'booked'
        AND (
            SELECT COUNT(*)
            FROM dbo.class_enrollments ce
            WHERE ce.session_id = i.session_id AND ce.status = 'booked'
        ) > c.capacity
    )
    BEGIN
        RAISERROR (N'Lớp học đã đầy chỗ (vượt quá capacity cho phép).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
---SPLIT---
CREATE OR ALTER TRIGGER dbo.trg_sessions_check_conflict
ON dbo.class_sessions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra trùng COACH
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.classes c1 ON c1.id = i.class_id
        INNER JOIN dbo.class_sessions s2 ON s2.session_date = i.session_date AND s2.id <> i.id
        INNER JOIN dbo.classes c2 ON c2.id = s2.class_id
        WHERE i.status <> 'cancelled'
        AND s2.status <> 'cancelled'
        AND c1.coach_id = c2.coach_id
        AND NOT (i.end_time <= s2.start_time OR i.start_time >= s2.end_time)
    )
    BEGIN
        RAISERROR (N'Trùng lịch: Huấn luyện viên đã có buổi dạy khác trong khung giờ này.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    -- Kiểm tra trùng ROOM
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.classes c1 ON c1.id = i.class_id
        INNER JOIN dbo.class_sessions s2 ON s2.session_date = i.session_date AND s2.id <> i.id
        INNER JOIN dbo.classes c2 ON c2.id = s2.class_id
        WHERE i.status <> 'cancelled'
        AND s2.status <> 'cancelled'
        AND c1.room_id = c2.room_id
        AND NOT (i.end_time <= s2.start_time OR i.start_time >= s2.end_time)
    )
    BEGIN
        RAISERROR (N'Trùng lịch: Phòng học đã được xếp cho lớp khác trong khung giờ này.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
---SPLIT---
CREATE OR ALTER TRIGGER dbo.trg_enrollments_check_membership
ON dbo.class_enrollments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE i.status = 'booked'
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.membership_subscriptions ms
            WHERE ms.member_id = i.member_id
            AND ms.status = 'active'
            AND ms.end_date >= CAST(SYSDATETIME() AS DATE)
        )
    )
    BEGIN
        RAISERROR (N'Hội viên không có gói tập active hoặc gói đã hết hạn, không thể đặt lớp.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
---SPLIT---
CREATE OR ALTER TRIGGER dbo.trg_checkins_check_membership
ON dbo.center_checkins
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE NOT EXISTS (
            SELECT 1
            FROM dbo.membership_subscriptions ms
            WHERE ms.member_id = i.member_id
            AND ms.status = 'active'
            AND ms.end_date >= CAST(SYSDATETIME() AS DATE)
        )
    )
    BEGIN
        RAISERROR (N'Check-in thất bại: Hội viên không có gói tập đang active hoặc gói đã hết hạn.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;

---SPLIT---
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_users_username')
    CREATE UNIQUE INDEX uq_users_username ON dbo.users (username) WHERE username IS NOT NULL;
---SPLIT---
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_enrollment_active')
    DROP INDEX uq_enrollment_active ON dbo.class_enrollments;
---SPLIT---
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_enrollment_active')
    CREATE UNIQUE INDEX uq_enrollment_active ON dbo.class_enrollments (session_id, member_id) WHERE status = 'booked';
---SPLIT---
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_waitlist_active')
    DROP INDEX uq_waitlist_active ON dbo.class_waitlists;
---SPLIT---
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_waitlist_active')
    CREATE UNIQUE INDEX uq_waitlist_active ON dbo.class_waitlists (session_id, member_id) WHERE status = 'waiting';