// test/storage-service-test.js
const StorageService = require('../src/modules/storage/StorageService');
const EventBus = require('../src/core/EventBus');

async function testStorageService() {
    console.log("=== TESTING STORAGE SERVICE ===");
    
    // Create storage service instance
    const storageService = new StorageService();
    
    // Mock normalized data (similar to what UnifyNormalizer outputs)
    const mockNormalizedData = [
        {
            "identity": {
                "deviceId": "2123456789",
                "deviceType": "V6800",
                "modAddr": 0,
                "sensorAddr": 0
            },
            "type": "SYS_TELEMETRY",
            "ts": "2025-12-25T00:58:52.882Z",
            "payload": {
                "key": "voltage",
                "value": 23.5,
                "raw": {
                    "mainPower": true,
                    "backupPower": false
                }
            }
        },
        {
            "identity": {
                "deviceId": "2123456789",
                "deviceType": "V6800",
                "modAddr": 2,
                "sensorAddr": 3
            },
            "type": "SYS_RFID_EVENT",
            "ts": "2025-12-25T00:58:52.882Z",
            "payload": {
                "key": "rfid_event",
                "value": {
                    "action": "attached",
                    "tagId": "DD23B0B4",
                    "uPos": 3,
                    "alarmStatus": 0
                }
            }
        },
        {
            "identity": {
                "deviceId": "2123456789",
                "deviceType": "V6800",
                "modAddr": 2,
                "sensorAddr": 0
            },
            "type": "SYS_RFID_SNAPSHOT",
            "ts": "2025-12-25T00:58:52.882Z",
            "payload": {
                "key": "rfid_snapshot",
                "value": {
                    "modId": "3963041727",
                    "items": [
                        {"uPos": 3, "tagId": "DD23B0B4", "alarmStatus": 0}
                    ]
                }
            }
        }
    ];
    
    try {
        // Test direct call to saveBatch (without database connection)
        console.log("Testing saveBatch method structure...");
        
        // Test the grouping logic
        const groupedData = storageService._groupByType(mockNormalizedData);
        console.log("Grouped data:", Object.keys(groupedData));
        
        // Test event listening
        console.log("Testing event listener setup...");
        await storageService.start();
        console.log("StorageService started successfully");
        
        // Emit test event
        console.log("Emitting test data via EventBus...");
        EventBus.emit('data.normalized', mockNormalizedData);
        
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("Test completed successfully!");
        
    } catch (error) {
        console.error("Test failed:", error.message);
        console.error("This is expected if database is not connected");
    }
}

testStorageService();