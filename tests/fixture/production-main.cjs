// Test runner owns its profile; production source and authorization path are unmodified.
const {app}=require('electron');
app.setPath('userData',process.env.XUNJIAN_TEST_DIR);
require('../../app/main.cjs');
