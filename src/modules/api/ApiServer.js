const express = require('express');
const Logger = require('../../core/Logger');
const Database = require('../../core/Database');

/**
 * API Server - Provides REST API endpoints for the IoT Middleware
 * Includes health check endpoint for monitoring and observability
 */
class ApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.logger = Logger;
    this.mqttService = null;
    this.port = process.env.API_PORT || 3000;
    this.host = process.env.API_HOST || '0.0.0.0';
    this.isRunning = false;
    
    // Middleware
    this._setupMiddleware();
    
    // Routes
    this._setupRoutes();
  }

  /**
   * Set up Express middleware
   * @private
   */
  _setupMiddleware() {
    // Parse JSON request bodies
    this.app.use(express.json());
    
    // Parse URL-encoded request bodies
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      this.logger.debug('ApiServer: Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      next();
    });
  }

  /**
   * Set up API routes
   * @private
   */
  _setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const healthData = await this._performHealthCheck();
        
        // Determine HTTP status code based on overall health
        const statusCode = healthData.status === 'ok' ? 200 : 503;
        
        res.status(statusCode).json(healthData);
      } catch (error) {
        this.logger.error('ApiServer: Health check error', {
          error: error.message,
          stack: error.stack
        });
        
        // Return error response
        res.status(500).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'Internal server error during health check'
        });
      }
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'IoT Middleware V5 API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      this.logger.error('ApiServer: Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      });
    });
  }

  /**
   * Perform comprehensive health checks
   * @private
   * @returns {Promise<Object>} Health check results
   */
  async _performHealthCheck() {
    const checks = {
      database: await this._checkDatabase(),
      mqtt: await this._checkMqtt()
    };

    // Determine overall status
    const allHealthy = Object.values(checks).every(check => check.status === 'connected');
    const overallStatus = allHealthy ? 'ok' : 'error';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      uptimeFormatted: this._formatUptime(process.uptime()),
      checks
    };
  }

  /**
   * Check database connection health
   * @private
   * @returns {Promise<Object>} Database health status
   */
  async _checkDatabase() {
    try {
      const startTime = Date.now();
      
      // Check if database is connected
      if (!Database.isConnectionActive()) {
        return {
          status: 'disconnected',
          message: 'Database connection is not active'
        };
      }

      // Perform actual query test
      await Database.getKnex().raw('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      const stats = Database.getConnectionStats();

      return {
        status: 'connected',
        responseTime,
        pool: stats
      };
    } catch (error) {
      this.logger.error('ApiServer: Database health check failed', {
        error: error.message
      });
      
      return {
        status: 'disconnected',
        message: error.message
      };
    }
  }

  /**
   * Check MQTT service connection health
   * @private
   * @returns {Promise<Object>} MQTT health status
   */
  async _checkMqtt() {
    try {
      if (!this.mqttService) {
        return {
          status: 'not_initialized',
          message: 'MQTT service has not been initialized'
        };
      }

      const isConnected = this.mqttService.isConnectionActive();
      const stats = this.mqttService.getConnectionStats();

      if (isConnected) {
        return {
          status: 'connected',
          ...stats
        };
      } else {
        return {
          status: 'disconnected',
          message: 'MQTT client is not connected to broker',
          ...stats
        };
      }
    } catch (error) {
      this.logger.error('ApiServer: MQTT health check failed', {
        error: error.message
      });
      
      return {
        status: 'disconnected',
        message: error.message
      };
    }
  }

  /**
   * Format uptime in human-readable format
   * @private
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime string
   */
  _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Set MQTT service reference for health checks
   * @param {MqttService} mqttService - MQTT service instance
   */
  setMqttService(mqttService) {
    this.mqttService = mqttService;
    this.logger.info('ApiServer: MQTT service reference set');
  }

  /**
   * Start the API server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          this.isRunning = true;
          this.logger.info('ApiServer: Started successfully', {
            host: this.host,
            port: this.port,
            url: `http://${this.host}:${this.port}`
          });
          resolve();
        });

        // Handle server errors
        this.server.on('error', (error) => {
          this.logger.error('ApiServer: Server error', {
            error: error.message,
            code: error.code
          });
          reject(error);
        });
      } catch (error) {
        this.logger.error('ApiServer: Failed to start', {
          error: error.message,
          stack: error.stack
        });
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        this.logger.warn('ApiServer: Server is not running');
        resolve();
        return;
      }

      // Set a timeout to force close if graceful shutdown takes too long
      const shutdownTimeout = setTimeout(() => {
        this.logger.warn('ApiServer: Shutdown timeout, forcing server close...');
        try {
          this.server.closeAllConnections();
          this.isRunning = false;
          this.logger.info('ApiServer: Forced shutdown complete');
          resolve();
        } catch (forceError) {
          this.logger.error('ApiServer: Error during forced shutdown', {
            error: forceError.message
          });
          reject(forceError);
        }
      }, 5000); // 5 second timeout

      this.server.close((error) => {
        clearTimeout(shutdownTimeout);
        if (error) {
          this.logger.error('ApiServer: Error stopping server', {
            error: error.message
          });
          reject(error);
        } else {
          this.isRunning = false;
          this.logger.info('ApiServer: Stopped successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Get server status
   * @returns {Object} Server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      host: this.host,
      port: this.port,
      uptime: process.uptime()
    };
  }
}

module.exports = ApiServer;
