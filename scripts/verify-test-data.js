// Script to verify test data was saved to database
const Database = require('../src/core/Database');

async function verifyTestData() {
  try {
    console.log("Connecting to database...");
    await Database.connect({
      host: 'localhost',
      port: 3306,
      database: 'iot_middleware',
      username: 'root',
      password: 'Abc#!Dale123'
    });

    console.log("Checking for test data...");
    
    // Check telemetry data
    const telemetryData = await Database.raw(`
      SELECT device_id, device_type, telemetry_key, telemetry_value, timestamp 
      FROM iot_telemetry 
      WHERE device_id = '2437871205' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log("\n=== TELEMETRY DATA ===");
    console.log(telemetryData);
    
    // Check device state data
    const stateData = await Database.raw(`
      SELECT device_id, device_type, state_type, json_value, timestamp 
      FROM iot_device_state 
      WHERE device_id = '2437871205' 
      ORDER BY updated_at DESC 
      LIMIT 10
    `);
    
    console.log("\n=== DEVICE STATE DATA ===");
    console.log(stateData);
    
    console.log("\nVerification complete!");
    
  } catch (error) {
    console.error("Error verifying data:", error.message);
  } finally {
    await Database.disconnect();
  }
}

verifyTestData();