-- Reset the DEMO database before re-seeding (docs/DEMO_DATA.md). DML only, no schema change.
-- Wipes packages, classes and all transactional data; deletes the *@demo.sol.vn accounts; keeps every other account,
-- rooms, equipment, disciplines and the shop catalog. Then restart the API with APP_DEMO_SEED_ENABLED=true so
-- CatalogSeeder / DemoDataSeeder / DemoClassSeeder rebuild the catalog and the demo dataset.
-- Never run on a production database. Usage:
--   psql -v ON_ERROR_STOP=1 -f scripts/reset-demo-data.sql   (add ROLLBACK instead of COMMIT to dry-run)
BEGIN;

TRUNCATE TABLE
    membership_packages, classes, coach_bookings, coach_monthly_reviews, coach_reviews, court_bookings,
    center_checkins, member_progress_logs, member_trial_redemptions, membership_cancellation_requests,
    notifications, notification_outbox, payments, invoices, vnpay_ipn_events, vnpay_transactions,
    wallet_transactions, training_plans, support_requests, chat_conversations, ai_chat_sessions,
    ai_recommendation_logs, product_orders, staff_internal_requests, report_snapshots, otp_challenges
    RESTART IDENTITY CASCADE;

-- Demo accounts and the rows that point at them.
CREATE TEMP TABLE demo_users ON COMMIT DROP AS SELECT id FROM users WHERE email LIKE '%@demo.sol.vn';
DELETE FROM product_stock_movements WHERE actor_id IN (SELECT id FROM demo_users);
DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM demo_users);
UPDATE members SET kyc_reviewed_by = NULL WHERE kyc_reviewed_by IN (SELECT id FROM demo_users);
DELETE FROM member_addresses WHERE member_id IN (SELECT id FROM demo_users);
DELETE FROM member_favorite_disciplines WHERE member_id IN (SELECT id FROM demo_users);
DELETE FROM wallets WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM coaches WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM members WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM receptionists WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM center_managers WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM users WHERE id IN (SELECT id FROM demo_users);

COMMIT;
