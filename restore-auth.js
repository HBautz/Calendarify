#!/usr/bin/env node

// Script to restore JWT Bearer token authentication to ALL API calls
// This fixes the 401 Unauthorized errors

const fs = require('fs');

const filePath = '/Users/heinebautz/portfolio-github/Calendarify/dashboard/editor/index.html';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Function to add authentication to a fetch call
function addAuthToFetch(fetchCall) {
  // Check if it already has Authorization header
  if (fetchCall.includes('Authorization:')) {
    return fetchCall;
  }
  
  // Add authentication
  return fetchCall.replace(
    /(const res = await fetch\(`\$\{API_URL\}\/([^`]+)`(?:,\s*\{[^}]*\})?\);)/g,
    (match, fullMatch, endpoint) => {
      // Check if it's a simple GET request
      if (match.includes('headers:') && match.includes('Authorization:')) {
        return match; // Already has auth
      }
      
      if (match.includes('method:') || match.includes('headers:')) {
        // Complex request with method/headers
        return match.replace(
          /headers:\s*\{([^}]*)\}/,
          (headerMatch, headerContent) => {
            if (headerContent.includes('Authorization:')) {
              return headerMatch; // Already has auth
            }
            return `headers: { ${headerContent.trim() ? headerContent + ', ' : ''}Authorization: \`Bearer \${clean}\` }`;
          }
        );
      } else {
        // Simple GET request
        return match.replace(
          /(const res = await fetch\(`\$\{API_URL\}\/[^`]+`\));/,
          '$1, { headers: { Authorization: `Bearer ${clean}` } });'
        );
      }
    }
  );
}

// Find all fetch calls that need authentication
const fetchPattern = /const\s+res\s*=\s*await\s+fetch\(`\$\{API_URL\}\/[^`]+`[^;]*\);/g;
const matches = content.match(fetchPattern);

if (matches) {
  console.log(`Found ${matches.length} fetch calls that may need authentication`);
  
  // Process each match
  matches.forEach(match => {
    if (!match.includes('Authorization:')) {
      console.log('Adding authentication to:', match.substring(0, 50) + '...');
    }
  });
}

// More targeted approach - fix specific patterns
const patterns = [
  // Pattern 1: Simple fetch calls
  {
    from: /const res = await fetch\(`\$\{API_URL\}\/([^`]+)`\);/g,
    to: 'const res = await fetch(`${API_URL}/$1`, { headers: { Authorization: `Bearer ${clean}` } });'
  },
  
  // Pattern 2: Fetch calls with method but no auth
  {
    from: /const res = await fetch\(`\$\{API_URL\}\/([^`]+)`,\s*\{\s*method:\s*'([^']+)'\s*\}\);/g,
    to: 'const res = await fetch(`${API_URL}/$1`, { method: \'$2\', headers: { Authorization: `Bearer ${clean}` } });'
  },
  
  // Pattern 3: Fetch calls with Content-Type but no auth
  {
    from: /headers:\s*\{\s*'Content-Type':\s*'application/json'\s*\}/g,
    to: 'headers: { \'Content-Type\': \'application/json\', Authorization: `Bearer ${clean}` }'
  }
];

// Apply patterns
patterns.forEach(pattern => {
  content = content.replace(pattern.from, pattern.to);
});

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Authentication restored to API calls');
console.log('Please test the event types dropdown now');
