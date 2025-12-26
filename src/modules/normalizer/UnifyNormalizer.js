const Logger = require('../../core/Logger');
const StateCache = require('./cache/StateCache');

/**
 * UnifyNormalizer - Converts parsed device data to Standard Unified Objects (SUO)
 * Implements Device Shadow pattern with diffing for V5008 and patching for V6800
 */
class UnifyNormalizer {
  constructor() {
    this.logger = Logger;
    this.stateCache = new StateCache();
  }

  /**
   * Main entry point for normalizing parsed data
   * @param {Object} parsedData - Output from V5008Parser or V6800Parser
   * @returns {Promise<Array>} Array of unified objects
   */
  async normalize(parsedData) {
    try {
      if (!parsedData || !parsedData.deviceType) {
        this.logger.warn('UnifyNormalizer: Invalid parsed data', { parsedData });
        return [];
      }

      const { deviceType, messageType } = parsedData;

      // Route to appropriate processor based on device type and message type
      if (deviceType === 'V5008') {
        return this._processV5008(parsedData);
      } else if (deviceType === 'V6800') {
        return this._processV6800(parsedData);
      } else {
        this.logger.warn(`UnifyNormalizer: Unknown device type: ${deviceType}`);
        return [];
      }
    } catch (error) {
      this.logger.error('UnifyNormalizer: Error normalizing data', {
        error: error.message,
        stack: error.stack,
        parsedData
      });
      return [];
    }
  }

  /**
   * Process V5008 parsed data (Snapshot → Events)
   * @param {Object} parsedData - Parsed V5008 data
   * @returns {Promise<Array>} Array of unified objects
   * @private
   */
  async _processV5008(parsedData) {
    const results = [];
    const { deviceId, messageType } = parsedData;

    // Create identity object for all results
    const identity = {
      deviceId,
      deviceType: 'V5008'
    };

    switch (messageType) {
      case 'OpeAck':
        // Handle different OpeAck subtypes
        if (parsedData.result) {
          // Response messages (Color, Alarm, etc.)
          return this._createResponseObject(parsedData, identity);
        } else if (parsedData.doorState !== undefined) {
          // Door state change
          return this._createDoorStateObject(parsedData, identity);
        }
        break;

      case 'LabelState':
        // RFID data - implement diffing logic
        return await this._processV5008Rfid(parsedData, identity);

      case 'TemHum':
        // Temperature & Humidity - flatten sensors
        return this._flattenTelemetry(parsedData, identity, 'temperature', 'humidity');

      case 'Noise':
        // Noise sensors - flatten sensors
        return this._flattenNoiseTelemetry(parsedData, identity);

      case 'HeartBeat':
      case 'HEARTBEAT':
        // Heartbeat - extract meta info
        return this._processHeartbeat(parsedData, identity);
    }

    return results;
  }

  /**
   * Process V6800 parsed data (Events → Snapshot)
   * @param {Object} parsedData - Parsed V6800 data
   * @returns {Promise<Array>} Array of unified objects
   * @private
   */
  async _processV6800(parsedData) {
    const results = [];
    const { deviceId, messageType } = parsedData;

    // Create identity object for all results
    const identity = {
      deviceId,
      deviceType: 'V6800'
    };

    switch (messageType) {
      case 'LABEL_STATE':
        // RFID events - implement patching logic
        return await this._processV6800Rfid(parsedData, identity);

      case 'TEM_HUM':
        // Temperature & Humidity - flatten sensors
        return this._flattenTelemetry(parsedData, identity, 'temperature', 'humidity');

      case 'DOOR_STATE':
        // Door state change
        return this._createDoorStateObject(parsedData, identity);

      case 'INIT':
        // Device initialization - split into device info and modules
        return this._splitV6800Init(parsedData, identity);

      case 'OPE_ACK':
        // Operation acknowledgment
        return this._createResponseObject(parsedData, identity);

      case 'HEARTBEAT':
        // Heartbeat - extract meta info
        return this._processHeartbeat(parsedData, identity);
    }

    return results;
  }

