// End-to-End Integration Test
// Tests complete flow: MQTT → Parser → Normalizer → StorageService

const Logger = require('../src/core/Logger');
const EventBus = require('../src/core/EventBus');
const Database = require('../src/core/Database');
const MqttService = require('../src/modules/mqtt-ingress/MqttService');
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');
const UnifyNormalizer = require('../src/modules/normalizer/UnifyNormalizer');
const StorageService = require('../src/modules/storage/StorageService');

class E2EFlowTest {
  constructor() {
    this.logger = Logger;
    this.eventBus = EventBus;
    this.database = Database;
    this.mqttService = new MqttService();
    this.v5008Parser = new V5008Parser();
    this.v6800Parser = new V6800Parser();
    this.normalizer = new UnifyNormalizer();
    this.storageService = new StorageService();
    this.isRunning = false;
  }

  /**
   * Initialize all services for end-to-end testing
   */
  async initialize() {
    try {
      this.logger.info('E2EFlowTest: Initializing services...');
      
      // Start database (mock connection for testing)
      await this.database.connect({
        host: 'localhost',
        port: 3306,
        database: 'iot_middleware',
        username: 'root',
        password: 'Abc#!Dale123'
      });
      
      // Start storage service
      await this.storageService.start();
      
      // Start MQTT service (without actual connection)
      // Note: In real environment, this would connect to actual MQTT broker
      
      this.isRunning = true;
      this.logger.info('E2EFlowTest: All services initialized successfully');
    } catch (error) {
      this.logger.error('E2EFlowTest: Failed to initialize', { error: error.message });
      throw error;
    }
  }

  /**
   * Simulate incoming MQTT message (V5008 Heartbeat)
   */
  simulateV5008Heartbeat() {
    const topic = "V5008Upload/2437871205/OpeAck";
    const hexMessage = "CC01EC3737BF060000000000000000000000000000F200168F";
    const messageBuffer = Buffer.from(hexMessage, "hex");
    
    this.logger.info('E2EFlowTest: Simulating V5008 Heartbeat message', { topic });
    
    // Emit MQTT message event
    this.eventBus.emit('mqtt.message', {
      topic,
      message: messageBuffer
    });
  }

  /**
   * Run the complete end-to-end test
   */
  async runTest() {
    try {
      await this.initialize();
      
      // Set up event listeners for the test
      let normalizedDataReceived = false;
      let storageBatchCompleted = false;
      
      // Listen for normalized data
      this.eventBus.on('data.normalized', (data) => {
        normalizedDataReceived = true;
        this.logger.info('E2EFlowTest: Received normalized data', {
          itemCount: data.length,
          types: data.map(item => item.type)
        });
      });
      
      // Listen for storage completion
      this.eventBus.on('storage.batch.completed', () => {
        storageBatchCompleted = true;
        this.logger.info('E2EFlowTest: Storage batch completed');
      });
      
      // Listen for MQTT messages
      this.eventBus.on('mqtt.message', async (mqttData) => {
        this.logger.info('E2EFlowTest: Received MQTT message', { 
          topic: mqttData.topic 
        });
        
        // Parse the message
        let parsedData;
        if (mqttData.topic.includes('V5008')) {
          parsedData = this.v5008Parser.parse(mqttData.topic, mqttData.message);
        } else if (mqttData.topic.includes('V6800')) {
          parsedData = this.v6800Parser.parse(mqttData.topic, mqttData.message);
        }
        
        if (parsedData) {
          // Normalize the parsed data
          const normalizedData = await this.normalizer.normalize(parsedData);
          
          this.logger.info('E2EFlowTest: Normalized data', { 
            count: normalizedData.length,
            types: normalizedData.map(item => item.type)
          });
          
          // Emit normalized data event
          this.eventBus.emit('data.normalized', normalizedData);
        }
      });
      
      // Simulate a V5008 heartbeat message after a short delay
      setTimeout(() => {
        this.simulateV5008Heartbeat();
      }, 100);
      
      // Wait for processing to complete
      const checkCompletion = () => {
        if (normalizedDataReceived && storageBatchCompleted) {
          this.logger.info('E2EFlowTest: ✅ Pipeline Success - E2E Flow Complete');
          return true;
        }
        return false;
      };
      
      // Wait up to 5 seconds for completion
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts && !checkCompletion()) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!checkCompletion()) {
        this.logger.error('E2EFlowTest: ❌ Pipeline Failed - Timeout waiting for completion');
        process.exit(1);
      }
      
      this.logger.info('E2EFlowTest: Test completed successfully');
      
    } catch (error) {
      this.logger.error('E2EFlowTest: Test failed', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.isRunning) {
        await this.storageService.stop();
        await this.database.disconnect();
        this.isRunning = false;
        this.logger.info('E2EFlowTest: Services stopped');
      }
    } catch (error) {
      this.logger.error('E2EFlowTest: Error during cleanup', { error: error.message });
    }
  }
}

// Main execution
async function main() {
  const test = new E2EFlowTest();
  
  try {
    await test.runTest();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await test.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, cleaning up...');
  const test = new E2EFlowTest();
  await test.cleanup();
  process.exit(0);
});

// Run the test
main();