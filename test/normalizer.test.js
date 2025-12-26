const assert = require('assert');
const UnifyNormalizer = require('../src/modules/normalizer/UnifyNormalizer');
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');

describe('UnifyNormalizer', () => {
  let normalizer;
  let v5008Parser;
  let v6800Parser;

  beforeEach(() => {
    normalizer = new UnifyNormalizer();
    v5008Parser = new V5008Parser();
    v6800Parser = new V6800Parser();
  });

  describe('V5008 RFID Diffing Logic', () => {
    it('should generate attached/detached events when comparing snapshots', async () => {
      // First message: Initial snapshot with 2 tags
      const firstMessage = {
        topic: "V5008Upload/2437871205/LabelState",
        message: "BB028C090995000C030A00DD344A440B00DD2862B40C00DD3CE9C4050007AD",
        deviceType: "V5008",
        deviceId: "2437871205",
        messageType: "LabelState",
        messageId: "83891437",
        ts: "2025-01-01T10:00:00.000Z",
        modAddr: 2,
        modId: "2349402517",
        uTotal: 12,
        onlineCount: 3,
        items: [
          { uPos: 10, alarmStatus: 0, tagId: "DD344A44" },
          { uPos: 11, alarmStatus: 0, tagId: "DD2862B4" },
          { uPos: 12, alarmStatus: 0, tagId: "DD3CE9C4" }
        ]
      };

      // Process first message
      const firstResult = await normalizer.normalize(firstMessage);
      
      // Should generate 3 attached events + 1 snapshot
      assert.strictEqual(firstResult.length, 4);
      
      // Check attached events
      const attachedEvents = firstResult.filter(r => r.type === 'SYS_RFID_EVENT');
      assert.strictEqual(attachedEvents.length, 3);
      assert.strictEqual(attachedEvents[0].payload.value.action, 'attached');
      assert.strictEqual(attachedEvents[0].identity.sensorAddr, 10);
      
      // Check snapshot
      const snapshot = firstResult.find(r => r.type === 'SYS_RFID_SNAPSHOT');
      assert.strictEqual(snapshot.payload.value.items.length, 3);

      // Second message: Same tags (no changes)
      const secondMessage = {
        ...firstMessage,
        ts: "2025-01-01T10:01:00.000Z"
      };

      // Process second message
      const secondResult = await normalizer.normalize(secondMessage);
      
      // Should generate 3 detached events + 3 attached events + 1 snapshot
      assert.strictEqual(secondResult.length, 7);
      
      const detachedEvents = secondResult.filter(r => r.type === 'SYS_RFID_EVENT' && r.payload.value.action === 'detached');
      assert.strictEqual(detachedEvents.length, 3);
    });
  });

  describe('V6800 RFID Patching Logic', () => {
    it('should patch cache and generate snapshot from events', async () => {
      // First event: Tag attached at position 3
      const firstEvent = {
        topic: "V6800Upload/2123456789/LabelState",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "LABEL_STATE",
        rawMessageType: "u_state_changed_notify_req",
        messageId: "727046823",
        ts: "2025-01-01T10:00:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            items: [
              { uPos: 3, alarmStatus: 0, tagId: "DD23B0B4", action: "attached" }
            ]
          }
        ]
      };

      // Process first event (cache miss)
      const firstResult = await normalizer.normalize(firstEvent);
      
      // Should generate 1 attached event + 1 require_sync event + 1 snapshot
      assert.strictEqual(firstResult.length, 3);
      
      // Check require sync event
      const requireSyncEvent = firstResult.find(r => r.type === 'SYS_REQUIRE_SYNC');
      assert(requireSyncEvent);
      assert.strictEqual(requireSyncEvent.payload.value.reason, 'cache_miss');

      // Second event: Tag attached at position 5
      const secondEvent = {
        ...firstEvent,
        ts: "2025-01-01T10:01:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            items: [
              { uPos: 5, alarmStatus: 0, tagId: "DD567890", action: "attached" }
            ]
          }
        ]
      };

      // Process second event (cache hit)
      const secondResult = await normalizer.normalize(secondEvent);
      
      // Should generate 1 attached event + 1 snapshot
      assert.strictEqual(secondResult.length, 2);
      
      // Check snapshot has both tags
      const snapshot = secondResult.find(r => r.type === 'SYS_RFID_SNAPSHOT');
      assert.strictEqual(snapshot.payload.value.items.length, 2);
      
      const tagPositions = snapshot.payload.value.items.map(item => item.uPos);
      assert(tagPositions.includes(3));
      assert(tagPositions.includes(5));
    });

    it('should handle tag detached events', async () => {
      // Setup cache with 2 tags
      const setupEvent = {
        topic: "V6800Upload/2123456789/LabelState",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "LABEL_STATE",
        ts: "2025-01-01T10:00:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            items: [
              { uPos: 3, alarmStatus: 0, tagId: "DD23B0B4", action: "attached" },
              { uPos: 5, alarmStatus: 0, tagId: "DD567890", action: "attached" }
            ]
          }
        ]
      };

      await normalizer.normalize(setupEvent);

      // Detach event
      const detachEvent = {
        ...setupEvent,
        ts: "2025-01-01T10:01:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            items: [
              { uPos: 3, alarmStatus: 0, tagId: "DD23B0B4", action: "detached" }
            ]
          }
        ]
      };

      // Process detach event
      const result = await normalizer.normalize(detachEvent);
      
      // Should generate 1 detached event + 1 snapshot
      assert.strictEqual(result.length, 2);
      
      // Check detached event
      const detachedEvents = result.filter(r => r.type === 'SYS_RFID_EVENT' && r.payload.value.action === 'detached');
      assert.strictEqual(detachedEvents.length, 1);
      assert.strictEqual(detachedEvents[0].identity.sensorAddr, 3);
      
      // Check snapshot has only remaining tag
      const snapshot = result.find(r => r.type === 'SYS_RFID_SNAPSHOT');
      assert.strictEqual(snapshot.payload.value.items.length, 1);
      assert.strictEqual(snapshot.payload.value.items[0].uPos, 5);
    });
  });

  describe('Telemetry Flattening', () => {
    it('should flatten V5008 temperature and humidity sensors', async () => {
      const tempHumMessage = {
        topic: "V5008Upload/2437871205/TemHum",
        deviceType: "V5008",
        deviceId: "2437871205",
        messageType: "TemHum",
        messageId: "16846659",
        ts: "2025-01-01T10:00:00.000Z",
        modAddr: 1,
        modId: "3963041727",
        sensors: [
          { sensorAddr: 10, temp: 28.48, hum: 51.27 },
          { sensorAddr: 11, temp: 28.08, hum: 51.11 },
          { sensorAddr: 12, temp: null, hum: null },
          { sensorAddr: 13, temp: null, hum: null },
          { sensorAddr: 14, temp: null, hum: null },
          { sensorAddr: 15, temp: null, hum: null }
        ]
      };

      const result = await normalizer.normalize(tempHumMessage);
      
      // Should generate 4 telemetry objects (2 temp + 2 hum)
      const telemetryEvents = result.filter(r => r.type === 'SYS_TELEMETRY');
      assert.strictEqual(telemetryEvents.length, 4);
      
      // Check temperature events
      const tempEvents = telemetryEvents.filter(r => r.payload.key === 'temperature');
      assert.strictEqual(tempEvents.length, 2);
      assert.strictEqual(tempEvents[0].payload.value, 28.48);
      assert.strictEqual(tempEvents[0].identity.sensorAddr, 10);
      assert.strictEqual(tempEvents[1].payload.value, 28.08);
      assert.strictEqual(tempEvents[1].identity.sensorAddr, 11);
      
      // Check humidity events
      const humEvents = telemetryEvents.filter(r => r.payload.key === 'humidity');
      assert.strictEqual(humEvents.length, 2);
      assert.strictEqual(humEvents[0].payload.value, 51.27);
      assert.strictEqual(humEvents[0].identity.sensorAddr, 10);
    });

    it('should flatten V6800 temperature and humidity sensors', async () => {
      const tempHumMessage = {
        topic: "V6800Upload/2123456789/TemHum",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "TEM_HUM",
        rawMessageType: "temper_humidity_exception_nofity_req",
        messageId: "685205293",
        ts: "2025-01-01T10:00:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            sensors: [
              { sensorAddr: 10, temp: 28.79, hum: 53.79 },
              { sensorAddr: 12, temp: 0, hum: 0 }
            ]
          }
        ]
      };

      const result = await normalizer.normalize(tempHumMessage);
      
      // Should generate 3 telemetry objects (1 temp + 1 hum + 1 temp=0)
      const telemetryEvents = result.filter(r => r.type === 'SYS_TELEMETRY');
      assert.strictEqual(telemetryEvents.length, 3);
      
      // Check temperature events
      const tempEvents = telemetryEvents.filter(r => r.payload.key === 'temperature');
      assert.strictEqual(tempEvents.length, 2);
      assert.strictEqual(tempEvents[0].payload.value, 28.79);
      assert.strictEqual(tempEvents[0].identity.sensorAddr, 10);
      
      // Check humidity events
      const humEvents = telemetryEvents.filter(r => r.payload.key === 'humidity');
      assert.strictEqual(humEvents.length, 2);
      assert.strictEqual(humEvents[0].payload.value, 53.79);
      assert.strictEqual(humEvents[0].identity.sensorAddr, 10);
    });
  });

  describe('Heartbeat Processing', () => {
    it('should process V5008 heartbeat metadata', async () => {
      const heartbeatMessage = {
        topic: "V5008Upload/2437871205/OpeAck",
        deviceType: "V5008",
        deviceId: "2437871205",
        messageType: "OpeAck",
        messageId: "4060092047",
        ts: "2025-01-01T10:00:00.000Z",
        meta: {
          voltage: 23.89,
          current: 5.70,
          mainPower: true,
          backupPower: false
        }
      };

      const result = await normalizer.normalize(heartbeatMessage);
      
      // Should generate 3 telemetry + 1 lifecycle events
      const telemetryEvents = result.filter(r => r.type === 'SYS_TELEMETRY');
      assert.strictEqual(telemetryEvents.length, 2);
      
      // Check voltage event
      const voltageEvent = telemetryEvents.find(r => r.payload.key === 'voltage');
      assert.strictEqual(voltageEvent.payload.value, 23.89);
      
      // Check current event
      const currentEvent = telemetryEvents.find(r => r.payload.key === 'current');
      assert.strictEqual(currentEvent.payload.value, 5.70);
      
      // Check lifecycle event
      const lifecycleEvent = result.find(r => r.type === 'SYS_LIFECYCLE');
      assert.strictEqual(lifecycleEvent.payload.value, 'online');
    });

    it('should process V6800 heartbeat metadata', async () => {
      const heartbeatMessage = {
        topic: "V6800Upload/2123456789/HeartBeat",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "HEARTBEAT",
        rawMessageType: "heart_beat_req",
        messageId: "1534195387",
        ts: "2025-01-01T10:00:00.000Z",
        meta: {
          voltage: 23.89,
          current: 5.70,
          mainPower: true,
          backupPower: false
        }
      };

      const result = await normalizer.normalize(heartbeatMessage);
      
      // Should generate 2 telemetry + 1 lifecycle events
      const telemetryEvents = result.filter(r => r.type === 'SYS_TELEMETRY');
      assert.strictEqual(telemetryEvents.length, 2);
      
      // Check lifecycle event
      const lifecycleEvent = result.find(r => r.type === 'SYS_LIFECYCLE');
      assert.strictEqual(lifecycleEvent.payload.value, 'online');
    });
  });

  describe('Door State Processing', () => {
    it('should process door state changes', async () => {
      const doorMessage = {
        topic: "V6800Upload/2123456789/Door",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "DOOR_STATE",
        rawMessageType: "door_state_changed_notify_req",
        messageId: "333321551",
        ts: "2025-01-01T10:00:00.000Z",
        data: [
          {
            modAddr: 2,
            modId: "3963041727",
            doorState: "01"
          }
        ]
      };

      const result = await normalizer.normalize(doorMessage);
      
      // Should generate 1 state change event
      const stateEvents = result.filter(r => r.type === 'SYS_STATE_CHANGE');
      assert.strictEqual(stateEvents.length, 1);
      
      // Check door state event
      const doorEvent = stateEvents[0];
      assert.strictEqual(doorEvent.payload.key, 'door_state');
      assert.strictEqual(doorEvent.payload.value, 1); // "01" converted to number
    });
  });

  describe('V6800 Init Processing', () => {
    it('should split init message into device and module info', async () => {
      const initMessage = {
        topic: "V6800Upload/2123456789/Init",
        deviceType: "V6800",
        deviceId: "2123456789",
        messageType: "INIT",
        rawMessageType: "devies_init_req",
        messageId: "797991388",
        ts: "2025-01-01T10:00:00.000Z",
        device: {
          ip: "192.168.0.212",
          mac: "08:80:7E:..."
        },
        modules: [
          {
            modAddr: 2,
            modId: "3963041727",
            uTotal: 6,
            fwVer: "2307101644"
          }
        ]
      };

      const result = await normalizer.normalize(initMessage);
      
      // Should generate 1 device info + 1 module info event
      const infoEvents = result.filter(r => r.type === 'SYS_DEVICE_INFO');
      assert.strictEqual(infoEvents.length, 2);
      
      // Check device info
      const deviceInfo = infoEvents.find(r => r.identity.sensorAddr === 0 && r.payload.key === 'device_info');
      assert.strictEqual(deviceInfo.payload.value.ip, "192.168.0.212");
      assert.strictEqual(deviceInfo.payload.value.mac, "08:80:7E:...");
      
      // Check module info
      const moduleInfo = infoEvents.find(r => r.identity.sensorAddr === 0 && r.payload.key === 'module_info');
      assert.strictEqual(moduleInfo.payload.value.modId, "3963041727");
      assert.strictEqual(moduleInfo.payload.value.uTotal, 6);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parsed data gracefully', async () => {
      const invalidData = { invalid: 'data' };
      
      const result = await normalizer.normalize(invalidData);
      
      assert.strictEqual(result.length, 0);
    });

    it('should handle null parsed data gracefully', async () => {
      const result = await normalizer.normalize(null);
      
      assert.strictEqual(result.length, 0);
    });
  });
});