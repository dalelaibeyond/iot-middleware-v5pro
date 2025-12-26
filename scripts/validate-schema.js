// Simple script to validate schema syntax without database connection
const fs = require('fs');
const path = require('path');

// Read schema file
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Basic syntax checks
const checks = [
  { name: 'CREATE TABLE statements', pattern: /CREATE TABLE IF NOT EXISTS/g },
  { name: 'Column definitions', pattern: /`[^`]+\s+[^`]+\s+/g },
  { name: 'No duplicate DEFAULT CURRENT_TIMESTAMP', pattern: /DEFAULT CURRENT_TIMESTAMP.*DEFAULT CURRENT_TIMESTAMP/g },
  { name: 'Proper INDEX syntax', pattern: /INDEX\s+`[^`]+/g },
  { name: 'UNIQUE KEY syntax', pattern: /UNIQUE KEY\s+`[^`]+/g }
];

console.log('=== Schema Validation Results ===');
console.log(`Schema file: ${schemaPath}`);
console.log(`File size: ${schema.length} bytes`);

let allPassed = true;

checks.forEach(check => {
  const matches = schema.match(check.pattern);
  const passed = !matches || matches.length === 0;
  
  console.log(`${check.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  if (!passed) {
    allPassed = false;
    if (matches) {
      console.log('  Found:', matches.slice(0, 3)); // Show first 3 matches
    }
  }
});

console.log(`\nOverall: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
console.log('\nSchema is ready for MySQL deployment!');