import fs from 'node:fs';
import path from 'node:path';

/**
 * The WDA prebuild must pass IPHONEOS_DEPLOYMENT_TARGET explicitly.
 * appium-webdriveragent@17.0.12 defaults the project to 15.0. The cell
 * script passes 15.1, matching example-dynamic. This reads the cell script only.
 */
describe('scripts/ci/run-ios-e2e-cell.sh WDA deployment target', () => {
  const scriptPath = path.join(
    __dirname,
    '../../scripts/ci/run-ios-e2e-cell.sh'
  );
  const source = fs.readFileSync(scriptPath, 'utf8');

  function wdaBuildInvocation(): string {
    const start = source.indexOf(
      'run_logged "$LOG_DIR/wda-xcodebuild.log" xcodebuild'
    );
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = source.slice(start);
    const matched = rest.match(/^[\s\S]*?\n[ \t]*build-for-testing\b/);
    expect(matched).not.toBeNull();
    return (matched?.[0] ?? '')
      .replace(/#[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }

  it('defaults WDA_IPHONEOS_DEPLOYMENT_TARGET to 15.1 before the WDA build', () => {
    const assignment =
      'WDA_IPHONEOS_DEPLOYMENT_TARGET="${WDA_IPHONEOS_DEPLOYMENT_TARGET:-15.1}"';
    const assignmentAt = source.indexOf(assignment);
    const invocationAt = source.indexOf(
      'run_logged "$LOG_DIR/wda-xcodebuild.log" xcodebuild'
    );
    expect(assignmentAt).toBeGreaterThanOrEqual(0);
    expect(invocationAt).toBeGreaterThan(assignmentAt);
  });

  it('passes IPHONEOS_DEPLOYMENT_TARGET on the WebDriverAgentRunner build-for-testing invocation', () => {
    const invocation = wdaBuildInvocation();
    expect(invocation).toMatch(/-scheme WebDriverAgentRunner/);
    expect(invocation).toMatch(
      /-destination "generic\/platform=iOS Simulator"/
    );
    expect(invocation).toMatch(/build-for-testing/);
    expect(invocation).toMatch(
      /IPHONEOS_DEPLOYMENT_TARGET="\$\{WDA_IPHONEOS_DEPLOYMENT_TARGET\}"/
    );
    expect(invocation).not.toMatch(/IPHONEOS_DEPLOYMENT_TARGET=12\.0/);
  });
});
