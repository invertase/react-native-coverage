import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards + behavioral proof that Jacoco class/execution trees follow
 * layout.buildDirectory (including redirected roots away from projectDir/build).
 */
describe('android/rn-coverage-jacoco.gradle', () => {
  const repoRoot = path.join(__dirname, '../..');
  const gradlePath = path.join(repoRoot, 'android/rn-coverage-jacoco.gradle');
  const source = fs.readFileSync(gradlePath, 'utf8');
  /** Tree helpers only — exclude the optional self-test block (compares against projectDir/build). */
  const treeHelpers = [
    source.match(
      /def coverageClassDirectories\(\)[\s\S]*?(?=\ndef coverageSourceDirectories)/
    )?.[0],
    source.match(
      /def coverageExecutionData\([\s\S]*?(?=\ndef configureCoverageJacocoReport)/
    )?.[0],
  ]
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('resolves library class directories from layout.buildDirectory', () => {
    expect(source).toMatch(/coverageClassDirectories/);
    expect(source).toMatch(/proj\.layout\.buildDirectory\.get\(\)\.asFile/);
    expect(source).toMatch(/intermediates\/javac/);
    expect(source).toMatch(/tmp\/kotlin-classes/);
  });

  it('walks javac and kotlin variant trees (debug, release, and others)', () => {
    expect(source).toMatch(/javacRoot\.eachDir/);
    expect(source).toMatch(/kotlinRoot\.eachDir/);
    // Self-test seeds both debug and release so redirected consumers keep release classes.
    expect(source).toMatch(/\['debug',\s*'release'\]/);
  });

  it('does not hard-code projectDir/build or legacy buildDir for Jacoco trees', () => {
    expect(treeHelpers.length).toBeGreaterThan(100);
    expect(treeHelpers).not.toMatch(/\$\{proj\.projectDir\}[^;\n]*build/);
    expect(treeHelpers).not.toMatch(/\$\{project\.projectDir\}[^;\n]*build/);
    expect(treeHelpers).not.toMatch(
      /new File\(\s*proj\.projectDir\s*,\s*['"]build/
    );
    expect(treeHelpers).not.toMatch(
      /new File\(\s*project\.projectDir\s*,\s*['"]build/
    );
    expect(treeHelpers).not.toMatch(/proj\.projectDir\s*\+\s*['"]\/?build/);
    expect(treeHelpers).not.toMatch(/project\.projectDir\s*\+\s*['"]\/?build/);
    // Legacy Project.buildDir joins (cloud fix replaced these with layout.buildDirectory).
    expect(treeHelpers).not.toMatch(/proj\.buildDir/);
    expect(treeHelpers).not.toMatch(/project\.buildDir/);
  });

  it('resolves executionData trees from layout.buildDirectory', () => {
    expect(source).toMatch(/coverageExecutionData/);
    expect(source).toMatch(/layout\.buildDirectory\.get\(\)\.asFile/);
    expect(source).toMatch(/proj\.layout\.buildDirectory\.get\(\)\.asFile/);
  });

  it('resolves class and execution trees under a redirected layout.buildDirectory', () => {
    const fixtureDir = path.join(repoRoot, 'fixtures/android-build-dir');
    // Fixture-local wrapper: CI checkouts have no Expo prebuild (example/android).
    const gradlew = path.join(
      fixtureDir,
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
    );
    expect(fs.existsSync(gradlew)).toBe(true);
    expect(fs.existsSync(fixtureDir)).toBe(true);

    const redirectedRoot = path.join(fixtureDir, '.redirected-build');
    fs.rmSync(redirectedRoot, { recursive: true, force: true });

    const result = spawnSync(
      gradlew,
      [
        ':app:rnCoverageBuildDirSelfTest',
        '-PrnCoverageBuildDirSelfTest=true',
        '--no-daemon',
        '-q',
      ],
      {
        cwd: fixtureDir,
        encoding: 'utf8',
        shell: true,
        env: process.env,
      }
    );

    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (result.status !== 0) {
      throw new Error(
        `rnCoverageBuildDirSelfTest failed (exit ${result.status}):\n${combined}`
      );
    }
    expect(combined).toMatch(/rnCoverageBuildDirSelfTest: ok/);

    // Behavioral proof: seeded trees live under the redirect, not projectDir/build.
    expect(
      fs.existsSync(
        path.join(
          redirectedRoot,
          'lib/intermediates/javac/debug/compileDebugJavaWithJavac/classes/Sentinel.class'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          redirectedRoot,
          'lib/intermediates/javac/release/compileReleaseJavaWithJavac/classes/Sentinel.class'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          redirectedRoot,
          'lib/tmp/kotlin-classes/release/SentinelKt.class'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          redirectedRoot,
          'app/outputs/code_coverage/emulator_coverage.ec'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(fixtureDir, 'coverage-fixture-lib/build/intermediates')
      )
    ).toBe(false);
  }, 120_000);
});
