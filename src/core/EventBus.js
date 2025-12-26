const EventEmitter = require('events');
const Logger = require('./Logger');

/**
 * Singleton EventBus that extends Node's EventEmitter
 * Provides centralized event handling for the entire application
 * Logs every event emitted for debugging and tracing purposes
 */
class EventBus extends EventEmitter {
  constructor() {
    if (EventBus.instance) {
      return EventBus.instance;
    }

    super();
    this.logger = Logger;
    this.setMaxListeners(50); // Increase default limit for complex event chains
    
    // Log when listeners are added or removed
    this.on('newListener', (event, listener) => {
      this.logger.debug(`EventBus: New listener added for event '${event}'`);
    });

    this.on('removeListener', (event, listener) => {
      this.logger.debug(`EventBus: Listener removed for event '${event}'`);
    });

    EventBus.instance = this;
    this.logger.info('EventBus: Singleton instance created');
  }

  /**
   * Emit an event with logging
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean} Returns true if the event had listeners, false otherwise
   */
  emit(event, ...args) {
    // Log the event emission at debug level for tracing
    this.logger.debug(`EventBus: Emitting event '${event}'`, {
      event,
      argsCount: args.length,
      args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
    });

    // Call parent emit method
    const result = super.emit(event, ...args);

    // Log if no listeners were found
    if (!result) {
      this.logger.warn(`EventBus: No listeners found for event '${event}'`);
    }

    return result;
  }

  /**
   * Add an event listener with error handling
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventBus} Returns this for chaining
   */
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new Error('EventBus: Listener must be a function');
    }

    // Wrap listener with error handling
    const wrappedListener = async (...args) => {
      try {
        await listener(...args);
      } catch (error) {
        this.logger.error(`EventBus: Error in listener for event '${event}'`, {
          error: error.message,
          stack: error.stack
        });
      }
    };

    return super.on(event, wrappedListener);
  }

  /**
   * Add a one-time event listener with error handling
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventBus} Returns this for chaining
   */
  once(event, listener) {
    if (typeof listener !== 'function') {
      throw new Error('EventBus: Listener must be a function');
    }

    // Wrap listener with error handling
    const wrappedListener = async (...args) => {
      try {
        await listener(...args);
      } catch (error) {
        this.logger.error(`EventBus: Error in once listener for event '${event}'`, {
          error: error.message,
          stack: error.stack
        });
      }
    };

    return super.once(event, wrappedListener);
  }

  /**
   * Remove all listeners for an event or all events
   * @param {string} [event] - Event name (optional, if not provided removes all listeners)
   * @returns {EventBus} Returns this for chaining
   */
  removeAllListeners(event) {
    if (event) {
      this.logger.debug(`EventBus: Removing all listeners for event '${event}'`);
    } else {
      this.logger.debug('EventBus: Removing all listeners for all events');
    }
    return super.removeAllListeners(event);
  }

  /**
   * Get the count of listeners for a specific event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return super.listenerCount(event);
  }

  /**
   * Get all event names that have listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return super.eventNames();
  }

  /**
   * Get statistics about the EventBus
   * @returns {Object} Statistics object
   */
  getStats() {
    const events = this.eventNames();
    return {
      totalEvents: events.length,
      maxListeners: this.getMaxListeners(),
      events: events.map(event => ({
        name: event,
        listenerCount: this.listenerCount(event)
      }))
    };
  }

  /**
   * Clean up all event listeners
   * Should be called during application shutdown
   */
  cleanup() {
    const eventNames = this.eventNames();
    this.removeAllListeners();
    this.logger.info('EventBus: All listeners removed during cleanup', {
      eventsCleared: eventNames.length,
      events: eventNames
    });
  }
}

// Create and export singleton instance
module.exports = new EventBus();