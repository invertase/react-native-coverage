const { iosCapabilities } = require('./helpers');

exports.config = {
  runner: 'local',
  specs: ['./specs/fixture-hit.e2e.js'],
  maxInstances: 1,
  capabilities: [iosCapabilities()],
  logLevel: 'info',
  bail: 1,
  waitforTimeout: 30000,
  connectionRetryTimeout: 180000,
  connectionRetryCount: 2,
  services: [],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 180000,
  },
  hostname: process.env.APPIUM_HOST || '127.0.0.1',
  port: Number(process.env.APPIUM_PORT || 4723),
  path: '/',
};
