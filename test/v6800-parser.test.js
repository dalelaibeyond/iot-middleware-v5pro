const assert = require('assert');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');

describe('V6800Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new V6800Parser();
  });

  describe('RFID Message (LabelState)', () => {
    it('should parse RFID message correctly', () => {
      // Example from spec:
      // topic: "V6800Upload/2123456789/LabelState"
      // Raw JSON with u_state_changed_notify_req
      const topic = "V6800Upload/2123456789/LabelState";
      const rawJson = {
        "msg_type": "u_state_changed_notify_req",
        "gateway_sn": "2123456789",
        "uuid_number": 727046823,
        "data": [
          {
            "host_gateway_port_index": 2,
            "extend_module_sn": "3963041727",
            "u_data": [
              { "u_index": 3, "new_state": 1, "old_state": 0, "tag_code": "DD23B0B4", "warning": 0 },
              { "u_index": 1, "new_state": 0, "old_state": 1, "tag_code": "DD395064", "warning": 0 }
            ]
          }
        ]
      };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.deviceType, 'V6800');
      assert.strictEqual(result.deviceId, '2123456789');
      assert.strictEqual(result.messageType, 'LABEL_STATE');
      assert.strictEqual(result.rawMessageType, 'u_state_changed_notify_req');
      assert.strictEqual(result.messageId, '727046823');
      assert(result.ts); // Verify timestamp is injected

      // Verify data array structure
      assert(Array.isArray(result.data));
      assert.strictEqual(result.data.length, 1);

      // Verify module data
      const moduleData = result.data[0];
      assert.strictEqual(moduleData.modAddr, 2);
      assert.strictEqual(moduleData.modId, '3963041727'); // modId should be string

      // Verify items array
      assert(Array.isArray(moduleData.items));
      assert.strictEqual(moduleData.items.length, 2);

      // Verify first RFID tag (attached)
      const item1 = moduleData.items[0];
      assert.strictEqual(item1.uPos, 3);
      assert.strictEqual(item1.alarmStatus, 0);
      assert.strictEqual(item1.tagId, 'DD23B0B4');
      assert.strictEqual(item1.action, 'attached'); // new_state=1 & old_state=0

      // Verify second RFID tag (detached)
      const item2 = moduleData.items[1];
      assert.strictEqual(item2.uPos, 1);
      assert.strictEqual(item2.alarmStatus, 0);
      assert.strictEqual(item2.tagId, 'DD395064');
      assert.strictEqual(item2.action, 'detached'); // new_state=0 & old_state=1
    });
  });

  describe('Heartbeat Message', () => {
    it('should parse heartbeat message correctly', () => {
      // Example from spec:
      // topic: "V6800Upload/2123456789/HeartBeat"
      const topic = "V6800Upload/2123456789/HeartBeat";
      const rawJson = {
        "msg_type": "heart_beat_req",
        "module_type": "mt_gw",
        "module_sn": "2123456789",
        "bus_V": "23.89",
        "bus_I": "5.70",
        "main_power": 1,
        "backup_power": 0,
        "uuid_number": 1534195387,
        "data": [
          { "module_index": 2, "module_sn": "3963041727", "module_m_num": 1, "module_u_num": 6 },
          { "module_index": 4, "module_sn": "2349402517", "module_m_num": 2, "module_u_num": 12 }
        ]
      };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.deviceType, 'V6800');
      assert.strictEqual(result.deviceId, '2123456789');
      assert.strictEqual(result.messageType, 'HEARTBEAT');
      assert.strictEqual(result.rawMessageType, 'heart_beat_req');
      assert.strictEqual(result.messageId, '1534195387');
      assert(result.ts); // Verify timestamp is injected

      // Verify meta information
      assert.strictEqual(result.meta.voltage, 23.89);
      assert.strictEqual(result.meta.current, 5.70);
      assert.strictEqual(result.meta.mainPower, true);
      assert.strictEqual(result.meta.backupPower, false);

      // Verify modules array
      assert(Array.isArray(result.modules));
      assert.strictEqual(result.modules.length, 2);

      // Verify first module
      const module1 = result.modules[0];
      assert.strictEqual(module1.modAddr, 2);
      assert.strictEqual(module1.modId, '3963041727'); // modId should be string
      assert.strictEqual(module1.uTotal, 6);

      // Verify second module
      const module2 = result.modules[1];
      assert.strictEqual(module2.modAddr, 4);
      assert.strictEqual(module2.modId, '2349402517'); // modId should be string
      assert.strictEqual(module2.uTotal, 12);
    });
  });

  describe('Temperature & Humidity Message', () => {
    it('should parse temperature and humidity message correctly', () => {
      // Example from spec:
      // topic: "V6800Upload/2123456789/TemHum"
      const topic = "V6800Upload/2123456789/TemHum";
      const rawJson = {
        "msg_type": "temper_humidity_exception_nofity_req",
        "gateway_sn": "2123456789",
        "uuid_number": 685205293,
        "data": [
          {
            "host_gateway_port_index": 2,
            "extend_module_sn": "3963041727",
            "th_data": [
              { "temper_position": 10, "temper_swot": 28.79, "hygrometer_swot": 53.79 },
              { "temper_position": 12, "temper_swot": 0, "hygrometer_swot": 0 }
            ]
          }
        ]
      };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.deviceType, 'V6800');
      assert.strictEqual(result.deviceId, '2123456789');
      assert.strictEqual(result.messageType, 'TEM_HUM');
      assert.strictEqual(result.rawMessageType, 'temper_humidity_exception_nofity_req');
      assert.strictEqual(result.messageId, '685205293');
      assert(result.ts); // Verify timestamp is injected

      // Verify data array
      assert(Array.isArray(result.data));
      assert.strictEqual(result.data.length, 1);

      // Verify module data
      const moduleData = result.data[0];
      assert.strictEqual(moduleData.modAddr, 2);
      assert.strictEqual(moduleData.modId, '3963041727'); // modId should be string

      // Verify sensors array
      assert(Array.isArray(moduleData.sensors));
      assert.strictEqual(moduleData.sensors.length, 2);

      // Verify first sensor
      const sensor1 = moduleData.sensors[0];
      assert.strictEqual(sensor1.sensorAddr, 10);
      assert.strictEqual(sensor1.temp, 28.79);
      assert.strictEqual(sensor1.hum, 53.79);

      // Verify second sensor
      const sensor2 = moduleData.sensors[1];
      assert.strictEqual(sensor2.sensorAddr, 12);
      assert.strictEqual(sensor2.temp, 0);
      assert.strictEqual(sensor2.hum, 0);
    });
  });

  describe('Door State Message', () => {
    it('should parse door state message correctly', () => {
      // Example from spec:
      // topic: "V6800Upload/2123456789/Door"
      const topic = "V6800Upload/2123456789/Door";
      const rawJson = {
        "msg_type": "door_state_changed_notify_req",
        "gateway_sn": "2123456789",
        "uuid_number": 333321551,
        "data": [
          { "extend_module_sn": "3963041727", "host_gateway_port_index": 2, "new_state": 1 }
        ]
      };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.deviceType, 'V6800');
      assert.strictEqual(result.deviceId, '2123456789');
      assert.strictEqual(result.messageType, 'DOOR_STATE');
      assert.strictEqual(result.rawMessageType, 'door_state_changed_notify_req');
      assert.strictEqual(result.messageId, '333321551');
      assert(result.ts); // Verify timestamp is injected

      // Verify data array
      assert(Array.isArray(result.data));
      assert.strictEqual(result.data.length, 1);

      // Verify module data
      const moduleData = result.data[0];
      assert.strictEqual(moduleData.modAddr, 2);
      assert.strictEqual(moduleData.modId, '3963041727'); // modId should be string
      assert.strictEqual(moduleData.doorState, '01'); // new_state=1 -> "01"
    });
  });

  describe('Init Message', () => {
    it('should parse init message correctly', () => {
      // Example from spec:
      // topic: "V6800Upload/2123456789/Init"
      const topic = "V6800Upload/2123456789/Init";
      const rawJson = {
        "msg_type": "devies_init_req",
        "gateway_sn": "2123456789",
        "gateway_ip": "192.168.0.212",
        "gateway_mac": "08:80:7E:...",
        "uuid_number": 797991388,
        "data": [
          { "module_index": 2, "module_sn": "3963041727", "module_u_num": 6, "module_sw_version": "2307101644" }
        ]
      };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.deviceType, 'V6800');
      assert.strictEqual(result.deviceId, '2123456789');
      assert.strictEqual(result.messageType, 'INIT');
      assert.strictEqual(result.rawMessageType, 'devies_init_req');
      assert.strictEqual(result.messageId, '797991388');
      assert(result.ts); // Verify timestamp is injected

      // Verify device info
      assert.strictEqual(result.device.ip, '192.168.0.212');
      assert.strictEqual(result.device.mac, '08:80:7E:...');

      // Verify modules array
      assert(Array.isArray(result.modules));
      assert.strictEqual(result.modules.length, 1);

      // Verify module data
      const moduleData = result.modules[0];
      assert.strictEqual(moduleData.modAddr, 2);
      assert.strictEqual(moduleData.modId, '3963041727'); // modId should be string
      assert.strictEqual(moduleData.uTotal, 6);
      assert.strictEqual(moduleData.fwVer, '2307101644');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown message type gracefully', () => {
      const topic = "V6800Upload/2123456789/UnknownType";
      const rawJson = { "msg_type": "unknown_type" };
      const jsonString = JSON.stringify(rawJson);

      const result = parser.parse(topic, jsonString);

      assert.strictEqual(result, null);
    });

    it('should handle malformed JSON gracefully', () => {
      const topic = "V6800Upload/2123456789/HeartBeat";
      const jsonString = '{ invalid json }';

      const result = parser.parse(topic, jsonString);

      assert.strictEqual(result, null);
    });
  });
});