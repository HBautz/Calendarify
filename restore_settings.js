const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function restoreSettings() {
  try {
    console.log('=== Restoring Event Type Settings ===\n');
    
    // Restore all the correct settings
    const updatedEventType = await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: {
        duration: 30,
        buffer_before: 120, // 2 hours before
        buffer_after: 240,  // 4 hours after
        advance_notice: 1440, // 1 day (24 hours)
        slot_interval: 30, // 30 minutes
      }
    });
    
    console.log('Restored Event Type Settings:');
    console.log('  Duration:', updatedEventType.duration, 'minutes');
    console.log('  Buffer Before:', updatedEventType.buffer_before, 'minutes');
    console.log('  Buffer After:', updatedEventType.buffer_after, 'minutes');
    console.log('  Advance Notice:', updatedEventType.advance_notice, 'minutes');
    console.log('  Slot Interval:', updatedEventType.slot_interval, 'minutes');
    
    console.log('\nAll settings restored successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSettings(); 