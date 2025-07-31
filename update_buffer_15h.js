const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function updateBuffer15h() {
  try {
    console.log('🔄 === UPDATING BUFFER TO 15 HOURS ===\n');
    
    // Update the event type with 15 hours buffer after
    const updatedEventType = await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: {
        buffer_after: 900, // 15 hours = 900 minutes
      }
    });
    
    console.log('✅ Updated Event Type Settings:');
    console.log('  Duration:', updatedEventType.duration, 'minutes');
    console.log('  Buffer Before:', updatedEventType.buffer_before, 'minutes');
    console.log('  Buffer After:', updatedEventType.buffer_after, 'minutes (15 hours)');
    console.log('  Advance Notice:', updatedEventType.advance_notice, 'minutes');
    
    // Calculate expected blocked period
    const booking = await prisma.booking.findFirst({
      where: { event_type_id: updatedEventType.id }
    });
    
    if (booking) {
      const bufferBeforeStart = new Date(booking.starts_at.getTime() - (updatedEventType.buffer_before * 60000));
      const bufferAfterEnd = new Date(booking.ends_at.getTime() + (updatedEventType.buffer_after * 60000));
      
      console.log('\n📅 Expected Blocked Period:');
      console.log('  Booking:', booking.starts_at.toISOString(), '-', booking.ends_at.toISOString());
      console.log('  Blocked:', bufferBeforeStart.toISOString(), '-', bufferAfterEnd.toISOString());
      console.log('  Total blocked duration:', (bufferAfterEnd.getTime() - bufferBeforeStart.getTime()) / 60000, 'minutes');
      
      // Check if entire day is blocked
      const dayStart = new Date(Date.UTC(2025, 7, 1, 9, 0, 0)); // 9 AM UTC
      const dayEnd = new Date(Date.UTC(2025, 7, 1, 17, 0, 0)); // 5 PM UTC
      
      if (bufferAfterEnd > dayEnd) {
        console.log('  ❌ Entire day blocked - no available slots');
      } else {
        console.log('  ✅ Available slots from:', bufferAfterEnd.toISOString(), 'to', dayEnd.toISOString());
      }
    }
    
    console.log('\n✅ Buffer updated to 15 hours successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBuffer15h(); 