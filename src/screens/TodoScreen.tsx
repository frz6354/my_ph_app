import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TodoScreenProps {
  route: any;
}

export default function TodoScreen({ route }: TodoScreenProps) {
  const tabName = route.name;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tabName}</Text>
      <Text style={styles.subtitle}>Coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
