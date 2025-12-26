const Logger = require('../../../core/Logger');

/**
 * V5008 Parser - Converts binary buffers to Standard Intermediate Format (SIF)
 * Handles parsing of various V5008 IoT device message types
 */
class V5008Parser {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Parse binary message buffer according to V5008 protocol
   * @param {string} topic - MQTT topic (e.g., "V5008Upload/2437871205/OpeAck")
   * @param {Buffer} messageBuffer - Raw binary message buffer
   * @returns {Object} Parsed message in Standard Intermediate Format (SIF)
   */
  parse(topic, messageBuffer) {
    try {
      // Extract device information from topic
      const topicParts = topic.split('/');
      const deviceId = topicParts[1];
      const topicSuffix = topicParts[2];

      // Convert buffer to hex string for logging
      const hexString = messageBuffer.toString('hex').toUpperCase();
      
      // Determine message type by examining binary header first
      let messageType = topicSuffix; // fallback to topic suffix
      const header = messageBuffer.length > 0 ? messageBuffer.readUInt8(0) : null;
      
      if (header !== null) {
        switch (header) {
          case 0xCC:
          case 0xCB:
            messageType = "HEARTBEAT";
            break;
          case 0xBB:
            messageType = "LABEL_STATE";
            break;
          case 0xBA:
            messageType = "DOOR_STATE";
            break;
          case 0xAA:
            messageType = "OPE_ACK";
            break;
          // If header is unknown, keep messageType as topicSuffix (fallback)
        }
      }
      
      // Base result object with required fields
      const result = {
        topic,
        message: hexString,
        deviceType: 'V5008',
        deviceId,
        messageType,
        ts: new Date().toISOString() // Inject ISO timestamp
      };
      
      // Route to appropriate parser based on message type
      if (messageType === 'HEARTBEAT') {
        return this.parseOpeAck(messageBuffer, result);
      } else if (messageType === 'LABEL_STATE') {
        return this.parseLabelState(messageBuffer, result);
      } else if (messageType === 'DOOR_STATE') {
        return this.parseOpeAck(messageBuffer, result);
      } else if (messageType === 'OPE_ACK') {
        return this.parseOpeAck(messageBuffer, result);
      } else if (messageType === 'TemHum') {
        return this.parseTemHum(messageBuffer, result);
      } else if (messageType === 'Noise') {
        return this.parseNoise(messageBuffer, result);
      } else {
        this.logger.warn(`V5008Parser: Unknown message type: ${messageType}`);
        return null;
      }
    } catch (error) {
      this.logger.error('V5008Parser: Error parsing message', {
        error: error.message,
        stack: error.stack,
        topic
      });
      return null;
    }
  }

  /**
   * Parse OpeAck messages (includes Heartbeat, Door State, and various responses)
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @returns {Object} Parsed result
   */
  parseOpeAck(buffer, result) {
    const header = buffer.readUInt8(0);
    let offset = 0;

    // Extract messageId (always last 4 bytes)
    const messageId = this.readBigUIntBE(buffer, buffer.length - 4).toString();

    switch (header) {
      case 0xCC:
      case 0xCB:
        // HEARTBEAT message
        return this.parseHeartbeat(buffer, result, messageId);
      
      case 0xBA:
        // DOOR_STATE message
        return this.parseDoorState(buffer, result, messageId);
      
      case 0xBB:
        // RFID Event (should normally be in LabelState topic)
        return this.parseRfidEvent(buffer, result, messageId);
      
      case 0xAA:
        // Various responses (Color, Alarm, etc.)
        return this.parseAAResponse(buffer, result, messageId);
      
      case 0xEF:
        // Device/Module info responses
        if (buffer.length >= 2) {
          const subHeader = buffer.readUInt8(1);
          if (subHeader === 0x01) {
            return this.parseDeviceInfoResponse(buffer, result, messageId);
          } else if (subHeader === 0x02) {
            return this.parseModuleInfoResponse(buffer, result, messageId);
          }
        }
        break;
      
      default:
        this.logger.warn(`V5008Parser: Unknown OpeAck header: 0x${header.toString(16)}`);
        return null;
    }

    return null;
  }

  /**
   * Parse Heartbeat message
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed heartbeat
   */
  parseHeartbeat(buffer, result, messageId) {
    const modules = [];
    let offset = 1; // Skip header

    // Parse up to 10 module slots (ignore slots > 5 as per spec)
    for (let i = 0; i < 10; i++) {
      if (offset + 9 > buffer.length - 4) break; // Ensure we don't read past messageId

      const modAddr = buffer.readUInt8(offset);
      const modId = this.readBigUIntBE(buffer, offset + 1).toString();
      const uTotal = buffer.readUInt8(offset + 5);

      // Only include valid modules (address 1-5)
      if (modAddr >= 1 && modAddr <= 5) {
        modules.push({
          modAddr,
          modId, // Ensure modId is string as required
          uTotal
        });
      }

      offset += 6; // Each module entry is 6 bytes
    }

    result.messageId = messageId;
    result.modules = modules;
    
    // Add metadata for heartbeat processing
    // For V5008 heartbeat, we'll simulate power status
    result.meta = {
      voltage: 12.5, // Simulated voltage
      current: 0.8,  // Simulated current
      mainPower: true,
      backupPower: false
    };

    return result;
  }

