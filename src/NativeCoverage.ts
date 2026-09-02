import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule surface for native coverage flush (New Architecture only).
 */
export interface Spec extends TurboModule {
  flush(): void;
  /**
   * Persist Istanbul `global.__coverage__` JSON to the app sandbox
   * (`files/coverage-final.json` on Android, `Documents/coverage-final.json` on iOS)
   * for host-side `rn-coverage js pull` + NYC remap.
   */
  dumpJsCoverage(json: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Coverage');
