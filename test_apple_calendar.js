const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAppleCalendarIntegration() {
  try {
    console.log('🔍 Testing Apple Calendar Integration...\n');

    // Get Apple Calendar data
    const appleCalendar = await prisma.externalCalendar.findFirst({
      where: { provider: 'apple' }
    });

    if (!appleCalendar) {
      console.log('❌ No Apple Calendar integration found');
      return;
    }

    console.log('📱 Apple Calendar Integration Found:');
    console.log(`   Email: ${appleCalendar.external_id}`);
    console.log(`   Has Password: ${appleCalendar.password ? 'Yes' : 'No'}`);
    console.log(`   Selected Calendar: ${appleCalendar.selected_calendar || 'Not set'}`);
    console.log(`   Access Token: ${appleCalendar.access_token ? 'Yes' : 'No'}`);
    console.log('');

    // Get recent bookings with email
    const recentBookings = await prisma.booking.findMany({
      where: {
        email: { not: null },
        email: { not: '' }
      },
      include: {
        event_type: true
      },
      orderBy: { created_at: 'desc' },
      take: 3
    });

    console.log('📅 Recent Bookings with Email:');
    recentBookings.forEach((booking, index) => {
      console.log(`   ${index + 1}. ${booking.name} (${booking.email})`);
      console.log(`      Event: ${booking.event_type.title}`);
      console.log(`      Date: ${booking.starts_at}`);
      console.log(`      Created: ${booking.created_at}`);
      console.log('');
    });

    // Test iCalendar generation
    if (recentBookings.length > 0) {
      const testBooking = recentBookings[0];
      console.log('🧪 Testing iCalendar Generation:');
      
      const eventData = {
        summary: `${testBooking.event_type.title} with ${testBooking.name}`,
        description: `Meeting with ${testBooking.name} (${testBooking.email})\n\nEvent Type: ${testBooking.event_type.title}`,
        start: {
          dateTime: testBooking.starts_at.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(testBooking.starts_at.getTime() + (testBooking.event_type.duration * 60000)).toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          { email: testBooking.email, displayName: testBooking.name }
        ],
      };

      const icsEvent = createICSEvent(eventData);
      console.log('📄 Generated iCalendar Event:');
      console.log(icsEvent);
      console.log('');
    }

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function createICSEvent(eventData) {
  const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startDate = new Date(eventData.start.dateTime);
  const endDate = new Date(eventData.end.dateTime);
  
  // Format dates for iCalendar
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendarify//Calendar Integration//EN',
    'BEGIN:VEVENT',
    `UID:${eventId}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${eventData.summary}`,
    `DESCRIPTION:${eventData.description.replace(/\n/g, '\\n')}`,
    ...(eventData.attendees ? eventData.attendees.map((attendee) => 
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${attendee.displayName}:mailto:${attendee.email}`
    ) : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return ics;
}

testAppleCalendarIntegration();
