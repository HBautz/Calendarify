const { PrismaClient } = require('./node_modules/@prisma/client');

const prisma = new PrismaClient();

async function testBufferSync() {
  try {
    console.log('🔍 === BUFFER SYNCHRONIZATION TEST ===\n');
    
    // 1. Check database values
    console.log('📊 1. DATABASE VALUES:');
    const eventType = await prisma.eventType.findUnique({
      where: { slug: 'event-name' }
    });
    
    console.log('   Buffer Before:', eventType.buffer_before, 'minutes');
    console.log('   Buffer After:', eventType.buffer_after, 'minutes');
    console.log('   Advance Notice:', eventType.advance_notice, 'minutes');
    
    // 2. Test backend API directly
    console.log('\n🌐 2. BACKEND API TEST:');
    const fetch = require('node-fetch');
    
    try {
      const response = await fetch('http://localhost:3001/api/event-types/event-name/slots?date=2025-08-01');
      const slots = await response.json();
      
      console.log('   API Response Status:', response.status);
      console.log('   Available Slots:', slots.length);
      if (slots.length > 0) {
        console.log('   First 3 slots:', slots.slice(0, 3));
        console.log('   Last 3 slots:', slots.slice(-3));
      }
    } catch (error) {
      console.log('   ❌ API Error:', error.message);
    }
    
    // 3. Check existing bookings
    console.log('\n📅 3. EXISTING BOOKINGS:');
    const bookings = await prisma.booking.findMany({
      where: { event_type_id: eventType.id },
      orderBy: { starts_at: 'asc' }
    });
    
    bookings.forEach((booking, index) => {
      console.log(`   Booking ${index + 1}: ${booking.starts_at.toISOString()} - ${booking.ends_at.toISOString()}`);
      
      // Calculate expected blocked periods
      const bufferBeforeStart = new Date(booking.starts_at.getTime() - (eventType.buffer_before * 60000));
      const bufferAfterEnd = new Date(booking.ends_at.getTime() + (eventType.buffer_after * 60000));
      
      console.log(`   Blocked period: ${bufferBeforeStart.toISOString()} - ${bufferAfterEnd.toISOString()}`);
    });
    
    // 4. Calculate expected available slots
    console.log('\n🎯 4. EXPECTED AVAILABLE SLOTS:');
    console.log('   Default availability: 9:00 AM - 5:00 PM UTC');
    
    if (bookings.length > 0) {
      const booking = bookings[0]; // First booking
      const bufferBeforeStart = new Date(booking.starts_at.getTime() - (eventType.buffer_before * 60000));
      const bufferAfterEnd = new Date(booking.ends_at.getTime() + (eventType.buffer_after * 60000));
      
      console.log('   Blocked period:', bufferBeforeStart.toISOString(), '-', bufferAfterEnd.toISOString());
      
      // Calculate available slots
      const dayStart = new Date(Date.UTC(2025, 7, 1, 9, 0, 0)); // 9 AM UTC
      const dayEnd = new Date(Date.UTC(2025, 7, 1, 17, 0, 0)); // 5 PM UTC
      
      if (bufferAfterEnd < dayEnd) {
        console.log('   Available slots should start from:', bufferAfterEnd.toISOString());
        console.log('   Available slots should end at:', dayEnd.toISOString());
      } else {
        console.log('   ❌ No available slots - entire day blocked');
      }
    }
    
    // 5. Test different buffer values
    console.log('\n🧪 5. TESTING DIFFERENT BUFFER VALUES:');
    
    // Test with 0 buffer
    console.log('   Testing with 0 buffer...');
    await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: { buffer_before: 0, buffer_after: 0 }
    });
    
    try {
      const response0 = await fetch('http://localhost:3001/api/event-types/event-name/slots?date=2025-08-01');
      const slots0 = await response0.json();
      console.log('   Slots with 0 buffer:', slots0.length);
    } catch (error) {
      console.log('   ❌ API Error with 0 buffer:', error.message);
    }
    
    // Test with 30 min buffer
    console.log('   Testing with 30 min buffer...');
    await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: { buffer_before: 30, buffer_after: 30 }
    });
    
    try {
      const response30 = await fetch('http://localhost:3001/api/event-types/event-name/slots?date=2025-08-01');
      const slots30 = await response30.json();
      console.log('   Slots with 30 min buffer:', slots30.length);
    } catch (error) {
      console.log('   ❌ API Error with 30 min buffer:', error.message);
    }
    
    // Restore original values
    console.log('   Restoring original buffer values...');
    await prisma.eventType.update({
      where: { slug: 'event-name' },
      data: { buffer_before: 120, buffer_after: 60 }
    });
    
    console.log('\n✅ Buffer synchronization test completed!');
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBufferSync(); 