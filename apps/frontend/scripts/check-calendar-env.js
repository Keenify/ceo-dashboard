#!/usr/bin/env node

/**
 * This script checks the environment variables needed for Google Calendar integration
 * Run with: node scripts/check-calendar-env.js
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  console.log('Loaded environment from .env.local\n');
} catch (error) {
  console.log('Warning: Could not load .env.local file');
}

// Check for required environment variables
const requiredVars = [
  { name: 'NEXT_PUBLIC_GOOGLE_API_KEY', description: 'Required for FullCalendar to access Google Calendar API' },
  { name: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', description: 'Required for OAuth authentication with Google' },
  { name: 'NEXT_PUBLIC_BACKEND_URL', description: 'URL for your backend API', defaultValue: 'http://localhost:8000' },
  { name: 'NEXT_PUBLIC_SITE_URL', description: 'URL for your frontend site', defaultValue: 'http://localhost:3000' }
];

console.log('Google Calendar Environment Check\n');
console.log('=================================\n');

let missingVars = 0;

requiredVars.forEach(variable => {
  const value = process.env[variable.name];
  
  if (value) {
    const maskedValue = variable.name.includes('KEY') || variable.name.includes('ID') 
      ? `${value.substring(0, 5)}...${value.substring(value.length - 3)}` 
      : value;
      
    console.log(`✅ ${variable.name}: ${maskedValue}`);
  } else if (variable.defaultValue) {
    console.log(`⚠️  ${variable.name}: Not set (will use default: ${variable.defaultValue})`);
  } else {
    console.log(`❌ ${variable.name}: Not set (${variable.description})`);
    missingVars++;
  }
});

console.log('\n=================================\n');

if (missingVars > 0) {
  console.log(`${missingVars} required variables are missing. Please check your .env.local file.`);
  console.log('\nCreate or update your .env.local file with these variables:');
  
  console.log(`
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_API_KEY=your-google-api-key

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
`);
  
  console.log('How to get these values:');
  console.log('1. Go to Google Cloud Console (https://console.cloud.google.com/)');
  console.log('2. Create a project or select an existing one');
  console.log('3. Enable the Google Calendar API');
  console.log('4. Go to "Credentials" and create an API key and OAuth client ID');
  console.log('5. Copy these values to your .env.local file');
} else {
  console.log('All environment variables are set correctly! 🎉');
}

// Check if backend server is running
console.log('\nChecking if backend server is running...');
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const http = require('http');
const https = require('https');

const client = backendUrl.startsWith('https') ? https : http;

client.get(`${backendUrl}/health-check`, (res) => {
  if (res.statusCode === 200) {
    console.log(`✅ Backend server is running at ${backendUrl}`);
  } else {
    console.log(`⚠️  Backend server returned status code ${res.statusCode}`);
  }
}).on('error', (err) => {
  console.log(`❌ Could not connect to backend server at ${backendUrl}`);
  console.log('   Make sure your backend server is running and accessible');
}); 