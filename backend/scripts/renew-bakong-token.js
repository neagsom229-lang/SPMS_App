require('./_guard.js');
// backend/scripts/renew-bakong-token.js
const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter registered Bakong / Open API email: ', async (email) => {
  rl.close();
  if (!email || !email.includes('@')) {
    console.error('Invalid email provided.');
    process.exit(1);
  }

  try {
    const apiBase = process.env.BAKONG_API_BASE || 'https://api-bakong.nbc.gov.kh';
    const res = await axios.post(`${apiBase}/v1/renew_token`, { email }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.data && res.data.responseCode === 0 && res.data.data && res.data.data.token) {
      // Print new token to stdout only, write nothing to disk or logs
      console.log(res.data.data.token);
    } else {
      console.error('Failed to renew token:', res.data?.responseMessage || 'Unknown error');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error connecting to Bakong API for token renewal:', err.message);
    process.exit(1);
  }
});
