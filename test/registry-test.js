/**
 * ParserRegistry Test
 * 
 * This test verifies the ParserRegistry component functionality:
 * 1. Proper instantiation of ParserRegistry
 * 2. Topic matching for V5008 and V6800 parsers
 * 3. Handling of unknown topics
 * 
 * Usage: node test/registry-test.js
 */

const Logger = require('../src/core/Logger');
const ParserRegistry = require('../src/modules/normalizer/ParserRegistry');
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');

class RegistryTest {
  constructor() {
    this.logger = Logger;
    this.registry = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Initialize the test suite
   */
  async initialize() {
    try {
      this.logger.info('RegistryTest: Initializing test suite...');
      
      // Instantiate ParserRegistry
      this.registry = new ParserRegistry();
      
      this.logger.info('RegistryTest: ParserRegistry instantiated successfully', {
        parserCount: this.registry.getParserCount(),
        registeredParsers: this.registry.getRegisteredParsers().map(p => p.name)
      });
      
    } catch (error) {
      this.logger.error('RegistryTest: Failed to initialize', { error: error.message });
      throw error;
    }
  }

  /**
   * Assert that a value is truthy
   * @param {*} value - Value to test
   * @param {string} testName - Name of test
   * @param {string} message - Success message
   */
  assert(value, testName, message) {
    if (value) {
      this.testResults.passed++;
      this.testResults.tests.push({
        name: testName,
        status: 'PASSED',
        message
      });
      this.logger.info(`✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({
        name: testName,
        status: 'FAILED',
        message: 'Assertion failed'
      });
      this.logger.warn(`❌ ${testName}: Assertion failed`);
    }
  }

  /**
   * Assert that a value is null
   * @param {*} value - Value to test
   * @param {string} testName - Name of test
   * @param {string} message - Success message
   */
  assertNull(value, testName, message) {
    if (value === null) {
      this.testResults.passed++;
      this.testResults.tests.push({
        name: testName,
        status: 'PASSED',
        message
      });
      this.logger.info(`✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Expected null, got ${typeof value}`
      });
      this.logger.warn(`❌ ${testName}: Expected null, got ${typeof value}`);
    }
  }

  /**
   * Assert that a value is an instance of a class
   * @param {*} value - Value to test
   * @param {Function} Class - Expected class
   * @param {string} testName - Name of test
   * @param {string} message - Success message
   */
  assertInstanceOf(value, Class, testName, message) {
    if (value instanceof Class) {
      this.testResults.passed++;
      this.testResults.tests.push({
        name: testName,
        status: 'PASSED',
        message
      });
      this.logger.info(`✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Expected instance of ${Class.name}, got ${value?.constructor?.name || typeof value}`
      });
      this.logger.warn(`❌ ${testName}: Expected instance of ${Class.name}, got ${value?.constructor?.name || typeof value}`);
    }
  }

  /**
   * Test 1: Verify ParserRegistry instantiation
   */
  testInstantiation() {
    this.logger.info('RegistryTest: Running Test 1 - ParserRegistry Instantiation');
    
    // Test that registry is not null
    this.assert(
      this.registry !== null,
      'Test 1.1',
      'ParserRegistry is instantiated'
    );
    
    // Test that registry has parsers registered
    this.assert(
      this.registry.getParserCount() > 0,
      'Test 1.2',
      `ParserRegistry has ${this.registry.getParserCount()} parsers registered`
    );
    
    // Test that V5008Parser is registered
    this.assert(
      this.registry.hasParser(V5008Parser),
      'Test 1.3',
      'V5008Parser is registered'
    );
    
    // Test that V6800Parser is registered
    this.assert(
      this.registry.hasParser(V6800Parser),
      'Test 1.4',
      'V6800Parser is registered'
    );
  }

  /**
   * Test 2: Verify V5008 topic matching
   */
  testV5008TopicMatching() {
    this.logger.info('RegistryTest: Running Test 2 - V5008 Topic Matching');
    
    const v5008Topics = [
      'V5008Upload/123/OpeAck',
      'V5008Upload/2437871205/HeartBeat',
      'V5008Upload/999/Data',
      'V5008Upload/1/AnyMessage'
    ];
    
    v5008Topics.forEach((topic, index) => {
      const parser = this.registry.getParser(topic);
      
      this.assert(
        parser !== null,
        `Test 2.${index + 1}.1`,
        `Parser found for topic: ${topic}`
      );
      
      // Direct instance check instead of using helper method
      if (parser instanceof V5008Parser) {
        this.testResults.passed++;
        this.testResults.tests.push({
          name: `Test 2.${index + 1}.2`,
          status: 'PASSED',
          message: `Parser is instance of V5008Parser for topic: ${topic}`
        });
        this.logger.info(`✅ Test 2.${index + 1}.2: Parser is instance of V5008Parser for topic: ${topic}`);
      } else {
        this.testResults.failed++;
        this.testResults.tests.push({
          name: `Test 2.${index + 1}.2`,
          status: 'FAILED',
          message: `Expected instance of V5008Parser, got ${parser?.constructor?.name || typeof parser}`
        });
        this.logger.warn(`❌ Test 2.${index + 1}.2: Expected instance of V5008Parser, got ${parser?.constructor?.name || typeof parser}`);
      }
    });
  }

  /**
   * Test 3: Verify V6800 topic matching
   */
  testV6800TopicMatching() {
    this.logger.info('RegistryTest: Running Test 3 - V6800 Topic Matching');
    
    const v6800Topics = [
      'V6800Upload/123/HeartBeat',
      'V6800Upload/456/Status',
      'V6800Upload/789/Data',
      'V6800Upload/1/AnyMessage'
    ];
    
    v6800Topics.forEach((topic, index) => {
      const parser = this.registry.getParser(topic);
      
      this.assert(
        parser !== null,
        `Test 3.${index + 1}.1`,
        `Parser found for topic: ${topic}`
      );
      
      // Direct instance check instead of using helper method
      if (parser instanceof V6800Parser) {
        this.testResults.passed++;
        this.testResults.tests.push({
          name: `Test 3.${index + 1}.2`,
          status: 'PASSED',
          message: `Parser is instance of V6800Parser for topic: ${topic}`
        });
        this.logger.info(`✅ Test 3.${index + 1}.2: Parser is instance of V6800Parser for topic: ${topic}`);
      } else {
        this.testResults.failed++;
        this.testResults.tests.push({
          name: `Test 3.${index + 1}.2`,
          status: 'FAILED',
          message: `Expected instance of V6800Parser, got ${parser?.constructor?.name || typeof parser}`
        });
        this.logger.warn(`❌ Test 3.${index + 1}.2: Expected instance of V6800Parser, got ${parser?.constructor?.name || typeof parser}`);
      }
    });
  }

  /**
   * Test 4: Verify unknown topic handling
   */
  testUnknownTopicHandling() {
    this.logger.info('RegistryTest: Running Test 4 - Unknown Topic Handling');
    
    const unknownTopics = [
      'Unknown/123',
      'InvalidTopic/456',
      'RandomDevice/789/Data',
      'SomeOtherDevice/1/Message'
    ];
    
    unknownTopics.forEach((topic, index) => {
      const parser = this.registry.getParser(topic);
      
      this.assertNull(
        parser,
        `Test 4.${index + 1}`,
        `Parser returns null for unknown topic: ${topic}`
      );
    });
  }

  /**
   * Test 5: Verify invalid input handling
   */
  testInvalidInputHandling() {
    this.logger.info('RegistryTest: Running Test 5 - Invalid Input Handling');
    
    const invalidInputs = [
      null,
      undefined,
      '',
      123,
      {},
      []
    ];
    
    invalidInputs.forEach((input, index) => {
      const parser = this.registry.getParser(input);
      
      this.assertNull(
        parser,
        `Test 5.${index + 1}`,
        `Parser returns null for invalid input: ${typeof input}`
      );
    });
  }

  /**
   * Test 6: Verify parser functionality
   */
  testParserFunctionality() {
    this.logger.info('RegistryTest: Running Test 6 - Parser Functionality');
    
    // Test V5008 parser functionality
    const v5008Parser = this.registry.getParser('V5008Upload/123/OpeAck');
    if (v5008Parser) {
      const testMessage = Buffer.from('CC01EC3737BF060000000000000000000000000000F200168F', 'hex');
      const parsed = v5008Parser.parse('V5008Upload/123/OpeAck', testMessage);
      
      this.assert(
        parsed !== null && parsed !== undefined,
        'Test 6.1',
        'V5008Parser successfully parsed test message'
      );
    }
    
    // Test V6800 parser functionality
    const v6800Parser = this.registry.getParser('V6800Upload/123/HeartBeat');
    if (v6800Parser) {
      // V6800Parser expects JSON string, not Buffer
      const testMessage = JSON.stringify({
        msg_type: 'HeartBeat',
        uuid_number: '123456789',
        bus_V: '12.5',
        bus_I: '1.2',
        main_power: true,
        backup_power: false,
        data: [
          {
            module_index: 0,
            module_sn: 'SN001',
            module_u_num: 5
          }
        ]
      });
      const parsed = v6800Parser.parse('V6800Upload/123/HeartBeat', testMessage);
      
      this.assert(
        parsed !== null && parsed !== undefined,
        'Test 6.2',
        'V6800Parser successfully parsed test message'
      );
    }
  }

  /**
   * Run all tests
   */
  async runTests() {
    try {
      await this.initialize();
      
      this.logger.info('RegistryTest: Starting test execution...\n');
      
      // Run all test suites
      this.testInstantiation();
      this.testV5008TopicMatching();
      this.testV6800TopicMatching();
      this.testUnknownTopicHandling();
      this.testInvalidInputHandling();
      this.testParserFunctionality();
      
      // Print test summary
      this.printTestSummary();
      
      // Exit with appropriate code
      if (this.testResults.failed === 0) {
        this.logger.info('\n✅ Registry Verification Passed');
        process.exit(0);
      } else {
        this.logger.error('\n❌ Registry Verification Failed');
        process.exit(1);
      }
      
    } catch (error) {
      this.logger.error('RegistryTest: Test execution failed', { 
        error: error.message,
        stack: error.stack 
      });
      console.error('\n=== ERROR DETAILS ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('=====================\n');
      process.exit(1);
    }
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    this.logger.info('\n========================================');
    this.logger.info('Registry Test Summary');
    this.logger.info('========================================');
    this.logger.info(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    this.logger.info(`✅ Passed: ${this.testResults.passed}`);
    this.logger.info(`❌ Failed: ${this.testResults.failed}`);
    this.logger.info(`Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(2)}%`);
    this.logger.info('========================================\n');
  }
}

// Main execution
async function main() {
  const test = new RegistryTest();
  
  try {
    await test.runTests();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, exiting...');
  process.exit(0);
});

// Run test
main();
