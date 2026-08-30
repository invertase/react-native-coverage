import CoverageFixture from './NativeCoverageFixture';

/** Call instrumented fixture-lib native code (for coverage proof). */
export function hit(): number {
  return CoverageFixture.hit();
}

export default CoverageFixture;
