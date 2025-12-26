// Script to check and update database schema for ISO 8601 timestamp support
const Database = require('../src/core/Database');

async function checkAndUpdateSchema() {
  try {
    console.log("Connecting to database...");
    await Database.connect({
      host: 'localhost',
      port: 3306,
      database: 'iot_middleware',
      username: 'root',
      password: 'Abc#!Dale123'
    });

    console.log("Checking current schema...");
    
    // Check iot_telemetry table
    const telemetryColumns = await Database.raw(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'iot_middleware' 
      AND TABLE_NAME = 'iot_telemetry' 
      AND COLUMN_NAME = 'timestamp'
    `);
    
    console.log("iot_telemetry timestamp column:", telemetryColumns[0]);
    
    // Check if timestamp column is VARCHAR
    if (telemetryColumns[0].DATA_TYPE !== 'varchar') {
      console.log("Updating iot_telemetry timestamp column to VARCHAR(30)...");
      await Database.raw(`
        ALTER TABLE iot_telemetry 
        MODIFY COLUMN timestamp VARCHAR(30) NOT NULL 
        COMMENT 'Event timestamp in ISO 8601 format'
      `);
      console.log("Updated iot_telemetry timestamp column");
    }
    
    // Check iot_rfid_events table
    const rfidColumns = await Database.raw(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'iot_middleware' 
      AND TABLE_NAME = 'iot_rfid_events' 
      AND COLUMN_NAME = 'timestamp'
    `);
    
    console.log("iot_rfid_events timestamp column:", rfidColumns[0]);
    
    if (rfidColumns[0].DATA_TYPE !== 'varchar') {
      console.log("Updating iot_rfid_events timestamp column to VARCHAR(30)...");
      await Database.raw(`
        ALTER TABLE iot_rfid_events 
        MODIFY COLUMN timestamp VARCHAR(30) NOT NULL 
        COMMENT 'Event timestamp in ISO 8601 format'
      `);
      console.log("Updated iot_rfid_events timestamp column");
    }
    
    // Check iot_device_state table
    const stateColumns = await Database.raw(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'iot_middleware' 
      AND TABLE_NAME = 'iot_device_state' 
      AND COLUMN_NAME = 'timestamp'
    `);
    
    console.log("iot_device_state timestamp column:", stateColumns[0]);
    
    if (stateColumns[0].DATA_TYPE !== 'varchar') {
      console.log("Updating iot_device_state timestamp column to VARCHAR(30)...");
      await Database.raw(`
        ALTER TABLE iot_device_state 
        MODIFY COLUMN timestamp VARCHAR(30) NOT NULL 
        COMMENT 'Event timestamp in ISO 8601 format'
      `);
      console.log("Updated iot_device_state timestamp column");
    }
    
    console.log("Schema update completed successfully!");
    
  } catch (error) {
    console.error("Error updating schema:", error.message);
  } finally {
    await Database.disconnect();
  }
}

checkAndUpdateSchema();