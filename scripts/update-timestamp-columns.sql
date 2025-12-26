-- Simple script to update timestamp columns to VARCHAR(30) for ISO 8601 support
-- Run this script to modify existing database tables

USE iot_middleware;

-- Update iot_telemetry table
ALTER TABLE iot_telemetry MODIFY COLUMN timestamp VARCHAR(30) NOT NULL;

-- Update iot_rfid_events table  
ALTER TABLE iot_rfid_events MODIFY COLUMN timestamp VARCHAR(30) NOT NULL;

-- Update iot_device_state table
ALTER TABLE iot_device_state MODIFY COLUMN timestamp VARCHAR(30) NOT NULL;

-- Show the updated column definitions
SHOW COLUMNS FROM iot_telemetry WHERE Field = 'timestamp';
SHOW COLUMNS FROM iot_rfid_events WHERE Field = 'timestamp';
SHOW COLUMNS FROM iot_device_state WHERE Field = 'timestamp';