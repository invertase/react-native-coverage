import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';

/**
 * Example harness — Pattern C dedicated test app.
 * Native flush is a no-op stub until the flusher is ported.
 */
export default function App() {
  const onFlush = () => {
    try {
      // Lazy require so Metro still loads if native binary is missing in Expo Go.

      const { flush } = require('react-native-coverage');
      flush();

      console.log('[example] flush() invoked');
    } catch (error) {
      console.warn('[example] flush unavailable', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>react-native-coverage</Text>
      <Text style={styles.subtitle}>Expo example (Appium e2e later)</Text>
      <Button title="Flush coverage (stub)" onPress={onFlush} />
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
});
