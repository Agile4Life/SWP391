-- Migration V4: Transition class_enrollments and class_waitlists to session_id

-- 1. class_enrollments
IF COL_LENGTH('dbo.class_enrollments', 'session_id') IS NULL
BEGIN
    ALTER TABLE dbo.class_enrollments ADD session_id BIGINT NULL;
END;
GO

-- Backfill session_id if null from earliest class_session of that class
UPDATE ce
SET ce.session_id = s.min_session_id
FROM dbo.class_enrollments ce
CROSS APPLY (
    SELECT MIN(id) AS min_session_id
    FROM dbo.class_sessions cs
    WHERE cs.class_id = ce.class_id
) s
WHERE ce.session_id IS NULL AND s.min_session_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_enrollments_session')
BEGIN
    ALTER TABLE dbo.class_enrollments
    ADD CONSTRAINT fk_enrollments_session FOREIGN KEY (session_id) REFERENCES dbo.class_sessions(id);
END;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_enrollment_active' AND object_id = OBJECT_ID('dbo.class_enrollments'))
BEGIN
    DROP INDEX uq_enrollment_active ON dbo.class_enrollments;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_enrollment_active' AND object_id = OBJECT_ID('dbo.class_enrollments'))
BEGIN
    CREATE UNIQUE INDEX uq_enrollment_active ON dbo.class_enrollments (session_id, member_id) WHERE status = 'booked';
END;
GO

-- 2. class_waitlists
IF COL_LENGTH('dbo.class_waitlists', 'session_id') IS NULL
BEGIN
    ALTER TABLE dbo.class_waitlists ADD session_id BIGINT NULL;
END;
GO

UPDATE cw
SET cw.session_id = s.min_session_id
FROM dbo.class_waitlists cw
CROSS APPLY (
    SELECT MIN(id) AS min_session_id
    FROM dbo.class_sessions cs
    WHERE cs.class_id = cw.class_id
) s
WHERE cw.session_id IS NULL AND s.min_session_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_waitlist_session')
BEGIN
    ALTER TABLE dbo.class_waitlists
    ADD CONSTRAINT fk_waitlist_session FOREIGN KEY (session_id) REFERENCES dbo.class_sessions(id);
END;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_waitlist_active' AND object_id = OBJECT_ID('dbo.class_waitlists'))
BEGIN
    DROP INDEX uq_waitlist_active ON dbo.class_waitlists;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_waitlist_active' AND object_id = OBJECT_ID('dbo.class_waitlists'))
BEGIN
    CREATE UNIQUE INDEX uq_waitlist_active ON dbo.class_waitlists (session_id, member_id) WHERE status = 'waiting';
END;
GO
