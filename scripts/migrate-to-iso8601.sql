-- Migration Script: Convert TIMESTAMP columns to VARCHAR(30) for ISO 8601 support
-- This script updates existing tables to support ISO 8601 timestamp format
-- Run this script after creating the database with the original schema

USE iot_middleware;

-- Update iot_telemetry table
ALTER TABLE iot_telemetry 
MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';

-- Update iot_rfid_events table
ALTER TABLE iot_rfid_events 
MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';

-- Update iot_device_state table
ALTER TABLE iot_device_state 
MODIFY COLUMN timestamp VARCHAR(30) NOT NULL COMMENT 'Event timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)';

-- Recreate indexes for better performance with VARCHAR timestamps
-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_device_timestamp ON iot_telemetry;
DROP INDEX IF EXISTS idx_device_timestamp ON iot_rfid_events;
DROP INDEX IF EXISTS idx_timestamp ON iot_device_state;

-- Create new indexes optimized for VARCHAR timestamps
CREATE INDEX idx_device_timestamp ON iot_telemetry (device_id, timestamp(19));
CREATE INDEX idx_device_timestamp ON iot_rfid_events (device_id, timestamp(19));
CREATE INDEX idx_timestamp ON iot_device_state (timestamp(19));

-- Verify the changes
SELECT 
  TABLE_NAME, 
  COLUMN_NAME, 
  DATA_TYPE, 
  CHARACTER_MAXIMUM_LENGTH,
  COLUMN_COMMENT
FROM 
  INFORMATION_SCHEMA.COLUMNS 
WHERE 
  TABLE_SCHEMA = 'iot_middleware' 
  AND COLUMN_NAME = 'timestamp'
ORDER BY 
  TABLE_NAME;