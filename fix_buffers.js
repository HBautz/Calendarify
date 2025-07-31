const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function fixBuffers() {
  try {
    console.log('=== FIXING BUFFER SETTINGS ===\n');
    
    // Update the event type with correct buffer settings
    const updatedEventType = await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: {
        buffer_before: 120, // 2 hours before
        buffer_after: 60,   // 1 hour after (changed from 4 hours)
        advance_notice: 1440, // 1 day
      }
    });
    
    console.log('✅ Updated Event Type Settings:');
    console.log('  Duration:', updatedEventType.duration, 'minutes');
    console.log('  Buffer Before:', updatedEventType.buffer_before, 'minutes');
    console.log('  Buffer After:', updatedEventType.buffer_after, 'minutes');
    console.log('  Advance Notice:', updatedEventType.advance_notice, 'minutes');
    console.log('  Slot Interval:', updatedEventType.slot_interval, 'minutes');
    
    // Get all bookings to verify
    const bookings = await prisma.booking.findMany({
      where: { event_type_id: updatedEventType.id },
      orderBy: { starts_at: 'asc' }
    });
    
    console.log('\n📅 Existing Bookings:');
    if (bookings.length === 0) {
      console.log('  No bookings found');
    } else {
      bookings.forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.starts_at.toISOString()} - ${booking.ends_at.toISOString()}`);
        console.log(`     Name: ${booking.name}, Email: ${booking.email}`);
        
        // Calculate buffer periods
        const bufferBeforeStart = new Date(booking.starts_at.getTime() - (updatedEventType.buffer_before * 60000));
        const bufferAfterEnd = new Date(booking.ends_at.getTime() + (updatedEventType.buffer_after * 60000));
        
        console.log(`     Buffer Before: ${bufferBeforeStart.toISOString()} - ${booking.starts_at.toISOString()}`);
        console.log(`     Buffer After: ${booking.ends_at.toISOString()} - ${bufferAfterEnd.toISOString()}`);
        console.log(`     Total Blocked: ${bufferBeforeStart.toISOString()} - ${bufferAfterEnd.toISOString()}`);
      });
    }
    
    console.log('\n🎯 Expected Available Slots for August 1st:');
    console.log('  Default availability: 9:00 AM - 5:00 PM UTC');
    console.log('  Blocked period: 10:00 AM - 1:30 PM UTC (due to booking + buffers)');
    console.log('  Available slots should be: 1:30 PM - 5:00 PM UTC');
    console.log('  In local time (UTC+2): 3:30 PM - 7:00 PM');
    
    console.log('\n✅ Buffer settings updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBuffers(); 