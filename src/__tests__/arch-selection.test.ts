import { execFileSync } from 'node:child_process';

import {
  buildArchArgs,
  chooseLlvmArch,
  detectBinaryArchs,
  normalizeHostArch,
  resolveLlvmArch,
} from '../process-ios-native-coverage';

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn(),
}));

const mockExec = execFileSync as unknown as jest.Mock;

beforeEach(() => {
  mockExec.mockReset();
});

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

describe('detectBinaryArchs', () => {
  it('parses the arch list from lipo output', () => {
    mockExec.mockReturnValue('arm64 x86_64\n');
    expect(detectBinaryArchs('/path/to/App')).toEqual(['arm64', 'x86_64']);
    expect(mockExec).toHaveBeenCalledWith(
      'xcrun',
      ['lipo', '-archs', '/path/to/App'],
      expect.anything()
    );
  });

  it('returns [] when lipo fails (missing file / no lipo)', () => {
    mockExec.mockImplementation(() => {
      throw new Error('lipo: can’t open input file');
    });
    expect(detectBinaryArchs('/nope')).toEqual([]);
  });
});

describe('buildArchArgs', () => {
  it('emits no flag when no arch is selected', () => {
    expect(buildArchArgs(undefined)).toEqual([]);
  });

  it('emits a single -arch= token when selected', () => {
    expect(buildArchArgs('arm64')).toEqual(['-arch=arm64']);
  });
});

describe('resolveLlvmArch', () => {
  it('returns the CLI override without inspecting the binary', () => {
    expect(resolveLlvmArch('/path/App', '', 'x86_64')).toBe('x86_64');
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('returns the config arch when no override is given', () => {
    expect(resolveLlvmArch('/path/App', 'arm64')).toBe('arm64');
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('auto-returns undefined for a thin detected binary', () => {
    mockExec.mockReturnValue('arm64\n');
    expect(resolveLlvmArch('/path/App', '')).toBeUndefined();
  });

  it('auto-selects a slice for a universal detected binary', () => {
    mockExec.mockReturnValue('arm64 x86_64\n');
    expect(['arm64', 'x86_64']).toContain(resolveLlvmArch('/path/App', ''));
  });
});
