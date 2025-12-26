const assert = require('assert');
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');

describe('V5008Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new V5008Parser();
  });

  describe('Heartbeat Message', () => {
    it('should parse heartbeat message correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/OpeAck"
      // message: "CC01EC3737BF06028C0909950C0300000000000400000000000500000000000600000000000700000000000800000000000900000000000A0000000000F200168F"
      const topic = "V5008Upload/2437871205/OpeAck";
      const hexMessage = "CC01EC3737BF06028C0909950C0300000000000400000000000500000000000600000000000700000000000800000000000900000000000A0000000000F200168F";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'OpeAck');
      assert.strictEqual(result.messageId, '4060092047');
      assert(result.ts); // Verify timestamp is injected

      // Verify modules array
      assert(Array.isArray(result.modules));
      assert.strictEqual(result.modules.length, 2);

      // Verify first module
      const module1 = result.modules[0];
      assert.strictEqual(module1.modAddr, 1);
      assert.strictEqual(module1.modId, '3963041727'); // modId should be string
      assert.strictEqual(module1.uTotal, 6);

      // Verify second module
      const module2 = result.modules[1];
      assert.strictEqual(module2.modAddr, 2);
      assert.strictEqual(module2.modId, '2349402517'); // modId should be string
      assert.strictEqual(module2.uTotal, 12);
    });
  });

  describe('Temperature & Humidity Message', () => {
    it('should parse temperature and humidity message correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/TemHum"
      // message: "01EC3737BF0A1C30331B0B1C08330B0C000000000D000000000E000000000F0000000001012CC3"
      const topic = "V5008Upload/2437871205/TemHum";
      const hexMessage = "01EC3737BF0A1C30331B0B1C08330B0C000000000D000000000E000000000F0000000001012CC3";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'TemHum');
      assert.strictEqual(result.messageId, '16846659');
      assert(result.ts); // Verify timestamp is injected

      // Verify module info
      assert.strictEqual(result.modAddr, 1);
      assert.strictEqual(result.modId, '3963041727'); // modId should be string

      // Verify sensors array
      assert(Array.isArray(result.sensors));
      assert.strictEqual(result.sensors.length, 6);

      // Verify sensor 10 (first sensor with data)
      const sensor10 = result.sensors[0];
      assert.strictEqual(sensor10.sensorAddr, 10);
      assert.strictEqual(sensor10.temp, 28.48); // 0x1C (28) + 0x30 (48/100)
      assert.strictEqual(sensor10.hum, 51.27); // 0x1B (27) + 0x33 (51/100)

      // Verify sensor 11 (second sensor with data)
      const sensor11 = result.sensors[1];
      assert.strictEqual(sensor11.sensorAddr, 11);
      assert.strictEqual(sensor11.temp, 28.08); // 0x1C (28) + 0x08 (8/100)
      assert.strictEqual(sensor11.hum, 51.11); // 0x1B (27) + 0x0B (11/100)

      // Verify sensors 12-15 (unused sensors should be null)
      for (let i = 2; i < 6; i++) {
        assert.strictEqual(result.sensors[i].temp, null);
        assert.strictEqual(result.sensors[i].hum, null);
      }
    });
  });

  describe('RFID Message', () => {
    it('should parse RFID message correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/LabelState"
      // message: "BB028C090995000C030A00DD344A440B00DD2862B40C00DD3CE9C4050007AD"
      const topic = "V5008Upload/2437871205/LabelState";
      const hexMessage = "BB028C090995000C030A00DD344A440B00DD2862B40C00DD3CE9C4050007AD";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'LabelState');
      assert.strictEqual(result.messageId, '83891437');
      assert(result.ts); // Verify timestamp is injected

      // Verify module info
      assert.strictEqual(result.modAddr, 2);
      assert.strictEqual(result.modId, '2349402517'); // modId should be string
      assert.strictEqual(result.uTotal, 12);
      assert.strictEqual(result.onlineCount, 3);

      // Verify items array
      assert(Array.isArray(result.items));
      assert.strictEqual(result.items.length, 3);

      // Verify first RFID tag
      const item1 = result.items[0];
      assert.strictEqual(item1.uPos, 10);
      assert.strictEqual(item1.alarmStatus, 0);
      assert.strictEqual(item1.tagId, 'DD344A44');

      // Verify second RFID tag
      const item2 = result.items[1];
      assert.strictEqual(item2.uPos, 11);
      assert.strictEqual(item2.alarmStatus, 0);
      assert.strictEqual(item2.tagId, 'DD2862B4');

      // Verify third RFID tag
      const item3 = result.items[2];
      assert.strictEqual(item3.uPos, 12);
      assert.strictEqual(item3.alarmStatus, 0);
      assert.strictEqual(item3.tagId, 'DD3CE9C4');
    });
  });

  describe('Door State Message', () => {
    it('should parse door state message correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/OpeAck"
      // message: "BA01EC3737BF010B01C7F8"
      const topic = "V5008Upload/2437871205/OpeAck";
      const hexMessage = "BA01EC3737BF010B01C7F8";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'OpeAck');
      assert.strictEqual(result.messageId, '184666104');
      assert(result.ts); // Verify timestamp is injected

      // Verify door state info
      assert.strictEqual(result.modAddr, 1);
      assert.strictEqual(result.modId, '3963041727'); // modId should be string
      assert.strictEqual(result.doorState, '01'); // Door is open
    });
  });

  describe('Response Messages', () => {
    it('should parse color set response correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/OpeAck"
      // message: "AA914EF665A1E101050206012B002316"
      const topic = "V5008Upload/2437871205/OpeAck";
      const hexMessage = "AA914EF665A1E101050206012B002316";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'OpeAck');
      assert.strictEqual(result.messageId, '721420310');
      assert(result.ts); // Verify timestamp is injected

      // Verify response info
      assert.strictEqual(result.result, 'Success'); // A1 maps to Success
      assert.strictEqual(result.originalReq, 'E10105020601');
    });

    it('should parse color query response correctly', () => {
      // Example from spec:
      // topic: "V5008Upload/2437871205/OpeAck"
      // message: "AA914EF665A1E4010000000D0D0825015D4C"
      const topic = "V5008Upload/2437871205/OpeAck";
      const hexMessage = "AA914EF665A1E4010000000D0D0825015D4C";
      const messageBuffer = Buffer.from(hexMessage, 'hex');

      const result = parser.parse(topic, messageBuffer);

      // Verify basic structure
      assert.strictEqual(result.topic, topic);
      assert.strictEqual(result.message, hexMessage);
      assert.strictEqual(result.deviceType, 'V5008');
      assert.strictEqual(result.deviceId, '2437871205');
      assert.strictEqual(result.messageType, 'OpeAck');
      assert.strictEqual(result.messageId, '620846412');
      assert(result.ts); // Verify timestamp is injected

      // Verify response info
      assert.strictEqual(result.result, 'Success'); // A1 maps to Success
      assert.strictEqual(result.originalReq, 'E401');
      
      // Verify color map
      assert(Array.isArray(result.colorMap));
      assert.deepStrictEqual(result.colorMap, [0, 0, 0, 13, 13, 8]);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown message type gracefully', () => {
      const topic = "V5008Upload/2437871205/UnknownType";
      const messageBuffer = Buffer.from('01020304', 'hex');

      const result = parser.parse(topic, messageBuffer);

      assert.strictEqual(result, null);
    });

    it('should handle malformed buffer gracefully', () => {
      const topic = "V5008Upload/2437871205/OpeAck";
      const messageBuffer = Buffer.from('CC', 'hex'); // Too short

      const result = parser.parse(topic, messageBuffer);

      // Should not crash, may return null or partial result
      assert(result === null || result.topic === topic);
    });
  });
});