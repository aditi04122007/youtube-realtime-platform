-- =====================================================================
-- Migration: Phase 16 - Razorpay Test Payment Integration
-- Extends payments table with provider order/payment/signature tracking,
-- idempotency unique constraints, billing cycle, and failure metadata.
-- =====================================================================

-- 1. Modify payments status enum to include all Phase 16 lifecycle states
ALTER TABLE payments 
  MODIFY COLUMN status ENUM(
    'CREATED',
    'PENDING',
    'PAID',
    'SUCCESS',
    'FAILED',
    'VERIFICATION_FAILED',
    'REFUNDED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'CREATED';

-- 2. Add provider column if not present (defaulting to RAZORPAY)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'provider');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN provider VARCHAR(50) NOT NULL DEFAULT "RAZORPAY" AFTER payment_gateway', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add provider_order_id column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'provider_order_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN provider_order_id VARCHAR(100) NULL AFTER gateway_order_id', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Add provider_payment_id column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'provider_payment_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN provider_payment_id VARCHAR(100) NULL AFTER provider_order_id', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Add provider_signature column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'provider_signature');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN provider_signature VARCHAR(255) NULL AFTER provider_payment_id', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Add payment_method column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_method');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN payment_method VARCHAR(50) NULL AFTER provider_signature', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Add receipt column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'receipt');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN receipt VARCHAR(100) NULL AFTER payment_method', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. Add billing_cycle column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'billing_cycle');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN billing_cycle ENUM("MONTHLY", "YEARLY") NOT NULL DEFAULT "MONTHLY" AFTER receipt', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. Add failure_reason column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'failure_reason');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(255) NULL AFTER status', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 10. Add metadata JSON column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'metadata');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN metadata JSON NULL AFTER failure_reason', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 11. Add updated_at column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'updated_at');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 12. Add Unique and Performance Indexes
-- Unique index on provider_order_id (null values allowed, unique when present)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'uq_payments_provider_order');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE payments ADD UNIQUE INDEX uq_payments_provider_order (provider_order_id)', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Unique index on provider_payment_id (null values allowed, unique when present)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'uq_payments_provider_payment');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE payments ADD UNIQUE INDEX uq_payments_provider_payment (provider_payment_id)', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index on receipt
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_receipt');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE payments ADD INDEX idx_payments_receipt (receipt)', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index on (user_id, status)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_user_status');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE payments ADD INDEX idx_payments_user_status (user_id, status)', 
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
