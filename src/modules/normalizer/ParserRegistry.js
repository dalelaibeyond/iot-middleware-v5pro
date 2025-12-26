const Logger = require('../../core/Logger');
const V5008Parser = require('./parsers/V5008Parser');
const V6800Parser = require('./parsers/V6800Parser');

/**
 * ParserRegistry - Central registry for all device parsers
 * 
 * This registry decouples the application from specific parser implementations
 * by providing a lookup mechanism based on MQTT topics. It allows for:
 * - Dynamic parser discovery
 * - Easy addition of new parsers without modifying app.js
 * - Centralized parser management
 * 
 * Usage:
 *   const registry = new ParserRegistry();
 *   const parser = registry.getParser('V5008Upload/2437871205/OpeAck');
 *   if (parser) {
 *     const parsed = parser.parse(topic, message);
 *   }
 */
class ParserRegistry {
  constructor() {
    this.logger = Logger;
    this.parsers = [];
    this._registerParsers();
  }

  /**
   * Register all available parsers
   * @private
   */
  _registerParsers() {
    // Register V5008 parser
    this.register(V5008Parser);
    
    // Register V6800 parser
    this.register(V6800Parser);
    
    this.logger.info('ParserRegistry: Registered parsers', {
      count: this.parsers.length,
      parsers: this.parsers.map(p => p.name)
    });
  }

  /**
   * Register a parser class
   * @param {Function} ParserClass - Parser class to register
   * @throws {Error} If ParserClass doesn't have a canHandle method
   */
  register(ParserClass) {
    if (typeof ParserClass.canHandle !== 'function') {
      throw new Error(`Parser ${ParserClass.name} must implement a static canHandle(topic) method`);
    }
    
    this.parsers.push(ParserClass);
    this.logger.debug(`ParserRegistry: Registered parser ${ParserClass.name}`);
  }

  /**
   * Get the appropriate parser for a given topic
   * Iterates through registered parsers and returns the first one that can handle the topic
   * 
   * @param {string} topic - MQTT topic to find a parser for
   * @returns {Object|null} Parser instance or null if no parser found
   */
  getParser(topic) {
    if (!topic || typeof topic !== 'string') {
      this.logger.warn('ParserRegistry: Invalid topic provided', { topic });
      return null;
    }

    // Iterate through registered parsers and find the first one that can handle the topic
    for (const ParserClass of this.parsers) {
      if (ParserClass.canHandle(topic)) {
        this.logger.debug(`ParserRegistry: Found parser ${ParserClass.name} for topic`, { topic });
        return new ParserClass();
      }
    }

    // No parser found for this topic
    this.logger.warn('ParserRegistry: No parser found for topic', { topic });
    return null;
  }

  /**
   * Get all registered parser classes
   * @returns {Array<Function>} Array of registered parser classes
   */
  getRegisteredParsers() {
    return [...this.parsers];
  }

  /**
   * Check if a parser is registered
   * @param {Function} ParserClass - Parser class to check
   * @returns {boolean} True if the parser is registered
   */
  hasParser(ParserClass) {
    return this.parsers.includes(ParserClass);
  }

  /**
   * Get the number of registered parsers
   * @returns {number} Number of registered parsers
   */
  getParserCount() {
    return this.parsers.length;
  }
}

// Export singleton instance for convenience
const registryInstance = new ParserRegistry();

module.exports = ParserRegistry;
module.exports.default = registryInstance;
