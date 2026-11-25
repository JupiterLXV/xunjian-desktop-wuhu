// Test runner owns its profile; production main process is unmodified.
const {app}=require('electron');
app.setPath('userData',process.env.XUNJIAN_TEST_DIR);
// Explicit opt-in for restricted Linux test hosts without Unix sockets. Never used by packaged code or Windows CI.
if(process.platform==='linux'&&process.env.XUNJIAN_TEST_NO_SINGLE_INSTANCE==='1')app.requestSingleInstanceLock=()=>true;
require('../../app/main.cjs');
