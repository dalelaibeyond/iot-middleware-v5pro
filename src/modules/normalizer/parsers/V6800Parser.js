const Logger = require('../../../core/Logger');

/**
 * V6800 Parser - Converts raw JSON strings to Standard Intermediate Format (SIF)
 * Handles parsing of various V6800 IoT device message types
 */
class V6800Parser {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Parse raw JSON string according to V6800 protocol
   * @param {string} topic - MQTT topic (e.g., "V6800Upload/2123456789/HeartBeat")
   * @param {string} jsonString - Raw JSON string from device
   * @returns {Object|null} Parsed message in Standard Intermediate Format (SIF)
   */
  parse(topic, jsonString) {
    try {
      // Parse the raw JSON string
      const rawJson = JSON.parse(jsonString);
      
      // Extract device information from topic
      const topicParts = topic.split('/');
      const deviceId = topicParts[1];
      const topicSuffix = topicParts[2];

      // Base result object with required fields
      const result = {
        topic,
        deviceType: 'V6800',
        deviceId,
        messageType: this.mapMessageType(topicSuffix),
        rawMessageType: rawJson.msg_type || '',
        messageId: (rawJson.uuid_number || rawJson.code || '').toString(),
        ts: new Date().toISOString() // Inject ISO timestamp
      };

      // Route to appropriate parser based on message type
      switch (result.messageType) {
        case 'HEARTBEAT':
          return this.parseHeartbeat(rawJson, result);
        case 'LABEL_STATE':
          return this.parseLabelState(rawJson, result);
        case 'TEM_HUM':
          return this.parseTemHum(rawJson, result);
        case 'DOOR_STATE':
          return this.parseDoorState(rawJson, result);
        case 'INIT':
          return this.parseInit(rawJson, result);
        case 'OPE_ACK':
          return this.parseOpeAck(rawJson, result);
        default:
          this.logger.warn(`V6800Parser: Unknown message type: ${result.messageType}`);
          return null;
      }
    } catch (error) {
      this.logger.error('V6800Parser: Error parsing message', {
        error: error.message,
        stack: error.stack,
        topic,
        jsonString
      });
      return null;
    }
  }

  /**
   * Map topic suffix to standardized message type
   * @param {string} topicSuffix - Topic suffix (e.g., "HeartBeat", "LabelState")
   * @returns {string} Standardized message type
   */
  mapMessageType(topicSuffix) {
    const mapping = {
      'HeartBeat': 'HEARTBEAT',
      'LabelState': 'LABEL_STATE',
      'TemHum': 'TEM_HUM',
      'Door': 'DOOR_STATE',
      'Init': 'INIT',
      'OpeAck': 'OPE_ACK'
    };
    return mapping[topicSuffix] || topicSuffix.toUpperCase();
  }

  /**
   * Parse Heartbeat message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed heartbeat
   */
  parseHeartbeat(rawJson, result) {
    // Parse meta information
    const meta = {
      voltage: parseFloat(rawJson.bus_V) || 0,
      current: parseFloat(rawJson.bus_I) || 0,
      mainPower: Boolean(rawJson.main_power),
      backupPower: Boolean(rawJson.backup_power)
    };

    // Parse modules array
    const modules = [];
    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        modules.push({
          modAddr: moduleData.module_index || moduleData.host_gateway_port_index,
          modId: (moduleData.module_sn || moduleData.extend_module_sn || '').toString(),
          uTotal: moduleData.module_u_num || 0
        });
      }
    }

    result.meta = meta;
    result.modules = modules;

    return result;
  }

  /**
   * Parse LabelState (RFID) message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed RFID data
   */
  parseLabelState(rawJson, result) {
    const data = [];

    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        const items = [];

        // Handle different data structures
        const uData = moduleData.u_data;
        if (Array.isArray(uData)) {
          for (const tagData of uData) {
            // Calculate action based on state change
            let action = null;
            if (tagData.new_state !== undefined && tagData.old_state !== undefined) {
              if (tagData.new_state === 1 && tagData.old_state === 0) {
                action = 'attached';
              } else if (tagData.new_state === 0 && tagData.old_state === 1) {
                action = 'detached';
              }
            }

            items.push({
              uPos: tagData.u_index,
              alarmStatus: tagData.warning || 0,
              tagId: tagData.tag_code || tagData.tag_code || null,
              action
            });
          }
        }

        data.push({
          modAddr: moduleData.host_gateway_port_index || moduleData.index,
          modId: (moduleData.extend_module_sn || moduleData.module_id || '').toString(),
          items
        });
      }
    }

    result.data = data;
    return result;
  }

  /**
   * Parse Temperature & Humidity message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed temperature/humidity data
   */
  parseTemHum(rawJson, result) {
    const data = [];

    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        const sensors = [];

        // Handle temperature/humidity data
        const thData = moduleData.th_data;
        if (Array.isArray(thData)) {
          for (const sensorData of thData) {
            sensors.push({
              sensorAddr: sensorData.temper_position,
              temp: parseFloat(sensorData.temper_swot) || 0,
              hum: parseFloat(sensorData.hygrometer_swot) || 0
            });
          }
        }

        data.push({
          modAddr: moduleData.host_gateway_port_index,
          modId: (moduleData.extend_module_sn || '').toString(),
          sensors
        });
      }
    }

    result.data = data;
    return result;
  }

  /**
   * Parse Door State message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed door state
   */
  parseDoorState(rawJson, result) {
    const data = [];

    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        data.push({
          modAddr: moduleData.host_gateway_port_index,
          modId: (moduleData.extend_module_sn || '').toString(),
          doorState: moduleData.new_state ? '01' : '00'
        });
      }
    }

    result.data = data;
    return result;
  }

  /**
   * Parse Init message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed init data
   */
  parseInit(rawJson, result) {
    // Parse device information
    const device = {
      ip: rawJson.gateway_ip || '',
      mac: rawJson.gateway_mac || ''
    };

    // Parse modules array
    const modules = [];
    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        modules.push({
          modAddr: moduleData.module_index,
          modId: (moduleData.module_sn || '').toString(),
          uTotal: moduleData.module_u_num || 0,
          fwVer: moduleData.module_sw_version || ''
        });
      }
    }

    result.device = device;
    result.modules = modules;

    return result;
  }

  /**
   * Parse OpeAck message
   * @param {Object} rawJson - Raw JSON object
   * @param {Object} result - Base result object
   * @returns {Object} Parsed operation acknowledgment
   */
  parseOpeAck(rawJson, result) {
    const data = [];

    if (Array.isArray(rawJson.data)) {
      for (const moduleData of rawJson.data) {
        const parsedModule = {
          modAddr: moduleData.host_gateway_port_index || moduleData.index,
          modId: (moduleData.extend_module_sn || moduleData.module_id || '').toString()
        };

        // Handle different response types
        if (rawJson.msg_type === 'u_color') {
          // Color query response
          const colorMap = [];
          if (Array.isArray(moduleData.color_data)) {
            for (const colorData of moduleData.color_data) {
              colorMap.push(colorData.code);
            }
          }
          parsedModule.colorMap = colorMap;
        } else if (rawJson.msg_type === 'set_module_property_result_req') {
          // Set property response
          parsedModule.result = moduleData.set_property_result === 0 ? 'Success' : 'Failure';
        } else if (rawJson.msg_type === 'clear_u_warning') {
          // Clear alarm response
          parsedModule.result = moduleData.ctr_flag ? 'Success' : 'Failure';
        }

        data.push(parsedModule);
      }
    }

    result.data = data;
    return result;
  }
}

module.exports = V6800Parser;