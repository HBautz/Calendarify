const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@admin.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  const calendar = await prisma.externalCalendar.findFirst({
    where: { user_id: user.id, provider: 'google' },
  });
  if (!calendar) {
    console.log('No Google Calendar integration found for this user.');
    return;
  }
  console.log('Google Calendar tokens for admin@admin.com:');
  console.log('Access Token:', calendar.access_token);
  console.log('Refresh Token:', calendar.refresh_token);

  // Check if the access token is valid
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

  await prisma.$disconnect();
}

main(); 