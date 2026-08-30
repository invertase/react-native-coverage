import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule surface for native coverage flush.
 * Full Kotlin/ObjC++ flusher lands in a later queue item; this is an empty stub.
 */
export interface Spec extends TurboModule {
  flush(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Coverage');
