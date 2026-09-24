import {
  chooseLlvmArch,
  normalizeHostArch,
} from '../process-ios-native-coverage';

describe('normalizeHostArch', () => {
  it('maps node x64 to x86_64', () => {
    expect(normalizeHostArch('x64')).toBe('x86_64');
  });

  it('passes arm64 through unchanged', () => {
    expect(normalizeHostArch('arm64')).toBe('arm64');
  });
});

describe('chooseLlvmArch', () => {
  it('returns undefined for a thin binary (no -arch needed)', () => {
    expect(chooseLlvmArch(['arm64'], 'arm64')).toBeUndefined();
  });

  it('returns undefined when no archs could be detected', () => {
    expect(chooseLlvmArch([], 'arm64')).toBeUndefined();
  });

  it('selects the host arch from a universal binary (Apple Silicon)', () => {
    expect(chooseLlvmArch(['x86_64', 'arm64'], 'arm64')).toBe('arm64');
  });

  it('selects the host arch from a universal binary (Intel)', () => {
    expect(chooseLlvmArch(['x86_64', 'arm64'], 'x64')).toBe('x86_64');
  });

  it('falls back to the first slice when the host arch is absent', () => {
    expect(chooseLlvmArch(['x86_64', 'i386'], 'arm64')).toBe('x86_64');
  });

  it('honors an explicit config/CLI arch over auto-detection', () => {
    expect(chooseLlvmArch(['x86_64', 'arm64'], 'arm64', 'x86_64')).toBe(
      'x86_64'
    );
  });

  it('honors an explicit arch even for a thin binary', () => {
    expect(chooseLlvmArch(['arm64'], 'arm64', 'x86_64')).toBe('x86_64');
  });

  it('ignores blank explicit arch and falls back to auto', () => {
    expect(chooseLlvmArch(['x86_64', 'arm64'], 'arm64', '  ')).toBe('arm64');
  });
});
