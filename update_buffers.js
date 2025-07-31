const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function updateBuffers() {
  try {
    console.log('=== Updating Buffer Settings ===\n');
    
    // Update the event type with proper buffer settings
    const updatedEventType = await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: {
        buffer_before: 120, // 2 hours before
        buffer_after: 240,  // 4 hours after
      }
    });
    
    console.log('Updated Event Type Settings:');
    console.log('  Duration:', updatedEventType.duration, 'minutes');
    console.log('  Buffer Before:', updatedEventType.buffer_before, 'minutes');
    console.log('  Buffer After:', updatedEventType.buffer_after, 'minutes');
    console.log('  Advance Notice:', updatedEventType.advance_notice, 'minutes');
    console.log('  Slot Interval:', updatedEventType.slot_interval, 'minutes');
    
    console.log('\nBuffer settings updated successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBuffers(); 