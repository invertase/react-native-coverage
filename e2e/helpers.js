/**
 * Shared Appium / WDIO helpers for coverage example cells.
 */

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

/**
 * Locate by React Native testID.
 * iOS: testID → accessibility id (`~id`).
 * Android: testID → resource-id (content-desc is often empty unless accessibilityLabel is set).
 */
function byTestId(id) {
  if (driver.isAndroid) {
    return $(`android=new UiSelector().resourceId("${id}")`);
  }
  return $(`~${id}`);
}

function iosCapabilities() {
  const caps = {
    'platformName': 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 17',
    'appium:platformVersion': process.env.IOS_PLATFORM_VERSION,
    'appium:bundleId': requiredEnv('IOS_BUNDLE_ID'),
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
    'appium:wdaLaunchTimeout': 120000,
    'appium:wdaConnectionTimeout': 240000,
    // Headless simctl boot + Appium UI restart hung at 120s on GHA; give the
    // post-open Simulator.app boot path room (matches RNFB-style long wait).
    'appium:simulatorStartupTimeout': 300000,
  };

  if (process.env.IOS_UDID) {
    caps['appium:udid'] = process.env.IOS_UDID;
  }
  if (process.env.IOS_APP_PATH) {
    caps['appium:app'] = process.env.IOS_APP_PATH;
  }
  if (process.env.IOS_WDA_APP_PATH) {
    caps['appium:usePreinstalledWDA'] = true;
    caps['appium:prebuiltWDAPath'] = process.env.IOS_WDA_APP_PATH;
  }

  return caps;
}

function androidCapabilities() {
  const caps = {
    'platformName': 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Android Emulator',
    'appium:appPackage': requiredEnv('ANDROID_APP_PACKAGE'),
    'appium:appActivity': process.env.ANDROID_APP_ACTIVITY || '.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
    // Give Metro first-bundle time after adb reverse (seen ~9s on GHA).
    'appium:appWaitDuration': 120000,
  };

  if (process.env.ANDROID_APP_PATH) {
    caps['appium:app'] = process.env.ANDROID_APP_PATH;
  }
  if (process.env.ANDROID_UDID) {
    caps['appium:udid'] = process.env.ANDROID_UDID;
  }

  return caps;
}

module.exports = {
  byTestId,
  iosCapabilities,
  androidCapabilities,
  requiredEnv,
};
