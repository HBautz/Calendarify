// Console commands for localStorage management

// Command 1: Dump localStorage to console (READ-ONLY)
window.dumpLocalStorage = function() {
  console.log('🔍 Dumping all localStorage data...\n');
  
  const allData = {};
  const keys = [];
  
  // Collect all keys and data
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      keys.push(key);
      try {
        const value = localStorage.getItem(key);
        allData[key] = value;
      } catch (e) {
        allData[key] = '[Error reading value]';
      }
    }
  }
  
  // Sort keys alphabetically
  keys.sort();
  
  console.log('📋 All localStorage keys:');
  console.log(JSON.stringify(keys, null, 2));
  console.log('\n📊 All localStorage data (JSON):');
  console.log(JSON.stringify(allData, null, 2));
  
  // Also show parsed data for calendarify keys
  console.log('\n🔧 Parsed calendarify data:');
  keys.forEach(key => {
    if (key.startsWith('calendarify-')) {
      try {
        const parsed = JSON.parse(allData[key]);
        console.log(`${key}:`, parsed);
      } catch (e) {
        console.log(`${key}:`, allData[key]);
      }
    }
  });
  
  // Create a copyable object
  const copyableData = {};
  keys.forEach(key => {
    try {
      copyableData[key] = JSON.parse(allData[key]);
    } catch (e) {
      copyableData[key] = allData[key];
    }
  });
  
  console.log('\n📋 Copyable localStorage object:');
  console.log('const localStorageDump = ' + JSON.stringify(copyableData, null, 2) + ';');
  
  console.log('\n✅ localStorage dump complete!');
  console.log('💡 Copy the "localStorageDump" object above to restore this data later.');
  console.log('⚠️  This command only READS localStorage - it does NOT delete anything.');
};

// Command 2: Clear all localStorage (DESTRUCTIVE)
window.clearLocalStorage = function() {
  console.log('🧹 Clearing all localStorage data...\n');
  
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      keys.push(key);
    }
  }
  
  console.log('📋 Keys that will be deleted:');
  console.log(JSON.stringify(keys, null, 2));
  
  const confirmed = confirm(`Are you sure you want to delete ${keys.length} localStorage items?\n\nThis action cannot be undone!`);
  
  if (confirmed) {
    localStorage.clear();
    console.log('✅ All localStorage data has been cleared!');
    console.log('🔄 You may need to refresh the page for changes to take effect.');
  } else {
    console.log('❌ localStorage clear cancelled.');
  }
};

// Command 3: Clear only calendarify localStorage (DESTRUCTIVE)
window.clearCalendarifyLocalStorage = function() {
  console.log('🧹 Clearing only calendarify localStorage data...\n');
  
  const calendarifyKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('calendarify-')) {
      calendarifyKeys.push(key);
    }
  }
  
  console.log('📋 Calendarify keys that will be deleted:');
  console.log(JSON.stringify(calendarifyKeys, null, 2));
  
  const confirmed = confirm(`Are you sure you want to delete ${calendarifyKeys.length} calendarify localStorage items?\n\nThis action cannot be undone!`);
  
  if (confirmed) {
    calendarifyKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('✅ All calendarify localStorage data has been cleared!');
    console.log('🔄 You may need to refresh the page for changes to take effect.');
  } else {
    console.log('❌ calendarify localStorage clear cancelled.');
  }
};

console.log('📋 localStorage management commands loaded:');
console.log('  • dumpLocalStorage() - Dump all localStorage to console (READ-ONLY)');
console.log('  • clearLocalStorage() - Clear ALL localStorage (DESTRUCTIVE)');
console.log('  • clearCalendarifyLocalStorage() - Clear only calendarify localStorage (DESTRUCTIVE)'); 