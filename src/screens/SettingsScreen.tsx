import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { getApiKey, setApiKey, removeApiKey } from '../services/weatherApi';
import { getAlarmSettings, setAlarmSettings, AlarmType, AlarmSound, AlarmSettings, AlarmItem } from '../services/alarmApi';
import { sendAlarmNotification, cancelPersistentNotification } from '../services/notifications';
import { startForegroundService, stopForegroundService, syncSystemAlarms } from '../tasks/weatherTask';

type ViewState = 'menu' | 'key' | 'alarms_list' | 'edit_alarm';

export default function SettingsScreen() {
  const [view, setView] = useState<ViewState>('menu');

  // Key state
  const [apiKey, setApiKeyValue] = useState('');

  // Global alarm settings state
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [isPersistent, setIsPersistent] = useState(false);

  // Form state for edit_alarm
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alarmType, setAlarmType] = useState<AlarmType>('none');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM'|'PM'>('AM');
  const [offsetValue, setOffsetValue] = useState('0');
  const [offsetDirection, setOffsetDirection] = useState<'before'|'after'>('before');
  const [alarmSound, setAlarmSound] = useState<AlarmSound>('default');
  const [useSystemAlarm, setUseSystemAlarm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const key = await getApiKey();
    setApiKeyValue(key || '');

    const settings = await getAlarmSettings();
    setAlarms(settings.alarms || []);
    setIsPersistent(settings.isPersistent);
  };

  const handleSaveKey = async () => {
    await setApiKey(apiKey);
    Alert.alert('Success', 'API Key saved successfully.');
    setView('menu');
  };

  const handleDeleteKey = () => {
    Alert.alert(
      'Delete API Key',
      'Are you sure you want to remove the API Key?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeApiKey();
            setApiKeyValue('');
            Alert.alert('Success', 'API Key removed.');
            setView('menu');
          },
        },
      ]
    );
  };

  const togglePersistent = async (value: boolean) => {
    setIsPersistent(value);
    const settings = await getAlarmSettings();
    settings.isPersistent = value;
    await setAlarmSettings(settings);

    if (value) {
      try {
        await startForegroundService();
      } catch (e) {
        console.warn('Could not start foreground service:', e);
      }
    } else {
      try {
        await stopForegroundService();
      } catch (e) {
        console.warn('Could not stop foreground service:', e);
      }
    }
  };

  const handleAddNewAlarm = () => {
    setEditingId(null);
    setAlarmType('custom');
    setHour('08');
    setMinute('00');
    setAmpm('AM');
    setOffsetValue('0');
    setOffsetDirection('before');
    setAlarmSound('default');
    setUseSystemAlarm(false);
    setView('edit_alarm');
  };

  const handleEditAlarm = (alarm: AlarmItem) => {
    setEditingId(alarm.id);
    setAlarmType(alarm.type);

    const match = alarm.customTime.match(/(\d+):(\d+)\s+(AM|PM)/i);
    if (match) {
      setHour(match[1]);
      setMinute(match[2]);
      setAmpm(match[3].toUpperCase() as 'AM'|'PM');
    }

    if (alarm.offsetMinutes < 0) {
      setOffsetDirection('before');
      setOffsetValue(Math.abs(alarm.offsetMinutes).toString());
    } else {
      setOffsetDirection('after');
      setOffsetValue(alarm.offsetMinutes.toString());
    }

    setAlarmSound(alarm.sound);
    setUseSystemAlarm(!!alarm.useSystemAlarm);
    setView('edit_alarm');
  };

  const handleDeleteAlarm = async (id: string) => {
    Alert.alert(
      'Delete Alarm',
      'Are you sure you want to delete this alarm?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedAlarms = alarms.filter(a => a.id !== id);
            setAlarms(updatedAlarms);
            const settings = await getAlarmSettings();
            settings.alarms = updatedAlarms;
            await setAlarmSettings(settings);
          },
        },
      ]
    );
  };

  const handleSaveAlarm = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let offset = parseInt(offsetValue, 10);
      if (isNaN(offset)) offset = 0;
      if (offsetDirection === 'before') offset = -offset;

      const formattedHour = hour.padStart(2, '0');
      const formattedMinute = minute.padStart(2, '0');
      const customTime = `${formattedHour}:${formattedMinute} ${ampm}`;

      const updatedAlarm: AlarmItem = {
        id: editingId || Date.now().toString(),
        type: alarmType,
        customTime,
        offsetMinutes: offset,
        sound: alarmSound,
        useSystemAlarm,
      };

      let newAlarms;
      if (editingId) {
        newAlarms = alarms.map(a => a.id === editingId ? updatedAlarm : a);
      } else {
        newAlarms = [...alarms, updatedAlarm];
      }

      setAlarms(newAlarms);

      const settings = await getAlarmSettings();
      settings.alarms = newAlarms;
      await setAlarmSettings(settings);

      // Sync system alarms immediately
      if (Platform.OS === 'android') {
        try {
          const LAST_SYSTEM_ALARM_TIMES_KEY = '@weather_last_system_alarm_times';
          const lastTimesRaw = await AsyncStorage.getItem(LAST_SYSTEM_ALARM_TIMES_KEY);
          if (lastTimesRaw) {
            const lastTimes = JSON.parse(lastTimesRaw);
            delete lastTimes[updatedAlarm.id];
            await AsyncStorage.setItem(LAST_SYSTEM_ALARM_TIMES_KEY, JSON.stringify(lastTimes));
          }
        } catch (err) {
          console.warn('Could not clear last system alarm time state:', err);
        }

        try {
          await syncSystemAlarms();
        } catch (syncErr) {
          console.warn('Could not sync system alarms:', syncErr);
        }
      }

      setView('alarms_list');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save alarm settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestAlarm = async () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);

    let testHour = now.getHours();
    const testMinute = now.getMinutes();
    const testAmpm = testHour >= 12 ? 'PM' : 'AM';
    if (testHour > 12) testHour -= 12;
    if (testHour === 0) testHour = 12;

    const customTime = `${testHour.toString().padStart(2, '0')}:${testMinute.toString().padStart(2, '0')} ${testAmpm}`;

    const newAlarm: AlarmItem = {
      id: Date.now().toString(),
      type: 'custom',
      customTime,
      offsetMinutes: 0,
      sound: alarmSound,
    };

    const newAlarms = [...alarms, newAlarm];
    setAlarms(newAlarms);

    const settings = await getAlarmSettings();
    settings.alarms = newAlarms;
    await setAlarmSettings(settings);

    Alert.alert('Test Alarm Saved', `Alarm set for ${customTime} (1 min from now).`);
  };

  const renderTypeButton = (type: AlarmType, label: string) => (
    <TouchableOpacity
      style={[styles.optionBtn, alarmType === type && styles.optionBtnSelected]}
      onPress={() => setAlarmType(type)}
    >
      <Text style={[styles.optionBtnText, alarmType === type && styles.optionBtnTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderSoundButton = (sound: AlarmSound, label: string) => (
    <TouchableOpacity
      style={[styles.optionBtn, alarmSound === sound && styles.optionBtnSelected]}
      onPress={() => {
        setAlarmSound(sound);
        sendAlarmNotification(sound, 'Test Sound', `Playing ${label} sound...`);
      }}
    >
      <Text style={[styles.optionBtnText, alarmSound === sound && styles.optionBtnTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const formatAlarmSummary = (alarm: AlarmItem) => {
    let summary = '';
    if (alarm.type === 'custom') {
      summary = `Custom: ${alarm.customTime}`;
    } else if (alarm.type === 'sunrise') {
      summary = 'Sunrise';
    } else if (alarm.type === 'sunset') {
      summary = 'Sunset';
    } else if (alarm.type === 'sunrise_offset') {
      const dir = alarm.offsetMinutes < 0 ? 'Before' : 'After';
      summary = `${Math.abs(alarm.offsetMinutes)} min ${dir} Sunrise`;
    } else if (alarm.type === 'sunset_offset') {
      const dir = alarm.offsetMinutes < 0 ? 'Before' : 'After';
      summary = `${Math.abs(alarm.offsetMinutes)} min ${dir} Sunset`;
    }
    return summary;
  };

  return (
    <ScrollView style={styles.container}>
      {view === 'menu' && (
        <>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity style={styles.menuCard} onPress={() => setView('key')}>
            <Text style={styles.menuCardText}>Weather API Key</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCard} onPress={() => setView('alarms_list')}>
            <Text style={styles.menuCardText}>Alarm & Notification Settings</Text>
          </TouchableOpacity>
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>App Version: {Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </>
      )}

      {view === 'key' && (
        <>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('menu')}>
            <Text style={styles.backBtnText}>← Back to Menu</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Weather API Key</Text>
          <Text style={styles.label}>Current Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter API Key"
            placeholderTextColor="#888"
            value={apiKey}
            onChangeText={setApiKeyValue}
            autoCapitalize="none"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveKey}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, styles.deleteBtn]} onPress={handleDeleteKey}>
              <Text style={styles.btnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {view === 'alarms_list' && (
        <>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('menu')}>
            <Text style={styles.backBtnText}>← Back to Menu</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Alarms & Notifications</Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Permanent Notification</Text>
            <Switch value={isPersistent} onValueChange={togglePersistent} />
          </View>

          <Text style={styles.sectionTitle}>Your Alarms</Text>

          {alarms.length === 0 ? (
            <Text style={styles.emptyText}>No alarms configured.</Text>
          ) : (
            alarms.map(alarm => (
              <View key={alarm.id} style={styles.alarmListCard}>
                <View style={styles.alarmListInfo}>
                  <Text style={styles.alarmListTitle}>{formatAlarmSummary(alarm)}</Text>
                  <Text style={styles.alarmListSubtitle}>
                    Sound: {alarm.sound}{alarm.useSystemAlarm ? ' | System Alarm' : ''}
                  </Text>
                </View>
                <View style={styles.alarmListActions}>
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => handleEditAlarm(alarm)}>
                    <Text style={styles.editIconText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteIconBtn} onPress={() => handleDeleteAlarm(alarm.id)}>
                    <Text style={styles.deleteIconText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.addBtn} onPress={handleAddNewAlarm}>
            <Text style={styles.btnText}>+ Add New Alarm</Text>
          </TouchableOpacity>
        </>
      )}

      {view === 'edit_alarm' && (
        <>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('alarms_list')}>
            <Text style={styles.backBtnText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Edit Alarm' : 'New Alarm'}</Text>

          <Text style={styles.label}>Alarm Type</Text>
          <View style={styles.optionsRow}>
            {renderTypeButton('sunrise', 'Sunrise')}
            {renderTypeButton('sunset', 'Sunset')}
          </View>
          <View style={styles.optionsRow}>
            {renderTypeButton('custom', 'Custom Time')}
            {renderTypeButton('sunrise_offset', 'Sunrise Offset')}
            {renderTypeButton('sunset_offset', 'Sunset Offset')}
          </View>

          {alarmType === 'custom' && (
            <View style={styles.widgetContainer}>
              <Text style={styles.label}>Custom Time</Text>
              {Platform.OS === 'android' ? (
                <View style={styles.timePickerRow}>
                  <TouchableOpacity
                    style={styles.timeDisplayBtn}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.timeDisplayText}>
                      {`${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${ampm}`}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={(() => {
                        const d = new Date();
                        let h = parseInt(hour, 10);
                        if (ampm === 'PM' && h < 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        d.setHours(h);
                        d.setMinutes(parseInt(minute, 10));
                        return d;
                      })()}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowTimePicker(false);
                        if (selectedDate) {
                          let h = selectedDate.getHours();
                          const m = selectedDate.getMinutes();
                          const newAmpm = h >= 12 ? 'PM' : 'AM';
                          if (h > 12) h -= 12;
                          if (h === 0) h = 12;
                          setHour(h.toString());
                          setMinute(m.toString().padStart(2, '0'));
                          setAmpm(newAmpm);
                        }
                      }}
                    />
                  )}
                </View>
              ) : (
                <DateTimePicker
                  value={(() => {
                    const d = new Date();
                    let h = parseInt(hour, 10);
                    if (ampm === 'PM' && h < 12) h += 12;
                    if (ampm === 'AM' && h === 12) h = 0;
                    d.setHours(h);
                    d.setMinutes(parseInt(minute, 10));
                    return d;
                  })()}
                  mode="time"
                  display="inline"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      let h = selectedDate.getHours();
                      const m = selectedDate.getMinutes();
                      const newAmpm = h >= 12 ? 'PM' : 'AM';
                      if (h > 12) h -= 12;
                      if (h === 0) h = 12;
                      setHour(h.toString());
                      setMinute(m.toString().padStart(2, '0'));
                      setAmpm(newAmpm);
                    }
                  }}
                />
              )}
            </View>
          )}

          {(alarmType === 'sunrise_offset' || alarmType === 'sunset_offset') && (
            <View style={styles.widgetContainer}>
              <Text style={styles.label}>Offset</Text>
              <View style={styles.offsetPickerRow}>
                <TextInput
                  style={[styles.input, styles.offsetInput]}
                  placeholder="e.g. 30"
                  placeholderTextColor="#888"
                  value={offsetValue}
                  onChangeText={setOffsetValue}
                  keyboardType="number-pad"
                />
                <Text style={styles.offsetLabelText}>minutes</Text>
                <View style={styles.directionToggleRow}>
                  <TouchableOpacity
                    style={[styles.directionBtn, offsetDirection === 'before' && styles.directionBtnSelected]}
                    onPress={() => setOffsetDirection('before')}
                  >
                    <Text style={[styles.directionBtnText, offsetDirection === 'before' && styles.directionBtnTextSelected]}>Before</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.directionBtn, offsetDirection === 'after' && styles.directionBtnSelected]}
                    onPress={() => setOffsetDirection('after')}
                  >
                    <Text style={[styles.directionBtnText, offsetDirection === 'after' && styles.directionBtnTextSelected]}>After</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={styles.alarmSoundHeader}>
            <Text style={[styles.label, { marginBottom: 0 }]}>Alarm Sound</Text>
            <TouchableOpacity style={styles.testBtn} onPress={handleTestAlarm}>
              <Text style={styles.testBtnText}>Test Alarm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            {renderSoundButton('default', 'Default')}
            {renderSoundButton('tone1', 'Tone 1')}
            {renderSoundButton('tone2', 'Tone 2')}
          </View>
          <View style={styles.optionsRow}>
            {renderSoundButton('vibrate', 'Vibrate Only')}
            {renderSoundButton('silent', 'Silent')}
          </View>

          {Platform.OS === 'android' && (
            <View style={styles.widgetContainer}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.label, { marginBottom: 4 }]}>Android System Alarm</Text>
                  <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
                    Schedules this alarm directly in your device's native Clock app to guarantee it never misses.
                  </Text>
                </View>
                <Switch value={useSystemAlarm} onValueChange={setUseSystemAlarm} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 20 }, submitting && { opacity: 0.5 }]}
            onPress={handleSaveAlarm}
            disabled={submitting}
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={styles.btnText}>{submitting ? 'Saving...' : 'Save Alarm'}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
    fontWeight: 'bold',
  },
  menuCard: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
  },
  menuCardText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  backBtn: {
    marginBottom: 20,
  },
  backBtnText: {
    color: '#0984e3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  alarmListCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  alarmListInfo: {
    flex: 1,
  },
  alarmListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  alarmListSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  alarmListActions: {
    flexDirection: 'row',
  },
  editIconBtn: {
    backgroundColor: '#0984e3',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  editIconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteIconBtn: {
    backgroundColor: '#d63031',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deleteIconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addBtn: {
    backgroundColor: '#00b894',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: '#0984e3',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  optionBtnSelected: {
    backgroundColor: '#0984e3',
  },
  optionBtnText: {
    color: '#0984e3',
    fontSize: 14,
  },
  optionBtnTextSelected: {
    color: '#fff',
  },
  widgetContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  timeDisplayBtn: {
    backgroundColor: '#0984e3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  timeDisplayText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  offsetPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offsetInput: {
    width: 80,
    textAlign: 'center',
    marginBottom: 0,
  },
  offsetLabelText: {
    fontSize: 16,
    marginHorizontal: 10,
    color: '#333',
  },
  directionToggleRow: {
    flexDirection: 'row',
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: '#0984e3',
    borderRadius: 8,
    overflow: 'hidden',
  },
  directionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  directionBtnSelected: {
    backgroundColor: '#0984e3',
  },
  directionBtnText: {
    color: '#0984e3',
    fontWeight: 'bold',
  },
  directionBtnTextSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveBtn: {
    backgroundColor: '#0984e3',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#d63031',
    marginRight: 0,
    marginLeft: 10,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alarmSoundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testBtn: {
    backgroundColor: '#00b894',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  testBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  versionContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingVertical: 10,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
});
