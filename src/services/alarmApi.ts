import AsyncStorage from '@react-native-async-storage/async-storage';

export type AlarmType = 'sunrise' | 'sunset' | 'custom' | 'sunrise_offset' | 'sunset_offset' | 'none';
export type AlarmSound = 'tone1' | 'tone2' | 'default' | 'vibrate' | 'silent';

export interface AlarmItem {
  id: string;
  type: AlarmType;
  customTime: string; // e.g. "08:00 AM"
  offsetMinutes: number; // e.g. -30 for 30 mins before, 30 for 30 mins after
  sound: AlarmSound;
  useSystemAlarm?: boolean;
}

export interface AlarmSettings {
  alarms: AlarmItem[];
  isPersistent: boolean;
  // Legacy fields for migration
  type?: AlarmType;
  customTime?: string;
  offsetMinutes?: number;
  sound?: AlarmSound;
}

const ALARM_SETTINGS_KEY = '@weather_alarm_settings';

const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  alarms: [],
  isPersistent: false,
};

export async function getAlarmSettings(): Promise<AlarmSettings> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration from legacy settings
      if (parsed.type && parsed.type !== 'none' && !parsed.alarms) {
        parsed.alarms = [{
          id: Date.now().toString(),
          type: parsed.type,
          customTime: parsed.customTime || '08:00 AM',
          offsetMinutes: parsed.offsetMinutes || 0,
          sound: parsed.sound || 'default',
        }];
        // Clean up legacy fields to avoid migrating again if not needed, but they can just be ignored.
      }
      if (!parsed.alarms) {
          parsed.alarms = [];
      }
      return { ...DEFAULT_ALARM_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Error fetching alarm settings', e);
  }
  return DEFAULT_ALARM_SETTINGS;
}

export async function setAlarmSettings(settings: AlarmSettings): Promise<void> {
  await AsyncStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(settings));
}
