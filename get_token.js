const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔑 Token Helper for Testing API');
console.log('================================');
console.log('');

rl.question('Enter your email: ', (email) => {
  rl.question('Enter your password: ', async (password) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('');
        console.log('✅ Login successful!');
        console.log('');
        console.log('🔑 Your token:');
        console.log(data.token);
        console.log('');
        console.log('📋 Example curl commands:');
        console.log('');
        console.log('# Get current availability:');
        console.log(`curl -H "Authorization: Bearer ${data.token}" http://localhost:3001/api/testing/availability`);
        console.log('');
        console.log('# Update Monday availability to 09:00-17:00:');
        console.log(`curl -X POST -H "Authorization: Bearer ${data.token}" -H "Content-Type: application/json" -d '{"day":"monday","start_time":"09:00","end_time":"17:00"}' http://localhost:3001/api/testing/availability`);
        console.log('');
        console.log('# Get debug info:');
        console.log(`curl -H "Authorization: Bearer ${data.token}" http://localhost:3001/api/testing/debug-info`);
        console.log('');
        console.log('# Test timezone conversion:');
        console.log(`curl -H "Authorization: Bearer ${data.token}" -H "Content-Type: application/json" -d '{"local_time":"09:00","timezone_offset":-120}' http://localhost:3001/api/testing/timezone-test`);
        console.log('');
      } else {
        console.log('❌ Login failed. Check your credentials.');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    } finally {
      rl.close();
    }
  });
}); 