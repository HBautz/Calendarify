#!/usr/bin/env node

// Script to restore JWT Bearer token authentication to all API calls
// This is needed because the backend expects JWT Bearer tokens, not session cookies

const fs = require('fs');
const path = require('path');

const filePath = '/Users/heinebautz/portfolio-github/Calendarify/dashboard/editor/index.html';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Patterns to replace
const replacements = [
  // Pattern 1: Simple fetch calls without headers
  {
    from: /\/\/ Authentication handled via server-side session cookies\n\s*const res = await fetch\(`\$\{API_URL\}\/([^`]+)`\);/g,
    to: (match, endpoint) => {
      return `const token = getAnyToken();
        if (!token) return;
        
        const clean = token.replace(/^"|"$/g, '');
        const res = await fetch(\`\${API_URL}/${endpoint}\`, { 
          headers: { Authorization: \`Bearer \${clean}\` } 
        });`;
    }
  },
  
  // Pattern 2: Fetch calls with method but no auth
  {
    from: /\/\/ Authentication handled via server-side session cookies\n\s*const res = await fetch\(`\$\{API_URL\}\/([^`]+)`,\s*\{\s*method:\s*'([^']+)'\s*\}\);/g,
    to: (match, endpoint, method) => {
      return `const token = getAnyToken();
        if (!token) return;
        
        const clean = token.replace(/^"|"$/g, '');
        const res = await fetch(\`\${API_URL}/${endpoint}\`, { 
          method: '${method}',
          headers: { Authorization: \`Bearer \${clean}\` } 
        });`;
    }
  },
  
  // Pattern 3: Fetch calls with headers but no auth
  {
    from: /\/\/ Authentication handled via server-side session cookies\n\s*const res = await fetch\(`\$\{API_URL\}\/([^`]+)`,\s*\{\s*method:\s*'([^']+)',\s*headers:\s*\{\s*'Content-Type':\s*'application/json'\s*\}\s*,\s*body:\s*([^}]+)\s*\}\);/g,
    to: (match, endpoint, method, body) => {
      return `const token = getAnyToken();
        if (!token) return;
        
        const clean = token.replace(/^"|"$/g, '');
        const res = await fetch(\`\${API_URL}/${endpoint}\`, { 
          method: '${method}',
          headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${clean}\` },
          body: ${body}
        });`;
    }
  }
];

// Apply replacements
replacements.forEach(replacement => {
  content = content.replace(replacement.from, replacement.to);
});

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Authentication restored to all API calls');