  /**
   * Process V5008 RFID data with diffing logic
   * @param {Object} parsedData - Parsed V5008 RFID data
   * @param {Object} identity - Device identity
   * @returns {Promise<Array>} Array of unified objects
   * @private
   */
  async _processV5008Rfid(parsedData, identity) {
    const results = [];
    const { modAddr, modId, items } = parsedData;

    // Load previous state from cache
    const prevTags = await this.stateCache.get(identity.deviceId, modAddr) || new Map();

    // Create current state map
    const currTags = new Map();
    for (const item of items) {
      currTags.set(item.uPos, {
        tagId: item.tagId,
        alarmStatus: item.alarmStatus
      });
    }

    // Diff engine: find changes
    const events = [];

    // Tags in previous but not in current -> detached
    for (const [uPos, tagData] of prevTags.entries()) {
      if (!currTags.has(uPos)) {
        events.push({
          identity: { ...identity, modAddr, sensorAddr: uPos },
          type: 'SYS_RFID_EVENT',
          ts: parsedData.ts,
          payload: {
            key: 'rfid_event',
            value: {
              action: 'detached',
              tagId: tagData.tagId,
              uPos,
              alarmStatus: tagData.alarmStatus
            }
          }
        });
      }
    }

    // Tags in current but not in previous -> attached
    for (const [uPos, tagData] of currTags.entries()) {
      if (!prevTags.has(uPos)) {
        events.push({
          identity: { ...identity, modAddr, sensorAddr: uPos },
          type: 'SYS_RFID_EVENT',
          ts: parsedData.ts,
          payload: {
            key: 'rfid_event',
            value: {
              action: 'attached',
              tagId: tagData.tagId,
              uPos,
              alarmStatus: tagData.alarmStatus
            }
          }
        });
      }
    }

    // Update cache with current state
    await this.stateCache.set(identity.deviceId, modAddr, currTags);

    // Add snapshot object
    events.push({
      identity: { ...identity, modAddr, sensorAddr: 0 },
      type: 'SYS_RFID_SNAPSHOT',
      ts: parsedData.ts,
      payload: {
        key: 'rfid_snapshot',
        value: {
          modId,
          items: Array.from(currTags.entries()).map(([uPos, tag]) => ({
            uPos,
            tagId: tag.tagId,
            alarmStatus: tag.alarmStatus
          }))
        }
      }
    });

    return events;
  }

  /**
   * Process V6800 RFID data with patching logic
   * @param {Object} parsedData - Parsed V6800 RFID data
   * @param {Object} identity - Device identity
   * @returns {Promise<Array>} Array of unified objects
   * @private
   */
  async _processV6800Rfid(parsedData, identity) {
    const results = [];
    const { data } = parsedData;

    for (const moduleData of data) {
      const { modAddr, modId, items } = moduleData;

      // Load current shadow from cache
      let currentShadow = await this.stateCache.get(identity.deviceId, modAddr);

      // Edge case: if cache is empty, emit pass-through events and require sync
      if (!currentShadow) {
        for (const item of items) {
          results.push({
            identity: { ...identity, modAddr, sensorAddr: item.uPos },
            type: 'SYS_RFID_EVENT',
            ts: parsedData.ts,
            payload: {
              key: 'rfid_event',
              value: {
                action: item.action,
                tagId: item.tagId,
                uPos: item.uPos,
                alarmStatus: item.alarmStatus
              }
            }
          });
        }

        // Emit require sync event
        results.push({
          identity: { ...identity, modAddr, sensorAddr: 0 },
          type: 'SYS_REQUIRE_SYNC',
          ts: parsedData.ts,
          payload: {
            key: 'require_sync',
            value: { reason: 'cache_miss' }
          }
        });

        continue; // Skip patching for this module
      }

      // Patch logic: apply events to shadow
      const updatedShadow = new Map(currentShadow);

      for (const item of items) {
        if (item.action === 'attached') {
          updatedShadow.set(item.uPos, {
            tagId: item.tagId,
            alarmStatus: item.alarmStatus
          });
        } else if (item.action === 'detached') {
          updatedShadow.delete(item.uPos);
        }

        // Pass through the event
        results.push({
          identity: { ...identity, modAddr, sensorAddr: item.uPos },
          type: 'SYS_RFID_EVENT',
          ts: parsedData.ts,
          payload: {
            key: 'rfid_event',
            value: {
              action: item.action,
              tagId: item.tagId,
              uPos: item.uPos,
              alarmStatus: item.alarmStatus
            }
          }
        });
      }

      // Update cache with patched shadow
      await this.stateCache.set(identity.deviceId, modAddr, updatedShadow);

      // Emit snapshot
      results.push({
        identity: { ...identity, modAddr, sensorAddr: 0 },
        type: 'SYS_RFID_SNAPSHOT',
        ts: parsedData.ts,
        payload: {
          key: 'rfid_snapshot',
          value: {
            modId,
            items: Array.from(updatedShadow.entries()).map(([uPos, tag]) => ({
              uPos,
              tagId: tag.tagId,
              alarmStatus: tag.alarmStatus
            }))
          }
        }
      });
    }

    return results;
  }

  /**
   * Flatten telemetry data (temperature, humidity, noise)
   * @param {Object} parsedData - Parsed telemetry data
   * @param {Object} identity - Device identity
   * @param {string} tempKey - Key for temperature data
   * @param {string} humKey - Key for humidity data
   * @returns {Array} Array of unified objects
   * @private
   */
  _flattenTelemetry(parsedData, identity, tempKey, humKey) {
    const results = [];
    const { ts, modAddr, modId, sensors } = parsedData;

    if (!Array.isArray(sensors)) return results;

    for (const sensor of sensors) {
      // Skip sensors with null values
      if (sensor[tempKey] === null && sensor[humKey] === null) continue;

      // Temperature object
      if (sensor[tempKey] !== null) {
        results.push({
          identity: { ...identity, modAddr, sensorAddr: sensor.sensorAddr },
          type: 'SYS_TELEMETRY',
          ts,
          payload: {
            key: 'temperature',
            value: sensor[tempKey],
            raw: { modId }
          }
        });
      }

      // Humidity object
      if (sensor[humKey] !== null) {
        results.push({
          identity: { ...identity, modAddr, sensorAddr: sensor.sensorAddr },
          type: 'SYS_TELEMETRY',
          ts,
          payload: {
            key: 'humidity',
            value: sensor[humKey],
            raw: { modId }
          }
        });
      }
    }

    return results;
  }

