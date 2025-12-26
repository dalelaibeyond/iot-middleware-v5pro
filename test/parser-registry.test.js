/**
 * Test script for ParserRegistry
 * Verifies that the registry correctly identifies and returns parsers for different topics
 */

const ParserRegistry = require('../src/modules/normalizer/ParserRegistry');

// Create a new registry instance
const registry = new ParserRegistry();

console.log('=== ParserRegistry Test ===\n');

// Test 1: Check registered parsers
console.log('Test 1: Registered Parsers');
console.log('Number of registered parsers:', registry.getParserCount());
console.log('Parser names:', registry.getRegisteredParsers().map(p => p.name));
console.log('✓ Passed\n');

// Test 2: Get V5008 parser
console.log('Test 2: Get V5008 Parser');
const v5008Topic = 'V5008Upload/2437871205/OpeAck';
const v5008Parser = registry.getParser(v5008Topic);
console.log('Topic:', v5008Topic);
console.log('Parser found:', v5008Parser ? v5008Parser.constructor.name : 'null');
console.log('Expected: V5008Parser');
console.log(v5008Parser && v5008Parser.constructor.name === 'V5008Parser' ? '✓ Passed' : '✗ Failed');
console.log();

// Test 3: Get V6800 parser
console.log('Test 3: Get V6800 Parser');
const v6800Topic = 'V6800Upload/2123456789/HeartBeat';
const v6800Parser = registry.getParser(v6800Topic);
console.log('Topic:', v6800Topic);
console.log('Parser found:', v6800Parser ? v6800Parser.constructor.name : 'null');
console.log('Expected: V6800Parser');
console.log(v6800Parser && v6800Parser.constructor.name === 'V6800Parser' ? '✓ Passed' : '✗ Failed');
console.log();

// Test 4: Unknown topic
console.log('Test 4: Unknown Topic');
const unknownTopic = 'UnknownDevice/12345/Test';
const unknownParser = registry.getParser(unknownTopic);
console.log('Topic:', unknownTopic);
console.log('Parser found:', unknownParser ? unknownParser.constructor.name : 'null');
console.log('Expected: null');
console.log(unknownParser === null ? '✓ Passed' : '✗ Failed');
console.log();

// Test 5: Invalid topic
console.log('Test 5: Invalid Topic');
const invalidTopic = null;
const invalidParser = registry.getParser(invalidTopic);
console.log('Topic:', invalidTopic);
console.log('Parser found:', invalidParser ? invalidParser.constructor.name : 'null');
console.log('Expected: null');
console.log(invalidParser === null ? '✓ Passed' : '✗ Failed');
console.log();

// Test 6: Test V5008Parser.canHandle directly
console.log('Test 6: V5008Parser.canHandle Direct Test');
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');
console.log('V5008Parser.canHandle("V5008Upload/123/OpeAck"):', V5008Parser.canHandle('V5008Upload/123/OpeAck'));
console.log('V5008Parser.canHandle("V6800Upload/123/HeartBeat"):', V5008Parser.canHandle('V6800Upload/123/HeartBeat'));
console.log('✓ Passed\n');

// Test 7: Test V6800Parser.canHandle directly
console.log('Test 7: V6800Parser.canHandle Direct Test');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');
console.log('V6800Parser.canHandle("V6800Upload/123/HeartBeat"):', V6800Parser.canHandle('V6800Upload/123/HeartBeat'));
console.log('V6800Parser.canHandle("V5008Upload/123/OpeAck"):', V6800Parser.canHandle('V5008Upload/123/OpeAck'));
console.log('✓ Passed\n');

console.log('=== All Tests Complete ===');
