const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkBuffers() {
  try {
    console.log('=== Checking Buffer Settings and Bookings ===\n');
    
    // Get the event type
    const eventType = await prisma.eventType.findUnique({
      where: { slug: 'event-name' }
    });
    
    console.log('Event Type Settings:');
    console.log('  Duration:', eventType.duration, 'minutes');
    console.log('  Buffer Before:', eventType.buffer_before, 'minutes');
    console.log('  Buffer After:', eventType.buffer_after, 'minutes');
    console.log('  Advance Notice:', eventType.advance_notice, 'minutes');
    console.log('  Slot Interval:', eventType.slot_interval, 'minutes');
    
    // Get all bookings for this event type
    const bookings = await prisma.booking.findMany({
      where: { event_type_id: eventType.id },
      orderBy: { starts_at: 'asc' }
    });
    
    console.log('\nExisting Bookings:');
    if (bookings.length === 0) {
      console.log('  No bookings found');
    } else {
      bookings.forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.starts_at.toISOString()} - ${booking.ends_at.toISOString()}`);
        console.log(`     Name: ${booking.name}, Email: ${booking.email}`);
      });
    }
    
    // Check availability rules
    const availabilityRules = await prisma.availabilityRule.findMany({
      where: { user_id: eventType.user_id }
    });
    
    console.log('\nAvailability Rules:');
    if (availabilityRules.length === 0) {
      console.log('  No availability rules found (using default 9 AM - 5 PM)');
    } else {
      availabilityRules.forEach(rule => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const startHour = Math.floor(rule.start_minute / 60);
        const startMin = rule.start_minute % 60;
        const endHour = Math.floor(rule.end_minute / 60);
        const endMin = rule.end_minute % 60;
        console.log(`  ${dayNames[rule.day_of_week]}: ${startHour}:${startMin.toString().padStart(2, '0')} - ${endHour}:${endMin.toString().padStart(2, '0')}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBuffers(); 