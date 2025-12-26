/**
 * IoT Middleware V5 - Application Bootstrap
 * 
 * This is the main entry point for the production application.
 * It initializes all modules, wires up event handlers, and manages graceful shutdown.
 */

// Load environment variables from .env file
require('dotenv').config();

const Logger = require('./core/Logger');
const EventBus = require('./core/EventBus');
const Database = require('./core/Database');
const MqttService = require('./modules/mqtt-ingress/MqttService');
const UnifyNormalizer = require('./modules/normalizer/UnifyNormalizer');
const StorageService = require('./modules/storage/StorageService');
const ParserRegistry = require('./modules/normalizer/ParserRegistry');
const ApiServer = require('./modules/api/ApiServer');

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
  // Override with environment variables if available (highest priority)
  database: {
    ...config.database,
    ...productionConfig.database,
    host: process.env.DB_HOST || config.database.host,
    port: parseInt(process.env.DB_PORT) || config.database.port,
    database: process.env.DB_NAME || config.database.database,
    username: process.env.DB_USER || config.database.username,
    password: process.env.DB_PASSWORD || config.database.password
  },
  mqtt: {
    ...config.mqtt,
    ...productionConfig.mqtt,
    brokerUrl: process.env.MQTT_BROKER_URL || config.mqtt.brokerUrl,
    username: process.env.MQTT_USERNAME || config.mqtt.username,
    password: process.env.MQTT_PASSWORD || config.mqtt.password,
    clientId: process.env.MQTT_CLIENT_ID || config.mqtt.clientId,
    topics: process.env.MQTT_TOPICS ?
      process.env.MQTT_TOPICS.split(',').map(t => t.trim()) :
      config.mqtt.topics
  },
  api: {
    ...config.api,
    ...productionConfig.api,
    port: parseInt(process.env.API_PORT) || config.api.port,
    host: process.env.API_HOST || config.api.host
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
    this.parserRegistry = new ParserRegistry();
    this.apiServer = null;
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
      
      // Initialize API server
      this.apiServer = new ApiServer();
      this.apiServer.setMqttService(this.mqttService);

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

    // Start API Server if enabled
    if (modules.api?.enabled !== false) {
      this.logger.info('IoT Middleware V5: Starting API Server...');
      try {
        await this.apiServer.start();
      } catch (error) {
        this.logger.warn('IoT Middleware V5: API Server failed to start, continuing without it', {
          error: error.message
        });
        // Don't fail the entire app if API server fails
      }
    }
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

        // Get appropriate parser from registry
        const parser = this.parserRegistry.getParser(mqttData.topic);
        let parsedData;
        
        if (parser) {
          parsedData = parser.parse(mqttData.topic, mqttData.message);
        } else {
          this.logger.warn('IoT Middleware V5: No parser found for topic', {
            topic: mqttData.topic
          });
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
      api: this.apiServer ? this.apiServer.getStatus() : null,
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
        // Stop API Server
        if (this.apiServer) {
          this.logger.info('IoT Middleware V5: Stopping API Server...');
          await this.apiServer.stop();
        }

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

        // Clean up EventBus listeners
        this.logger.info('IoT Middleware V5: Cleaning up EventBus...');
        this.eventBus.cleanup();

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

// Flag to prevent multiple shutdowns
let isShuttingDown = false;

// Handle graceful shutdown
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`\nAlready shutting down, ignoring ${signal}...`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  
  // Set a timeout to force exit if shutdown takes too long (10 seconds)
  //
  // WHY shutdown can take too long:
  // 1. API Server: Active HTTP connections (long-running requests, websockets, streaming)
  //    - server.close() waits for all connections to close gracefully
  //    - If a request is stuck or takes too long, the server hangs indefinitely
  //
  // 2. MQTT Service: Broker unreachable or connection in bad state
  //    - client.end() waits for graceful disconnect acknowledgment from broker
  //    - If broker is unresponsive, this can hang indefinitely
  //
  // 3. Database: Active queries or transactions not completed
  //    - knex.destroy() waits for all connections in the pool to be released
  //    - If a query is stuck or database server is unreachable, this can hang
  //
  // 4. Network issues: Any network-related shutdown can hang if remote endpoint is unresponsive
  //
  // WHEN shutdown takes too long:
  // - Network connectivity issues (MQTT broker, database server down)
  // - Stuck database queries or transactions
  // - Long-running HTTP requests that don't complete
  // - Unresponsive remote services
  // - Deadlocks or resource locks in the system
  const shutdownTimeout = setTimeout(() => {
    console.log('\nShutdown timeout reached, forcing exit...');
    console.log('This may indicate a resource is stuck or unresponsive during shutdown.');
    process.exit(1);
  }, 10000);
  
  try {
    await app.shutdown();
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('\nError during shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

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