import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';

/**
 * Example harness — Pattern C dedicated test app.
 * On mount: exercise fixture-lib then flush native coverage (Appium later).
 */
export default function App() {
  const [lastHit, setLastHit] = useState<number | null>(null);
  const [status, setStatus] = useState('idle');

  const runCoverageDemo = () => {
    try {
      // Lazy require so Metro still loads if native binary is missing in Expo Go.
      const { hit } = require('coverage-fixture');
      const { flush } = require('react-native-coverage');
      const value = hit();
      flush();
      setLastHit(value);
      setStatus(`hit=${value}; flush invoked`);
      console.log('[example] fixture hit + flush', value);
    } catch (error) {
      setStatus(`unavailable: ${String(error)}`);
      console.warn('[example] coverage demo unavailable', error);
    }
  };

  useEffect(() => {
    runCoverageDemo();
  }, []);

  return (
    <View style={styles.container} testID="coverage-root">
      <Text style={styles.title} testID="coverage-title">
        react-native-coverage
      </Text>
      <Text style={styles.subtitle} testID="coverage-cell">
        Expo static cell + CoverageFixture
      </Text>
      <Text style={styles.status} testID="coverage-status">
        {status}
      </Text>
      {lastHit != null ? (
        <Text style={styles.status} testID="coverage-last-hit">
          last hit accumulator: {lastHit}
        </Text>
      ) : null}
      <Button
        title="Hit fixture + flush"
        onPress={runCoverageDemo}
        testID="coverage-hit-button"
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#666',
    marginBottom: 8,
  },
  status: {
    color: '#333',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
