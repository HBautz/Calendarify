// Test timezone handling for booking creation
console.log('🧪 Testing Timezone Handling...\n');

// Simulate the frontend time creation process
function testFrontendTimeCreation() {
  console.log('📅 Frontend Time Creation Test:');
  
  // Simulate selected date and time
  const selectedDate = new Date('2025-08-31'); // Sunday, August 31, 2025
  const selectedTime = '14:30'; // 2:30 PM
  const eventDuration = 30; // 30 minutes
  
  console.log(`Selected Date: ${selectedDate.toDateString()}`);
  console.log(`Selected Time: ${selectedTime}`);
  console.log(`Event Duration: ${eventDuration} minutes`);
  
  // Parse time
  const [hours, minutes] = selectedTime.split(':').map(Number);
  
  // OLD METHOD (problematic)
  const oldStartTime = new Date(selectedDate);
  oldStartTime.setHours(hours, minutes, 0, 0);
  const oldEndTime = new Date(oldStartTime);
  oldEndTime.setMinutes(oldEndTime.getMinutes() + eventDuration);
  
  console.log('\n🔴 OLD METHOD (problematic):');
  console.log(`Local Start Time: ${oldStartTime.toLocaleString()}`);
  console.log(`Local End Time: ${oldEndTime.toLocaleString()}`);
  console.log(`UTC Start Time: ${oldStartTime.toISOString()}`);
  console.log(`UTC End Time: ${oldEndTime.toISOString()}`);
  
  // NEW METHOD (fixed)
  const newStartTime = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours, minutes, 0, 0));
  const newEndTime = new Date(newStartTime.getTime() + (eventDuration * 60000));
  
  console.log('\n🟢 NEW METHOD (fixed):');
  console.log(`UTC Start Time: ${newStartTime.toISOString()}`);
  console.log(`UTC End Time: ${newEndTime.toISOString()}`);
  console.log(`Local Start Time: ${newStartTime.toLocaleString()}`);
  console.log(`Local End Time: ${newEndTime.toLocaleString()}`);
  
  // Compare the results
  console.log('\n📊 COMPARISON:');
  console.log(`Time Difference: ${Math.abs(newStartTime.getTime() - oldStartTime.getTime()) / 60000} minutes`);
  
  return { oldStartTime, oldEndTime, newStartTime, newEndTime };
}

// Test backend time handling
function testBackendTimeHandling(bookingTimes) {
  console.log('\n🔧 Backend Time Handling Test:');
  
  const { newStartTime, newEndTime } = bookingTimes;
  
  // Simulate what the backend receives
  const booking = {
    starts_at: newStartTime,
    ends_at: newEndTime,
    event_type: { title: 'Test Meeting' },
    name: 'Test User',
    email: 'test@example.com'
  };
  
  // Simulate the event data creation
  const eventData = {
    summary: `${booking.event_type.title} with ${booking.name}`,
    description: `Meeting with ${booking.name} (${booking.email})`,
    start: {
      dateTime: booking.starts_at.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: booking.ends_at.toISOString(),
      timeZone: 'UTC',
    },
    attendees: [
      { email: booking.email, displayName: booking.name }
    ],
  };
  
  console.log('Event Data for Google Calendar:');
  console.log(JSON.stringify(eventData, null, 2));
  
  return eventData;
}

// Run the tests
const bookingTimes = testFrontendTimeCreation();
const eventData = testBackendTimeHandling(bookingTimes);

console.log('\n✅ Timezone Test Completed!');
console.log('\n💡 Key Changes:');
console.log('1. Frontend now creates UTC dates using Date.UTC()');
console.log('2. Backend sends UTC times to Google Calendar');
console.log('3. Google Calendar will display times in user\'s timezone');
