// Set your Apple credentials here for testing
const APPLE_EMAIL = 'heine@dragnordre.no'; // <-- CHANGE THIS
const APPLE_PASSWORD = 'rjmd-wyzi-vplm-ojcf'; // <-- CHANGE THIS

process.env.APPLE_EMAIL = APPLE_EMAIL;
process.env.APPLE_PASSWORD = APPLE_PASSWORD;

import './apple_caldav_test';
// This script simply imports and runs the main Apple CalDAV test script.
// All logic and output is handled in apple_caldav_test.ts. 