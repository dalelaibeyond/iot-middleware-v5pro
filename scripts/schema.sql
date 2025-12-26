-- IoT Middleware V5 Database Schema
-- Created for StorageService implementation
-- Supports MySQL 8.0+ with InnoDB engine

-- Use database
USE iot_middleware;

-- ========================================
-- 1. iot_telemetry Table (Time-series data)
-- ========================================
-- Stores split sensor data (temperature, humidity, voltage, current, noise)
-- High write frequency, needs efficient indexing

CREATE TABLE IF NOT EXISTS `iot_telemetry` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor address',
  `telemetry_key` VARCHAR(50) NOT NULL COMMENT 'Type of telemetry (temperature, humidity, voltage, etc.)',
  `telemetry_value` DECIMAL(10,4) NOT NULL COMMENT 'Telemetry measurement value',
  `timestamp` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Event timestamp',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Record creation time',
  PRIMARY KEY (`id`),
  INDEX `idx_device_timestamp` (`device_id`, `timestamp`),
  INDEX `idx_telemetry_key` (`telemetry_key`),
  INDEX `idx_mod_sensor` (`mod_addr`, `sensor_addr`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Time-series telemetry data from IoT devices';

-- ========================================
-- 2. iot_rfid_events Table (Audit log)
-- ========================================
-- Stores history log of RFID tag attach/detach events
-- Append-only table for audit trail

CREATE TABLE IF NOT EXISTS `iot_rfid_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor/Tag position',
  `tag_id` VARCHAR(16) NOT NULL COMMENT 'RFID tag identifier in hex',
  `action` ENUM('attached', 'detached') NOT NULL COMMENT 'Tag action',
  `timestamp` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Event timestamp',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Record creation time',
  PRIMARY KEY (`id`),
  INDEX `idx_device_timestamp` (`device_id`, `timestamp`),
  INDEX `idx_tag_action` (`tag_id`, `action`),
  INDEX `idx_mod_addr` (`mod_addr`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RFID event audit log from IoT devices';

-- ========================================
-- 3. iot_device_state Table (Snapshot storage)
-- ========================================
-- Stores current device shadow state as JSON
-- Upsert operations to maintain current state

CREATE TABLE IF NOT EXISTS `iot_device_state` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` VARCHAR(50) NOT NULL COMMENT 'Device identifier',
  `device_type` VARCHAR(20) NOT NULL COMMENT 'Device type (V5008/V6800)',
  `mod_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Module address',
  `sensor_addr` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sensor address',
  `state_type` VARCHAR(50) NOT NULL COMMENT 'Type of state (SYS_RFID_SNAPSHOT, SYS_STATE_CHANGE, SYS_DEVICE_INFO)',
  `json_value` JSON NOT NULL COMMENT 'State data in JSON format',
  `timestamp` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Event timestamp',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Record creation time',
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Last update time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_state` (`device_id`, `device_type`, `mod_addr`, `sensor_addr`, `state_type`),
  INDEX `idx_device_type` (`device_id`, `state_type`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Current device shadow state from IoT devices';

-- ========================================
-- Additional Performance Considerations
-- ========================================

-- Partitioning for large datasets (optional, uncomment if needed)
-- ALTER TABLE iot_telemetry PARTITION BY RANGE (YEAR(timestamp)) (
--   PARTITION p2023 VALUES LESS THAN (2024),
--   PARTITION p2024 VALUES LESS THAN (2025),
--   PARTITION p2025 VALUES LESS THAN (2026),
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