  /**
   * Flatten noise telemetry data
   * @param {Object} parsedData - Parsed noise data
   * @param {Object} identity - Device identity
   * @returns {Array} Array of unified objects
   * @private
   */
  _flattenNoiseTelemetry(parsedData, identity) {
    const results = [];
    const { ts, modAddr, modId, sensors } = parsedData;

    if (!Array.isArray(sensors)) return results;

    for (const sensor of sensors) {
      // Skip sensors with null values
      if (sensor.noise === null) continue;

      results.push({
        identity: { ...identity, modAddr, sensorAddr: sensor.sensorAddr },
        type: 'SYS_TELEMETRY',
        ts,
        payload: {
          key: 'noise',
          value: sensor.noise,
          raw: { modId }
        }
      });
    }

    return results;
  }

  /**
   * Process heartbeat data
   * @param {Object} parsedData - Parsed heartbeat data
   * @param {Object} identity - Device identity
   * @returns {Array} Array of unified objects
   * @private
   */
  _processHeartbeat(parsedData, identity) {
    const results = [];
    const { ts, meta } = parsedData;

    if (!meta) return results;

    // Voltage telemetry
    if (meta.voltage !== undefined) {
      results.push({
        identity: { ...identity, modAddr: 0, sensorAddr: 0 },
        type: 'SYS_TELEMETRY',
        ts,
        payload: {
          key: 'voltage',
          value: meta.voltage,
          raw: { mainPower: meta.mainPower, backupPower: meta.backupPower }
        }
      });
    }

    // Current telemetry
    if (meta.current !== undefined) {
      results.push({
        identity: { ...identity, modAddr: 0, sensorAddr: 0 },
        type: 'SYS_TELEMETRY',
        ts,
        payload: {
          key: 'current',
          value: meta.current,
          raw: { mainPower: meta.mainPower, backupPower: meta.backupPower }
        }
      });
    }

    // Lifecycle status
    results.push({
      identity: { ...identity, modAddr: 0, sensorAddr: 0 },
      type: 'SYS_LIFECYCLE',
      ts,
      payload: {
        key: 'device_status',
        value: meta.mainPower ? 'online' : 'backup_power',
        raw: { mainPower: meta.mainPower, backupPower: meta.backupPower }
      }
    });

    return results;
  }

  /**
   * Create door state change object
   * @param {Object} parsedData - Parsed door state data
   * @param {Object} identity - Device identity
   * @returns {Array} Array with single unified object
   * @private
   */
  _createDoorStateObject(parsedData, identity) {
    const { ts, modAddr, modId, doorState } = parsedData;

    return [{
      identity: { ...identity, modAddr, sensorAddr: 0 },
      type: 'SYS_STATE_CHANGE',
      ts,
      payload: {
        key: 'door_state',
        value: doorState === '01' ? 1 : 0, // Convert to boolean/number
        raw: { modId, doorState }
      }
    }];
  }

  /**
   * Create response object
   * @param {Object} parsedData - Parsed response data
   * @param {Object} identity - Device identity
   * @returns {Array} Array with single unified object
   * @private
   */
  _createResponseObject(parsedData, identity) {
    const { ts, result, originalReq } = parsedData;

    return [{
      identity: { ...identity, modAddr: 0, sensorAddr: 0 },
      type: 'SYS_STATE_CHANGE',
      ts,
      payload: {
        key: 'operation_result',
        value: result === 'Success' ? 1 : 0, // Convert to boolean/number
        raw: { result, originalReq }
      }
    }];
  }

  /**
   * Split V6800 Init message into device and module info
   * @param {Object} parsedData - Parsed init data
   * @param {Object} identity - Device identity
   * @returns {Array} Array of unified objects
   * @private
   */
  _splitV6800Init(parsedData, identity) {
    const results = [];
    const { ts, device, modules } = parsedData;

    // Device info object
    if (device) {
      results.push({
        identity: { ...identity, modAddr: 0, sensorAddr: 0 },
        type: 'SYS_DEVICE_INFO',
        ts,
        payload: {
          key: 'device_info',
          value: {
            ip: device.ip,
            mac: device.mac
          }
        }
      });
    }

    // Module info objects
    if (Array.isArray(modules)) {
      for (const module of modules) {
        results.push({
          identity: { ...identity, modAddr: module.modAddr, sensorAddr: 0 },
          type: 'SYS_DEVICE_INFO',
          ts,
          payload: {
            key: 'module_info',
            value: {
              modId: module.modId,
              uTotal: module.uTotal,
              fwVer: module.fwVer
            }
          }
        });
      }
    }

    return results;
  }

  /**
   * Get state cache instance
   * @returns {StateCache} The state cache
   */
  getStateCache() {
    return this.stateCache;
  }
}

module.exports = UnifyNormalizer;