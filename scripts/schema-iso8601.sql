-- IoT Middleware V5 Database Schema (ISO 8601 Timestamp Support)
-- Created for StorageService implementation with ISO 8601 timestamp format
-- Supports MySQL 8.0+ with InnoDB engine

-- Use database
USE iot_middleware;

-- ========================================
-- 1. iot_telemetry Table (Time-series data)
-- ========================================
-- Stores split sensor data (temperature, humidity, voltage, current, noise)
-- High write frequency, needs efficient indexing
-- Updated to support ISO 8601 timestamp format

CREATE TABLE IF NOT EXISTS `iot_telemetry` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor address',
  `telemetry_key` VARCHAR(50) NOT NULL COMMENT 'Type of telemetry (temperature, humidity, voltage, etc.)',
  `telemetry_value` DECIMAL(10,4) NOT NULL COMMENT 'Telemetry measurement value',
  `timestamp` VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation time',
  PRIMARY KEY (`id`),
  INDEX `idx_device_timestamp` (`device_id`, `timestamp`(19)),
  INDEX `idx_telemetry_key` (`telemetry_key`),
  INDEX `idx_mod_sensor` (`mod_addr`, `sensor_addr`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Time-series telemetry data from IoT devices (ISO 8601 timestamps)';

-- ========================================
-- 2. iot_rfid_events Table (Audit log)
-- ========================================
-- Stores history log of RFID tag attach/detach events
-- Append-only table for audit trail
-- Updated to support ISO 8601 timestamp format

CREATE TABLE IF NOT EXISTS `iot_rfid_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor/Tag position',
  `tag_id` VARCHAR(16) NOT NULL COMMENT 'RFID tag identifier in hex',
  `action` ENUM('attached', 'detached') NOT NULL COMMENT 'Tag action',
  `timestamp` VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation time',
  PRIMARY KEY (`id`),
  INDEX `idx_device_timestamp` (`device_id`, `timestamp`(19)),
  INDEX `idx_tag_action` (`tag_id`, `action`),
  INDEX `idx_mod_addr` (`mod_addr`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RFID event audit log from IoT devices (ISO 8601 timestamps)';

-- ========================================
-- 3. iot_device_state Table (Snapshot storage)
-- ========================================
-- Stores current device shadow state as JSON
-- Upsert operations to maintain current state
-- Updated to support ISO 8601 timestamp format

CREATE TABLE IF NOT EXISTS `iot_device_state` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor address',
  `state_type` VARCHAR(50) NOT NULL COMMENT 'Type of state (SYS_RFID_SNAPSHOT, SYS_STATE_CHANGE, SYS_DEVICE_INFO)',
  `json_value` JSON NOT NULL COMMENT 'State data in JSON format',
  `timestamp` VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation time',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_state` (`device_id`, `device_type`, `mod_addr`, `sensor_addr`, `state_type`),
  INDEX `idx_device_type` (`device_id`, `state_type`),
  INDEX `idx_timestamp` (`timestamp`(19)),
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Current device shadow state from IoT devices (ISO 8601 timestamps)';

-- ========================================
-- Migration Script (if updating existing tables)
-- ========================================
-- Uncomment the following ALTER TABLE statements if you need to update existing tables:

-- ALTER TABLE iot_telemetry MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';
-- ALTER TABLE iot_rfid_events MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';
-- ALTER TABLE iot_device_state MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';

-- ========================================
-- Additional Performance Considerations
-- ========================================

-- Partitioning for large datasets (optional, uncomment if needed)
-- Note: Partitioning on VARCHAR columns requires special handling in MySQL 8.0+
-- ALTER TABLE iot_telemetry PARTITION BY RANGE COLUMNS(timestamp) (
--   PARTITION p2023 VALUES LESS THAN ('2024-01-01'),
--   PARTITION p2024 VALUES LESS THAN ('2025-01-01'),
--   PARTITION p2025 VALUES LESS THAN ('2026-01-01'),
--   PARTITION pmax VALUES LESS THAN MAXVALUE
-- );

-- Archive old telemetry data (optional)
-- CREATE TABLE IF NOT EXISTS `iot_telemetry_archive` LIKE `iot_telemetry`;

-- Stored procedures for bulk operations (optional)
-- DELIMITER //
-- CREATE PROCEDURE BulkInsertTelemetry(IN telemetry_data JSON)
-- BEGIN
--   -- Bulk insert logic here
-- END //
-- DELIMITER ;