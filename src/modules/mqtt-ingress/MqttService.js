const mqtt = require('mqtt');
const EventBus = require('../../core/EventBus');
const Logger = require('../../core/Logger');

/**
 * MQTT Service - Handles inbound MQTT messages
 * Subscribes to V5008 and V6800 topics and emits events via EventBus
 */
class MqttService {
  constructor() {
    this.client = null;
    this.config = null;
    this.logger = Logger;
    this.eventBus = EventBus;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000; // 5 seconds
  }

  /**
   * Initialize MQTT service
   * @param {Object} config - MQTT configuration object
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async start(config) {
    try {
      // Store configuration
      this.config = config || this._getConfigFromEnv();
      
      // Create MQTT client
      this.client = mqtt.connect(this.config.brokerUrl, {
        clientId: this.config.clientId || 'iot-middleware-v5',
        username: this.config.username,
        password: this.config.password,
        keepalive: this.config.options?.keepalive || 60,
        reconnectPeriod: this.config.options?.reconnectPeriod || 1000,
        connectTimeout: this.config.options?.connectTimeout || 30000,
        clean: this.config.options?.clean !== false,
        encoding: this.config.options?.encoding || 'utf8'
      });

      // Set up event handlers
      this._setupEventHandlers();

      // Wait for connection
      await this._waitForConnection();
      
      // Subscribe to topics
      await this._subscribeToTopics();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      this.logger.info('MqttService: Connected and subscribed successfully', {
        brokerUrl: this.config.brokerUrl,
        clientId: this.config.clientId
      });
      
      return true;
    } catch (error) {
      this.logger.error('MqttService: Failed to start', {
        error: error.message,
        stack: error.stack,
        brokerUrl: this.config?.brokerUrl
      });
      
      throw error;
    }
  }

  /**
   * Set up MQTT client event handlers
   * @private
   */
  _setupEventHandlers() {
    // Connection successful
    this.client.on('connect', () => {
      this.logger.info('MqttService: Connected to MQTT broker');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // Connection lost
    this.client.on('offline', () => {
      this.isConnected = false;
      this.logger.warn('MqttService: Connection lost');
    });

    // Reconnection attempt
    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      this.logger.info(`MqttService: Reconnection attempt ${this.reconnectAttempts}`);
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        this.logger.error('MqttService: Max reconnection attempts reached');
        this.client.end();
      }
    });

    // Connection close
    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.info('MqttService: Connection closed');
    });

    // Error handling
    this.client.on('error', (error) => {
      this.logger.error('MqttService: MQTT error', {
        error: error.message,
        stack: error.stack
      });
    });

    // Message received
    this.client.on('message', (topic, message) => {
      this._handleMessage(topic, message);
    });
  }

  /**
   * Wait for MQTT connection
   * @private
   * @returns {Promise<void>}
   */
  _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MqttService: Connection timeout'));
      }, this.config.options?.connectTimeout || 30000);

      this.client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Subscribe to required topics
   * @private
   * @returns {Promise<void>}
   */
  async _subscribeToTopics() {
    const topics = this.config.topics || [
      'V5008Upload/+/#',
      'V6800Upload/+/#'
    ];

    for (const topic of topics) {
      await this._subscribe(topic);
    }
  }

  /**
   * Subscribe to a single topic
   * @private
   * @param {string} topic - Topic to subscribe to
   * @returns {Promise<void>}
   */
  _subscribe(topic) {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          this.logger.error(`MqttService: Failed to subscribe to ${topic}`, {
            error: error.message
          });
          reject(error);
        } else {
          this.logger.info(`MqttService: Subscribed to ${topic}`, {
            qos: granted[0]?.qos
          });
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming MQTT message
   * @private
   * @param {string} topic - MQTT topic
   * @param {Buffer} message - Message payload
   */
  _handleMessage(topic, message) {
    try {
      // Log the received topic
      this.logger.debug(`MqttService: Message received on topic: ${topic}`, {
        topic,
        messageSize: message.length
      });

      // Emit event via EventBus with topic and message (keep as Buffer)
      this.eventBus.emit('mqtt.message', {
        topic,
        message
      });

    } catch (error) {
      this.logger.error('MqttService: Error handling message', {
        topic,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Get configuration from environment variables
   * @private
   * @returns {Object} MQTT configuration
   */
  _getConfigFromEnv() {
    return {
      brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      clientId: process.env.MQTT_CLIENT_ID || 'iot-middleware-v5',
      topics: process.env.MQTT_TOPICS ? 
        process.env.MQTT_TOPICS.split(',').map(t => t.trim()) : 
        ['V5008Upload/+/#', 'V6800Upload/+/#'],
      options: {
        keepalive: parseInt(process.env.MQTT_KEEPALIVE) || 60,
        reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 1000,
        connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT) || 30000,
        clean: process.env.MQTT_CLEAN !== 'false',
        encoding: process.env.MQTT_ENCODING || 'utf8'
      }
    };
  }

  /**
   * Publish a message to a topic
   * @param {string} topic - Topic to publish to
   * @param {string|Buffer} message - Message to publish
   * @param {Object} options - Publish options
   * @returns {Promise<void>}
   */
  async publish(topic, message, options = {}) {
    if (!this.isConnected) {
      throw new Error('MqttService: Not connected to broker');
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1, ...options }, (error) => {
        if (error) {
          this.logger.error(`MqttService: Failed to publish to ${topic}`, {
            error: error.message
          });
          reject(error);
        } else {
          this.logger.debug(`MqttService: Published to ${topic}`, {
            messageSize: message.length
          });
          resolve();
        }
      });
    });
  }

  /**
   * Check if MQTT client is connected
   * @returns {boolean} Connection status
   */
  isConnectionActive() {
    return this.isConnected && this.client && !this.client.disconnected;
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      brokerUrl: this.config?.brokerUrl,
      clientId: this.config?.clientId
    };
  }

  /**
   * Stop MQTT service
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      if (this.client) {
        // Remove all listeners to prevent memory leaks
        this.client.removeAllListeners();
        
        // End connection
        await new Promise((resolve) => {
          this.client.end(false, {}, () => resolve());
        });
        
        this.isConnected = false;
        this.logger.info('MqttService: Disconnected from broker');
      }
    } catch (error) {
      this.logger.error('MqttService: Error stopping service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = MqttService;