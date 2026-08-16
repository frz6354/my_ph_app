import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import {
  getZipCodes,
  addZipCode,
  removeZipCode,
  getDefaultZipCode,
  setDefaultZipCode,
  runWeatherCheck,
  startForegroundService,
} from '../tasks/weatherTask';
import { clearAlertState } from '../services/notifications';
import { DrawerContentComponentProps } from '@react-navigation/drawer';

export default function ZipCodeDrawer(props: DrawerContentComponentProps) {
  const [zipInput, setZipInput] = useState('');
  const [zipCodes, setZipCodes] = useState<string[]>([]);
  const [defaultZip, setDefaultZip] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceRunning, setServiceRunning] = useState(false);

  const loadData = async () => {
    const codes = await getZipCodes();
    const defZip = await getDefaultZipCode();
    setZipCodes(codes);
    setDefaultZip(defZip);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddZip = useCallback(async () => {
    const trimmed = zipInput.trim();
    if (!trimmed) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await addZipCode(trimmed);
      const codes = await getZipCodes();
      if (codes.length === 1) {
        await setDefaultZipCode(trimmed);
        setDefaultZip(trimmed);
      }
      setZipCodes(codes);
      setZipInput('');
      await clearAlertState();

      // Run immediate check before emitting so the updated weather map is available for the UI
      try {
        const resultMap = await runWeatherCheck();

        if (resultMap && Object.keys(resultMap).length > 0) {
          // Start foreground service if not already running
          if (!serviceRunning && Platform.OS === 'android') {
            try {
              await startForegroundService();
              setServiceRunning(true);
            } catch (e) {
              console.error('Failed to start foreground service:', e);
            }
          }
        } else {
          setError('Could not fetch weather. Check zip code & API key.');
        }
      } catch (e: any) {
        if (e.message === 'pls update key') {
          setError('pls update key');
        } else {
          setError('Could not fetch weather. Check zip code & API key.');
        }
      }

      DeviceEventEmitter.emit('zip_changed');
    } finally {
      setIsSubmitting(false);
    }
  }, [zipInput, serviceRunning]);

  const handleRemoveZip = useCallback((zip: string) => {
    Alert.alert(
      'Delete Zip Code',
      `Are you sure you want to remove ${zip}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeZipCode(zip);
            await loadData();
            DeviceEventEmitter.emit('zip_changed');
          },
        },
      ]
    );
  }, []);

  const handleSetDefault = useCallback(async (zip: string) => {
    await setDefaultZipCode(zip);
    await loadData();
    DeviceEventEmitter.emit('zip_changed');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Zip Codes</Text>

      {/* Zip Code Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Enter zip code..."
          placeholderTextColor="#999"
          value={zipInput}
          onChangeText={setZipInput}
          onSubmitEditing={handleAddZip}
          returnKeyType="done"
          keyboardType="numeric"
          editable={!isSubmitting}
        />
        <TouchableOpacity
          style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
          onPress={handleAddZip}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Zip Code List */}
      {zipCodes.length > 0 ? (
        <View style={styles.zipListCard}>
          <Text style={styles.zipListTitle}>Watched Zip Codes</Text>
          {zipCodes.map(zip => (
            <View key={zip} style={styles.zipRow}>
              <Text style={[styles.zipText, defaultZip === zip && styles.boldText]}>
                {zip} {defaultZip === zip ? '(Default)' : ''}
              </Text>
              <View style={styles.zipActions}>
                {defaultZip !== zip && (
                  <TouchableOpacity onPress={() => handleSetDefault(zip)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemoveZip(zip)} style={[styles.actionBtn, styles.deleteBtn]}>
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateText}>
            Add a zip code to start monitoring weather conditions.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    backgroundColor: '#0984e3',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  saveBtn: {
    backgroundColor: '#00b894',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 10,
    elevation: 2,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    backgroundColor: 'rgba(214, 48, 49, 0.9)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
  zipListCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  zipListTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  zipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  zipText: {
    color: '#fff',
    fontSize: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  zipActions: {
    flexDirection: 'row',
  },
  emptyStateCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionBtn: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  deleteBtn: {
    backgroundColor: '#d63031',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
