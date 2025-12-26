/**
 * Test script to verify configuration loading and environment variable prioritization
 * Ensures that process.env variables have highest priority over config files
 */

const fs = require('fs');
const path = require('path');

console.log('=== Configuration Loading Security Audit ===\n');

// Test 1: Verify no hardcoded passwords in config files
console.log('Test 1: Check for Hardcoded Passwords in Config Files');
const configDir = path.join(__dirname, '..', 'config');
const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));

let hasHardcodedPasswords = false;
for (const file of configFiles) {
  const filePath = path.join(configDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip empty files
  if (!content.trim()) {
    console.log(`\nSkipping ${file}: file is empty`);
    continue;
  }
  
  const config = JSON.parse(content);
  
  console.log(`\nChecking ${file}:`);
  
  // Check database password
  if (config.database && config.database.password && config.database.password !== '') {
    console.log(`  ⚠️  Database password is NOT empty: "${config.database.password}"`);
    hasHardcodedPasswords = true;
  } else {
    console.log(`  ✓ Database password is empty or not present`);
  }
  
  // Check MQTT password
  if (config.mqtt && config.mqtt.password && config.mqtt.password !== '') {
    console.log(`  ⚠️  MQTT password is NOT empty: "${config.mqtt.password}"`);
    hasHardcodedPasswords = true;
  } else {
    console.log(`  ✓ MQTT password is empty or not present`);
  }
}

if (!hasHardcodedPasswords) {
  console.log('\n✓ Test 1 Passed: No hardcoded passwords found in config files');
} else {
  console.log('\n✗ Test 1 Failed: Hardcoded passwords detected!');
  process.exit(1);
}

// Test 2: Verify .env.example contains all necessary environment variables
console.log('\n\nTest 2: Verify .env.example Completeness');
const envExamplePath = path.join(__dirname, '..', '.env.example');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'MQTT_BROKER_URL',
  'MQTT_USERNAME',
  'MQTT_PASSWORD',
  'MQTT_CLIENT_ID',
  'MQTT_TOPICS',
  'API_PORT',
  'API_HOST',
  'WS_PORT',
  'NODE_ENV',
  'LOG_LEVEL'
];

let missingVars = [];
for (const envVar of requiredEnvVars) {
  if (!envExampleContent.includes(envVar + '=')) {
    missingVars.push(envVar);
  }
}

if (missingVars.length === 0) {
  console.log(`✓ All ${requiredEnvVars.length} required environment variables are documented in .env.example`);
} else {
  console.log(`✗ Missing environment variables in .env.example:`);
  missingVars.forEach(v => console.log(`  - ${v}`));
  process.exit(1);
}

// Test 3: Verify .gitignore excludes .env
console.log('\n\nTest 3: Verify .gitignore Configuration');
const gitignorePath = path.join(__dirname, '..', '.gitignore');
let gitignoreContent = '';
if (fs.existsSync(gitignorePath)) {
  gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
}

if (gitignoreContent.includes('.env')) {
  console.log('✓ .env is excluded from version control in .gitignore');
} else {
  console.log('⚠️  Warning: .env is NOT in .gitignore');
  console.log('  Recommendation: Add ".env" to .gitignore to prevent committing secrets');
}

// Test 4: Verify process.env prioritization in app.js
console.log('\n\nTest 4: Verify Environment Variable Prioritization Logic');
const appJsPath = path.join(__dirname, '..', 'src', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const checks = {
  dbHost: appJsContent.includes('process.env.DB_HOST'),
  dbPort: appJsContent.includes('process.env.DB_PORT'),
  dbName: appJsContent.includes('process.env.DB_NAME'),
  dbUser: appJsContent.includes('process.env.DB_USER'),
  dbPassword: appJsContent.includes('process.env.DB_PASSWORD'),
  mqttBrokerUrl: appJsContent.includes('process.env.MQTT_BROKER_URL'),
  mqttUsername: appJsContent.includes('process.env.MQTT_USERNAME'),
  mqttPassword: appJsContent.includes('process.env.MQTT_PASSWORD'),
  mqttClientId: appJsContent.includes('process.env.MQTT_CLIENT_ID'),
  mqttTopics: appJsContent.includes('process.env.MQTT_TOPICS'),
  apiPort: appJsContent.includes('process.env.API_PORT'),
  apiHost: appJsContent.includes('process.env.API_HOST')
};

let allChecksPassed = true;
for (const [check, passed] of Object.entries(checks)) {
  if (passed) {
    console.log(`  ✓ ${check}: process.env check present`);
  } else {
    console.log(`  ✗ ${check}: process.env check missing`);
    allChecksPassed = false;
  }
}

if (allChecksPassed) {
  console.log('\n✓ Test 4 Passed: All environment variables are properly checked');
} else {
  console.log('\n✗ Test 4 Failed: Some environment variable checks are missing');
  process.exit(1);
}

// Test 5: Verify no hardcoded password fallback in app.js
console.log('\n\nTest 5: Verify No Hardcoded Password Fallback in app.js');
const hardcodedPasswordPattern = /password.*:\s*["'].*[^"']["']/;
const hasHardcodedFallback = hardcodedPasswordPattern.test(appJsContent);

if (!hasHardcodedFallback) {
  console.log('✓ Test 5 Passed: No hardcoded password fallback found in app.js');
} else {
  console.log('✗ Test 5 Failed: Hardcoded password fallback detected in app.js');
  console.log('  This is a security vulnerability - passwords should only come from env vars');
  process.exit(1);
}

// Test 6: Verify environment variable override order
console.log('\n\nTest 6: Verify Configuration Priority Order');
const priorityPattern = /process\.env\.\w+\s*\|\|/;
const hasPriorityLogic = priorityPattern.test(appJsContent);

if (hasPriorityLogic) {
  console.log('✓ Test 6 Passed: Environment variables have highest priority (process.env || config)');
} else {
  console.log('✗ Test 6 Failed: Environment variable priority not properly implemented');
  process.exit(1);
}

// Summary
console.log('\n\n=== Security Audit Summary ===');
console.log('✓ All tests passed!');
console.log('\nConfiguration loading is secure:');
console.log('  1. No hardcoded passwords in config files');
console.log('  2. All necessary environment variables documented in .env.example');
console.log('  3. Environment variables have highest priority');
console.log('  4. No fallback to hardcoded passwords');
console.log('\nBest Practices:');
console.log('  - Use environment-specific .env files (.env.development, .env.production)');
console.log('  - Never commit .env files to version control');
console.log('  - Use secrets management services in production');
console.log('  - Rotate secrets regularly');
