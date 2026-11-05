#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs
cd "$D"

# Create a small script to generate token and test
cat << 'EOF' > test_endpoints.js
const jwt = require('./src/utils/jwt');
const http = require('http');

// Generate an admin token
const token = jwt.generateAccessToken({ userId: 1, email: 'stumpix@admin.com', role: 'super_admin' });
console.log('Generated Admin Token:', token ? 'YES' : 'NO');

// Generate a player token to test access rejection
const playerToken = jwt.generateAccessToken({ userId: 2, email: 'player@example.com', role: 'player' });

async function run() {
  const aiConfig = require('./src/services/ai-config.service');

  console.log('\n--- 1. Testing getForAdmin() ---');
  const adminConfig = await aiConfig.getForAdmin();
  console.log('AI Config for Admin:', JSON.stringify(adminConfig, null, 2));

  console.log('\n--- 2. Testing testConnection() with Gemini ---');
  const testRes = await aiConfig.testConnection({});
  console.log('Gemini Test Result:', JSON.stringify(testRes, null, 2));

  console.log('\n--- 3. Testing handleChat() as Super Admin ---');
  const chatAdmin = await aiConfig.handleChat(
    { userId: 1, email: 'stumpix@admin.com', role: 'super_admin' },
    { message: 'What is the current status of the tournament? Give me a 1-sentence answer.' }
  );
  console.log('Chat as Admin Result:', JSON.stringify(chatAdmin, null, 2));

  console.log('\n--- 4. Testing handleChat() as Player (Should be FORBIDDEN) ---');
  const chatPlayer = await aiConfig.handleChat(
    { userId: 2, email: 'player@example.com', role: 'player' },
    { message: 'Hi' }
  );
  console.log('Chat as Player Result (Expected Forbidden):', JSON.stringify(chatPlayer, null, 2));
}

run().catch(err => console.error('Test script error:', err));
EOF

# Find node binary to run test_endpoints.js
NODE_BIN=$(find /opt -name "node" 2>/dev/null | grep -E "bin/node$" | head -n 1)
if [ -n "$NODE_BIN" ]; then
  "$NODE_BIN" test_endpoints.js
else
  node test_endpoints.js 2>/dev/null || echo "No node binary found"
fi
rm -f test_endpoints.js
