// Test runner owns its profile; production main process is unmodified.
const {app}=require('electron');
app.setPath('userData',process.env.XUNJIAN_TEST_DIR);
require('../../app/main.cjs');
