/**
 * IoT Middleware V5 - Application Bootstrap
 * 
 * This is the main entry point for the production application.
 * It initializes all modules, wires up event handlers, and manages graceful shutdown.
 */

const Logger = require('./core/Logger');
const EventBus = require('./core/EventBus');
const Database = require('./core/Database');
const MqttService = require('./modules/mqtt-ingress/MqttService');
const UnifyNormalizer = require('./modules/normalizer/UnifyNormalizer');
const StorageService = require('./modules/storage/StorageService');

// Load configuration
const config = require('../config/default.json');
let productionConfig = {};

// Try to load production config (may be empty)
try {
  productionConfig = require('../config/production.json');
} catch (error) {
  // Production config doesn't exist or is empty, use environment variables
  console.warn('Production config not found, using environment variables');
}

// Merge configs (production overrides default)
const appConfig = {
  ...config,
  ...productionConfig,
  // Override with environment variables if available
  database: {
    ...config.database,
    ...productionConfig.database,
    host: process.env.DB_HOST || config.database.host,
    port: parseInt(process.env.DB_PORT) || config.database.port,
    database: process.env.DB_NAME || config.database.database,
    username: process.env.DB_USER || config.database.username,
    password: process.env.DB_PASSWORD || config.database.password || "Abc#!Dale123"
  }
};

class IoTMiddlewareApp {
  constructor() {
    this.logger = Logger;
    this.eventBus = EventBus;
    this.database = Database;
    this.mqttService = null;
    this.normalizer = null;
    this.storageService = null;
    this.isRunning = false;
    this.config = appConfig;
  }

  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logger.info('IoT Middleware V5: Starting application...', {
        name: this.config.app.name,
        version: this.config.app.version,
        environment: this.config.app.environment
      });

      // 1. Connect to Database
      this.logger.info('IoT Middleware V5: Connecting to database...');
      await this.database.connect(this.config.database);
      this.logger.info('IoT Middleware V5: Database connected successfully');

      // 2. Initialize Modules
      this.logger.info('IoT Middleware V5: Initializing modules...');
      
      // EventBus is already a singleton, no need to instantiate
      
      // Initialize business logic module
      this.normalizer = new UnifyNormalizer();
      
      // Initialize persistence module
      this.storageService = new StorageService();
      
      // Initialize ingress module
      this.mqttService = new MqttService();

      // 3. Start enabled modules
      await this._startEnabledModules();

      // 4. Wire up event handlers
      this._wireEventHandlers();

      this.isRunning = true;
      this.logger.info('IoT Middleware V5: Application started successfully');

    } catch (error) {
      this.logger.error('IoT Middleware V5: Failed to initialize application', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Start enabled modules based on configuration
   * @private
   * @returns {Promise<void>}
   */
  async _startEnabledModules() {
    const modules = this.config.modules;

    // Start Storage Service if enabled
    if (modules.storage?.enabled !== false) {
      this.logger.info('IoT Middleware V5: Starting Storage Service...');
      await this.storageService.start();
    }

    // Start MQTT Service if enabled
    if (modules['mqtt-ingress']?.enabled !== false) {
      this.logger.info('IoT Middleware V5: Starting MQTT Service...');
      try {
        await this.mqttService.start(this.config.mqtt);
      } catch (error) {
        this.logger.warn('IoT Middleware V5: MQTT Service failed to start, continuing without it', {
          error: error.message
        });
        // Don't fail the entire app if MQTT fails
      }
    }

    // Note: API and WebSocket modules would be started here if needed
    // For now, we focus on the core pipeline
  }

  /**
   * Wire up event handlers between modules
   * @private
   */
  _wireEventHandlers() {
    this.logger.info('IoT Middleware V5: Wiring event handlers...');

    // Subscribe to MQTT messages and pass to Normalizer
    this.eventBus.on('mqtt.message', async (mqttData) => {
      try {
        this.logger.debug('IoT Middleware V5: Processing MQTT message', {
          topic: mqttData.topic
        });

        // Determine parser based on topic
        let parsedData;
        if (mqttData.topic.includes('V5008')) {
          const V5008Parser = require('./modules/normalizer/parsers/V5008Parser');
          const parser = new V5008Parser();
          parsedData = parser.parse(mqttData.topic, mqttData.message);
        } else if (mqttData.topic.includes('V6800')) {
          const V6800Parser = require('./modules/normalizer/parsers/V6800Parser');
          const parser = new V6800Parser();
          parsedData = parser.parse(mqttData.topic, mqttData.message);
        }

        if (parsedData) {
          // Pass parsed data to Normalizer
          const normalizedData = await this.normalizer.normalize(parsedData);
          
          this.logger.debug('IoT Middleware V5: Normalized data', {
            count: normalizedData.length,
            types: normalizedData.map(item => item.type)
          });

          // Pass normalized data to Storage Service (via EventBus)
          this.eventBus.emit('data.normalized', normalizedData);
        }
      } catch (error) {
        this.logger.error('IoT Middleware V5: Error processing MQTT message', {
          topic: mqttData.topic,
          error: error.message,
          stack: error.stack
        });
      }
    });

    // Handle storage service errors
    this.eventBus.on('storage.error', (error) => {
      this.logger.error('IoT Middleware V5: Storage service error', {
        error: error.message,
        stack: error.stack
      });
    });

    // Handle database connection errors
    this.eventBus.on('database.error', (error) => {
      this.logger.error('IoT Middleware V5: Database error', {
        error: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * Get application status
   * @returns {Object} Application status
   */
  getStatus() {
    return {
      running: this.isRunning,
      database: {
        connected: this.database.isConnectionActive()
      },
      mqtt: this.mqttService ? this.mqttService.getConnectionStats() : null,
      storage: this.storageService ? this.storageService.getStatus() : null
    };
  }

  /**
   * Gracefully shutdown the application
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      this.logger.info('IoT Middleware V5: Shutting down application...');

      if (this.isRunning) {
        // Stop MQTT Service
        if (this.mqttService) {
          this.logger.info('IoT Middleware V5: Stopping MQTT Service...');
          await this.mqttService.stop();
        }

        // Stop Storage Service
        if (this.storageService) {
          this.logger.info('IoT Middleware V5: Stopping Storage Service...');
          await this.storageService.stop();
        }

        // Close Database connection
        this.logger.info('IoT Middleware V5: Closing database connection...');
        await this.database.disconnect();

        this.isRunning = false;
        this.logger.info('IoT Middleware V5: Application shutdown complete');
      }
    } catch (error) {
      this.logger.error('IoT Middleware V5: Error during shutdown', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Create and start the application
const app = new IoTMiddlewareApp();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  Logger.error('IoT Middleware V5: Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  await app.shutdown();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  Logger.error('IoT Middleware V5: Unhandled promise rejection', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  await app.shutdown();
  process.exit(1);
});

// Start the application
async function startApp() {
  try {
    await app.initialize();
    
    // Keep the process running
    process.stdin.resume();
    
    Logger.info('IoT Middleware V5: Application is running. Press CTRL+C to stop.');
  } catch (error) {
    Logger.error('IoT Middleware V5: Failed to start application', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  startApp();
}

module.exports = IoTMiddlewareApp;