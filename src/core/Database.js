const knex = require('knex');
const Logger = require('./Logger');

/**
 * Database Service - Manages MySQL connection pool using Knex
 * Provides a singleton instance for the entire application
 */
class Database {
  constructor() {
    this.knex = null;
    this.config = null;
    this.isConnected = false;
    this.logger = Logger;
  }

  /**
   * Initialize database connection
   * @param {Object} config - Database configuration object
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async connect(config) {
    try {
      // Store configuration for later use
      this.config = config || this._getConfigFromEnv();
      
      // Create Knex instance with MySQL2 driver
      this.knex = knex({
        client: 'mysql2',
        connection: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.username,
          password: this.config.password,
          charset: this.config.charset || 'utf8mb4'
        },
        pool: {
          min: 2,
          max: this.config.connectionLimit || 10,
          acquireTimeoutMillis: this.config.acquireTimeout || 60000,
          createTimeoutMillis: this.config.timeout || 60000,
          destroyTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 100
        },
        migrations: {
          directory: './migrations',
          tableName: 'knex_migrations'
        },
        debug: process.env.NODE_ENV === 'development'
      });

      // Test the connection
      await this._testConnection();
      
      this.isConnected = true;
      this.logger.info('Database: Connection established successfully', {
        host: this.config.host,
        database: this.config.database,
        user: this.config.username
      });
      
      return true;
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Database: Failed to connect', {
        error: error.message,
        stack: error.stack,
        host: this.config?.host,
        database: this.config?.database
      });
      
      throw error;
    }
  }

  /**
   * Test database connection
   * @private
   */
  async _testConnection() {
    try {
      await this.knex.raw('SELECT 1 as test');
    } catch (error) {
      throw new Error(`Database connection test failed: ${error.message}`);
    }
  }

  /**
   * Get configuration from environment variables
   * @private
   * @returns {Object} Database configuration
   */
  _getConfigFromEnv() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'iot_middleware',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
      timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
      reconnect: process.env.DB_RECONNECT === 'true',
      charset: process.env.DB_CHARSET || 'utf8mb4'
    };
  }

  /**
   * Get Knex instance
   * @returns {Object} Knex instance
   * @throws {Error} If database is not connected
   */
  getKnex() {
    if (!this.isConnected || !this.knex) {
      throw new Error('Database is not connected. Call connect() first.');
    }
    return this.knex;
  }

  /**
   * Check if database is connected
   * @returns {boolean} Connection status
   */
  isConnectionActive() {
    return this.isConnected && this.knex !== null;
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.knex) {
        await this.knex.destroy();
        this.isConnected = false;
        this.knex = null;
        this.logger.info('Database: Connection closed');
      }
    } catch (error) {
      this.logger.error('Database: Error closing connection', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query
   * @param {Array} bindings - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async raw(sql, bindings = []) {
    try {
      return await this.getKnex().raw(sql, bindings);
    } catch (error) {
      this.logger.error('Database: Raw query failed', {
        sql,
        bindings,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get database connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    if (!this.knex || !this.knex.client.pool) {
      return null;
    }

    const pool = this.knex.client.pool;
    return {
      used: pool.numUsed(),
      free: pool.numFree(),
      pending: pool.numPendingAcquires(),
      total: pool.numUsed() + pool.numFree()
    };
  }

  /**
   * Health check for database connection
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.raw('SELECT 1');
      const responseTime = Date.now() - startTime;
      const stats = this.getConnectionStats();

      return {
        status: 'healthy',
        responseTime,
        ...stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
module.exports = new Database();