  /**
   * Parse Door State message
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed door state
   */
  parseDoorState(buffer, result, messageId) {
    const modAddr = buffer.readUInt8(1);
    const modId = this.readBigUIntBE(buffer, 2).toString();
    const doorState = buffer.readUInt8(6).toString(16).padStart(2, '0');

    result.messageId = messageId;
    result.modAddr = modAddr;
    result.modId = modId; // Ensure modId is string
    result.doorState = doorState;

    return result;
  }

  /**
   * Parse LabelState message (RFID events)
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @returns {Object} Parsed RFID data
   */
  parseLabelState(buffer, result) {
    const modAddr = buffer.readUInt8(0);
    const modId = this.readBigUIntBE(buffer, 1).toString();
    const reserved = buffer.readUInt8(5);
    const uTotal = buffer.readUInt8(6);
    const onlineCount = buffer.readUInt8(7);

    const items = [];
    let offset = 8;

    // Parse each RFID tag
    for (let i = 0; i < onlineCount; i++) {
      if (offset + 6 > buffer.length - 4) break; // Ensure we don't read past messageId

      const uPos = buffer.readUInt8(offset);
      const alarmStatus = buffer.readUInt8(offset + 1);
      const tagId = buffer.subarray(offset + 2, offset + 6).toString('hex').toUpperCase();

      items.push({
        uPos,
        alarmStatus,
        tagId
      });

      offset += 6; // Each RFID entry is 6 bytes
    }

    // Extract messageId (last 4 bytes)
    const messageId = this.readBigUIntBE(buffer, buffer.length - 4).toString();

    result.messageId = messageId;
    result.modAddr = modAddr;
    result.modId = modId; // Ensure modId is string
    result.uTotal = uTotal;
    result.onlineCount = onlineCount;
    result.items = items;

    return result;
  }

  /**
   * Parse Temperature & Humidity message
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @returns {Object} Parsed temperature/humidity data
   */
  parseTemHum(buffer, result) {
    const modAddr = buffer.readUInt8(0);
    const modId = this.readBigUIntBE(buffer, 1).toString();

    const sensors = [];
    let offset = 5; // Skip modAddr + modId

    // Parse 6 sensor slots (fixed array)
    for (let i = 0; i < 6; i++) {
      if (offset + 5 > buffer.length - 4) break; // Ensure we don't read past messageId

      const sensorAddr = buffer.readUInt8(offset);
      
      if (sensorAddr >= 0x0A && sensorAddr <= 0x0F) {
        // Valid sensor address, parse temperature and humidity
        const temp = this.parseSignedDecimal(buffer, offset + 1);
        const hum = this.parseSignedDecimal(buffer, offset + 3);
        
        sensors.push({
          sensorAddr,
          temp,
          hum
        });
      } else {
        // Invalid or unused sensor
        sensors.push({
          sensorAddr,
          temp: null,
          hum: null
        });
      }

      offset += 5; // Each sensor entry is 5 bytes
    }

    // Extract messageId (last 4 bytes)
    const messageId = this.readBigUIntBE(buffer, buffer.length - 4).toString();

    result.messageId = messageId;
    result.modAddr = modAddr;
    result.modId = modId; // Ensure modId is string
    result.sensors = sensors;

    return result;
  }

  /**
   * Parse Noise message
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @returns {Object} Parsed noise data
   */
  parseNoise(buffer, result) {
    const modAddr = buffer.readUInt8(0);
    const modId = this.readBigUIntBE(buffer, 1).toString();

    const sensors = [];
    let offset = 5; // Skip modAddr + modId

    // Parse 3 sensor slots (fixed array)
    for (let i = 0; i < 3; i++) {
      if (offset + 3 > buffer.length - 4) break; // Ensure we don't read past messageId

      const sensorAddr = buffer.readUInt8(offset);
      
      if (sensorAddr >= 0x10 && sensorAddr <= 0x12) {
        // Valid sensor address, parse noise level
        const noise = this.parseSignedDecimal(buffer, offset + 1);
        
        sensors.push({
          sensorAddr,
          noise
        });
      } else {
        // Invalid or unused sensor
        sensors.push({
          sensorAddr,
          noise: null
        });
      }

      offset += 3; // Each sensor entry is 3 bytes
    }

    // Extract messageId (last 4 bytes)
    const messageId = this.readBigUIntBE(buffer, buffer.length - 4).toString();

    result.messageId = messageId;
    result.modAddr = modAddr;
    result.modId = modId; // Ensure modId is string
    result.sensors = sensors;

    return result;
  }

