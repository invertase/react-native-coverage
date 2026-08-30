import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Exercise instrumented native code; returns a non-zero counter. */
  hit(): number;
}

export default TurboModuleRegistry.getEnforcing<Spec>('CoverageFixture');
