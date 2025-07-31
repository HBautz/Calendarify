const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function updateBuffer320h() {
  try {
    console.log('🔄 === UPDATING BUFFER TO 320 HOURS ===\n');
    
    // Update the event type with 320 hours buffer after
    const updatedEventType = await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: {
        buffer_after: 19200, // 320 hours = 19200 minutes
      }
    });
    
    console.log('✅ Updated Event Type Settings:');
    console.log('  Duration:', updatedEventType.duration, 'minutes');
    console.log('  Buffer Before:', updatedEventType.buffer_before, 'minutes');
    console.log('  Buffer After:', updatedEventType.buffer_after, 'minutes (320 hours)');
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
      
      // Check which days are affected
      const blockedStart = new Date(bufferBeforeStart);
      const blockedEnd = new Date(bufferAfterEnd);
      
      console.log('\n📅 Affected Days:');
      let currentDate = new Date(blockedStart);
      while (currentDate <= blockedEnd) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        console.log('  ❌', dayName);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    console.log('\n✅ Buffer updated to 320 hours successfully!');
    console.log('⚠️  This will block approximately 13+ days of availability!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBuffer320h(); 