  /**
   * Parse AA response messages (Color, Alarm, etc.)
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed response
   */
  parseAAResponse(buffer, result, messageId) {
    const deviceId = this.readBigUIntBE(buffer, 1).toString();
    const resultCode = buffer.readUInt8(5);
    
    // Map resultCode to "Success" or "Failure"
    const resultText = resultCode === 0xA1 ? "Success" : "Failure";

    result.messageId = messageId;
    result.result = resultText;

    // Determine response type by examining the original request
    const reqLength = buffer.length - 10; // Total - header(1) - deviceId(4) - result(1) - messageId(4)
    const originalReq = buffer.subarray(6, 6 + reqLength).toString('hex').toUpperCase();
    
    result.originalReq = originalReq;

    // Check if this is a color query response (has color data)
    if (originalReq.startsWith('E4')) {
      // QRY_COLOR_RESP - parse color map
      const colorMap = [];
      let offset = 6 + reqLength;
      
      while (offset < buffer.length - 4) {
        colorMap.push(buffer.readUInt8(offset));
        offset++;
      }
      
      result.colorMap = colorMap;
    }

    return result;
  }

  /**
   * Parse Device Info Response
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed device info
   */
  parseDeviceInfoResponse(buffer, result, messageId) {
    const model = buffer.subarray(2, 6).toString('ascii');
    const fwVer = this.readBigUIntBE(buffer, 6).toString();
    
    // Parse IP addresses
    const ip = this.parseIpAddress(buffer, 10);
    const mask = this.parseIpAddress(buffer, 14);
    const gatewayIp = this.parseIpAddress(buffer, 18);
    
    // Parse MAC address
    const mac = Array.from(buffer.subarray(22, 28))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();

    result.messageId = messageId;
    result.model = model;
    result.fwVer = fwVer;
    result.ip = ip;
    result.mask = mask;
    result.gatewayIp = gatewayIp;
    result.mac = mac;

    return result;
  }

  /**
   * Parse Module Info Response
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed module info
   */
  parseModuleInfoResponse(buffer, result, messageId) {
    const modules = [];
    let offset = 2; // Skip EF02 header

    // Parse modules until we reach messageId
    while (offset + 5 <= buffer.length - 4) {
      const modAddr = buffer.readUInt8(offset);
      const fwVer = this.readBigUIntBE(buffer, offset + 1).toString();
      
      modules.push({
        modAddr,
        fwVer
      });

      offset += 5; // Each module entry is 5 bytes
    }

    result.messageId = messageId;
    result.modules = modules;

    return result;
  }

  /**
   * Parse RFID Event (alternative parsing for BB header in OpeAck)
   * @param {Buffer} buffer - Message buffer
   * @param {Object} result - Base result object
   * @param {string} messageId - Message ID
   * @returns {Object} Parsed RFID event
   */
  parseRfidEvent(buffer, result, messageId) {
    // This is similar to LabelState parsing but with BB header
    return this.parseLabelState(buffer.subarray(1), result); // Skip BB header
  }

  /**
   * Parse signed decimal value (integer + fraction)
   * @param {Buffer} buffer - Buffer containing the value
   * @param {number} offset - Offset to start reading from
   * @returns {number|null} Parsed decimal value or null if invalid
   */
  parseSignedDecimal(buffer, offset) {
    if (offset + 1 >= buffer.length) return null;
    
    const intPart = buffer.readInt8(offset);
    const fracPart = buffer.readUInt8(offset + 1);
    
    // Handle zero values (indicates unused sensor)
    if (intPart === 0 && fracPart === 0) {
      return null;
    }
    
    // Calculate final value with proper sign handling
    let value = Math.abs(intPart) + (fracPart / 100.0);
    if (intPart < 0) value = -value;
    
    return value;
  }

  /**
   * Parse IP address from buffer
   * @param {Buffer} buffer - Buffer containing IP bytes
   * @param {number} offset - Offset to start reading from
   * @returns {string} IP address in dot notation
   */
  parseIpAddress(buffer, offset) {
    if (offset + 3 >= buffer.length) return '0.0.0.0';
    
    return [
      buffer.readUInt8(offset),
      buffer.readUInt8(offset + 1),
      buffer.readUInt8(offset + 2),
      buffer.readUInt8(offset + 3)
    ].join('.');
  }

  /**
   * Read big-endian unsigned integer from buffer
   * @param {Buffer} buffer - Buffer to read from
   * @param {number} offset - Offset to start reading from
   * @param {number} bytes - Number of bytes to read (default: 4)
   * @returns {number} Unsigned integer value
   */
  readBigUIntBE(buffer, offset, bytes = 4) {
    if (offset + bytes > buffer.length) return 0;
    
    let value = 0;
    for (let i = 0; i < bytes; i++) {
      value = (value << 8) | buffer.readUInt8(offset + i);
    }
    return value;
  }
}

module.exports = V5008Parser;