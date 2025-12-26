const Logger = require('../../core/Logger');
const EventBus = require('../../core/EventBus');
const Database = require('../../core/Database');

/**
 * StorageService - Handles persisting normalized data to the database
 * Listens to 'data.normalized' events and routes data to appropriate tables
 */
class StorageService {
  constructor() {
    this.logger = Logger;
    this.eventBus = EventBus;
    this.database = Database;
    this.isStarted = false;
  }

  /**
   * Initialize the storage service
   * @returns {Promise<void>}
   */
  async start() {
    try {
      // Check if database is connected
      if (!this.database.isConnectionActive()) {
        throw new Error('Database is not connected. Unable to start StorageService.');
      }

      // Listen for normalized data events
      this.eventBus.on('data.normalized', this.handleNormalizedData.bind(this));
      
      this.isStarted = true;
      this.logger.info('StorageService: Started successfully');
    } catch (error) {
      this.logger.error('StorageService: Failed to start', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle normalized data from EventBus
   * @param {Array} normalizedDataArray - Array of normalized data objects
   * @returns {Promise<void>}
   */
  async handleNormalizedData(normalizedDataArray) {
    try {
      if (!Array.isArray(normalizedDataArray) || normalizedDataArray.length === 0) {
        this.logger.warn('StorageService: Invalid or empty normalized data array');
        return;
      }

      await this.saveBatch(normalizedDataArray);
    } catch (error) {
      this.logger.error('StorageService: Error handling normalized data', {
        error: error.message,
        stack: error.stack,
        dataSize: normalizedDataArray.length
      });
    }
  }

  /**
   * Save a batch of normalized data to the database
   * @param {Array} normalizedDataArray - Array of normalized data objects
   * @returns {Promise<void>}
   */
  async saveBatch(normalizedDataArray) {
    if (!this.isStarted) {
      this.logger.warn('StorageService: Cannot save batch, service not started');
      return;
    }

    try {
      // Group data by type for batch processing
      const groupedData = this._groupByType(normalizedDataArray);
      
      // Process each group
      for (const [type, data] of Object.entries(groupedData)) {
        switch (type) {
          case 'SYS_TELEMETRY':
            await this._saveTelemetryBatch(data);
            break;
          case 'SYS_RFID_EVENT':
            await this._saveRfidEvents(data);
            break;
          case 'SYS_RFID_SNAPSHOT':
          case 'SYS_STATE_CHANGE':
          case 'SYS_DEVICE_INFO':
          case 'SYS_LIFECYCLE':
            await this._upsertDeviceState(type, data);
            break;
          default:
            this.logger.warn(`StorageService: Unknown data type: ${type}`);
        }
      }

      this.logger.debug('StorageService: Batch saved successfully', {
        totalRecords: normalizedDataArray.length,
        groups: Object.keys(groupedData)
      });
      
      // Emit storage completion event
      this.eventBus.emit('storage.batch.completed');
    } catch (error) {
      this.logger.error('StorageService: Error saving batch', {
        error: error.message,
        stack: error.stack,
        batchSize: normalizedDataArray.length
      });
      throw error;
    }
  }

  /**
   * Group normalized data by type
   * @param {Array} normalizedDataArray - Array of normalized data objects
   * @returns {Object} Data grouped by type
   * @private
   */
  _groupByType(normalizedDataArray) {
    const grouped = {};
    
    for (const item of normalizedDataArray) {
      if (!item.type) {
        this.logger.warn('StorageService: Item missing type property', { item });
        continue;
      }
      
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      grouped[item.type].push(item);
    }
    
    return grouped;
  }

  /**
   * Save telemetry data in batch to iot_telemetry table
   * @param {Array} telemetryData - Array of telemetry data objects
   * @returns {Promise<void>}
   * @private
   */
  async _saveTelemetryBatch(telemetryData) {
    if (!telemetryData || telemetryData.length === 0) return;

    try {
      const knex = this.database.getKnex();
      
      // Prepare batch insert data
      const insertData = telemetryData.map(item => ({
        device_id: item.identity.deviceId,
        device_type: item.identity.deviceType,
        mod_addr: item.identity.modAddr || 0,
        sensor_addr: item.identity.sensorAddr || 0,
        telemetry_key: item.payload.key,
        telemetry_value: item.payload.value,
        timestamp: item.ts,
        created_at: new Date()
      }));

      // Batch insert
      await knex('iot_telemetry').insert(insertData);
      
      this.logger.debug(`StorageService: Inserted ${insertData.length} telemetry records`);
    } catch (error) {
      this.logger.error('StorageService: Error saving telemetry batch', {
        error: error.message,
        stack: error.stack,
        recordCount: telemetryData.length
      });
      throw error;
    }
  }

  /**
   * Save RFID events to iot_rfid_events table
   * @param {Array} rfidEventData - Array of RFID event data objects
   * @returns {Promise<void>}
   * @private
   */
  async _saveRfidEvents(rfidEventData) {
    if (!rfidEventData || rfidEventData.length === 0) return;

    try {
      const knex = this.database.getKnex();
      
      // Prepare insert data
      const insertData = rfidEventData.map(item => ({
        device_id: item.identity.deviceId,
        device_type: item.identity.deviceType,
        mod_addr: item.identity.modAddr || 0,
        sensor_addr: item.identity.sensorAddr || 0,
        tag_id: item.payload.value.tagId,
        action: item.payload.value.action,
        timestamp: item.ts,
        created_at: new Date()
      }));

      // Insert events
      await knex('iot_rfid_events').insert(insertData);
      
      this.logger.debug(`StorageService: Inserted ${insertData.length} RFID event records`);
    } catch (error) {
      this.logger.error('StorageService: Error saving RFID events', {
        error: error.message,
        stack: error.stack,
        recordCount: rfidEventData.length
      });
      throw error;
    }
  }

  /**
   * Upsert device state data to iot_device_state table
   * @param {string} type - Type of state data
   * @param {Array} stateData - Array of state data objects
   * @returns {Promise<void>}
   * @private
   */
  async _upsertDeviceState(type, stateData) {
    if (!stateData || stateData.length === 0) return;

    try {
      const knex = this.database.getKnex();
      
      // Process each item individually for upsert
      for (const item of stateData) {
        // Prepare upsert data
        const upsertData = {
          device_id: item.identity.deviceId,
          device_type: item.identity.deviceType,
          mod_addr: item.identity.modAddr || 0,
          sensor_addr: item.identity.sensorAddr || 0,
          state_type: type,
          json_value: JSON.stringify(item.payload),
          timestamp: item.ts,
          updated_at: new Date()
        };

        // Perform upsert (insert or update)
        await knex('iot_device_state')
          .insert({
            ...upsertData,
            created_at: new Date()
          })
          .onConflict(['device_id', 'device_type', 'mod_addr', 'sensor_addr', 'state_type'])
          .merge({
            json_value: upsertData.json_value,
            timestamp: upsertData.timestamp,
            updated_at: upsertData.updated_at
          });
      }
      
      this.logger.debug(`StorageService: Upserted ${stateData.length} ${type} records`);
    } catch (error) {
      this.logger.error('StorageService: Error upserting device state', {
        error: error.message,
        stack: error.stack,
        type,
        recordCount: stateData.length
      });
      throw error;
    }
  }

  /**
   * Stop the storage service
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      if (this.isStarted) {
        this.eventBus.removeAllListeners('data.normalized');
        this.isStarted = false;
        this.logger.info('StorageService: Stopped successfully');
      }
    } catch (error) {
      this.logger.error('StorageService: Error stopping service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      started: this.isStarted,
      databaseConnected: this.database.isConnectionActive()
    };
  }
}

module.exports = StorageService;