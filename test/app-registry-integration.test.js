/**
 * Test script to verify app.js refactoring with ParserRegistry
 * Tests that the app correctly uses the ParserRegistry to get parsers
 */

const IoTMiddlewareApp = require('../src/app');

console.log('=== App.js ParserRegistry Integration Test ===\n');

// Create app instance
const app = new IoTMiddlewareApp();

// Test 1: Verify parserRegistry is initialized
console.log('Test 1: ParserRegistry Initialization');
console.log('parserRegistry exists:', app.parserRegistry !== null && app.parserRegistry !== undefined);
console.log('parserRegistry type:', app.parserRegistry.constructor.name);
console.log('Expected: ParserRegistry');
console.log(app.parserRegistry && app.parserRegistry.constructor.name === 'ParserRegistry' ? '✓ Passed' : '✗ Failed');
console.log();

// Test 2: Verify registered parsers
console.log('Test 2: Registered Parsers in App');
console.log('Number of parsers:', app.parserRegistry.getParserCount());
console.log('Parser names:', app.parserRegistry.getRegisteredParsers().map(p => p.name));
console.log('Expected: 2 parsers (V5008Parser, V6800Parser)');
console.log(app.parserRegistry.getParserCount() === 2 ? '✓ Passed' : '✗ Failed');
console.log();

// Test 3: Verify getParser works for V5008
console.log('Test 3: Get V5008 Parser via App Registry');
const v5008Topic = 'V5008Upload/2437871205/OpeAck';
const v5008Parser = app.parserRegistry.getParser(v5008Topic);
console.log('Topic:', v5008Topic);
console.log('Parser found:', v5008Parser ? v5008Parser.constructor.name : 'null');
console.log('Expected: V5008Parser');
console.log(v5008Parser && v5008Parser.constructor.name === 'V5008Parser' ? '✓ Passed' : '✗ Failed');
console.log();

// Test 4: Verify getParser works for V6800
console.log('Test 4: Get V6800 Parser via App Registry');
const v6800Topic = 'V6800Upload/2123456789/HeartBeat';
const v6800Parser = app.parserRegistry.getParser(v6800Topic);
console.log('Topic:', v6800Topic);
console.log('Parser found:', v6800Parser ? v6800Parser.constructor.name : 'null');
console.log('Expected: V6800Parser');
console.log(v6800Parser && v6800Parser.constructor.name === 'V6800Parser' ? '✓ Passed' : '✗ Failed');
console.log();

// Test 5: Verify unknown topic returns null
console.log('Test 5: Unknown Topic Returns Null');
const unknownTopic = 'UnknownDevice/12345/Test';
const unknownParser = app.parserRegistry.getParser(unknownTopic);
console.log('Topic:', unknownTopic);
console.log('Parser found:', unknownParser ? unknownParser.constructor.name : 'null');
console.log('Expected: null');
console.log(unknownParser === null ? '✓ Passed' : '✗ Failed');
console.log();

console.log('=== All Tests Complete ===');
console.log('\nRefactoring Summary:');
console.log('- app.js now uses ParserRegistry instead of hardcoded if/else logic');
console.log('- App is completely agnostic of device types');
console.log('- New parsers can be added without modifying app.js');
