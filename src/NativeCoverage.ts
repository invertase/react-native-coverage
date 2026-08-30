import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule surface for native coverage flush (New Architecture only).
 */
export interface Spec extends TurboModule {
  flush(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Coverage');
