const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const fetch = require('node-fetch');
require('dotenv').config({ path: './backend/.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC: Google Calendar Integration ---');
  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email: 'admin@admin.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User:', user);

  // 2. Print ExternalCalendar record
  const calendar = await prisma.externalCalendar.findFirst({
    where: { user_id: user.id, provider: 'google' },
  });
  if (!calendar) {
    console.log('No Google Calendar integration found for this user.');
    return;
  }
  console.log('ExternalCalendar record:', calendar);

  // 3. Check if the access token is valid
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: calendar.access_token,
    refresh_token: calendar.refresh_token,
  });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  try {
    const userInfo = await oauth2.userinfo.get();
    console.log('Access token is valid. User info:', userInfo.data);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('Access token is invalid or expired. Attempting to refresh...');
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log('Successfully refreshed access token:', credentials.access_token);
      } catch (refreshErr) {
        console.log('Failed to refresh access token:', refreshErr.message);
      }
    } else {
      console.log('Error checking access token:', err.message);
    }
  }

  // 4. Call /api/integrations/google/status with a valid JWT
  // Get a JWT for the user
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '10m' });
  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiUrl}/integrations/google/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log('API /integrations/google/status response:', data);
  } catch (e) {
    console.log('Error calling /integrations/google/status:', e.message);
  }

  await prisma.$disconnect();
}

main(); 