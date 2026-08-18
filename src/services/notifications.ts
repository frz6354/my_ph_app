import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidFlags,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { SeverityType } from './weatherApi';

const PERSISTENT_CHANNEL_ID = 'weather-persistent';
const ALERT_CHANNEL_ID = 'weather-alerts';
const ALARM_CHANNEL_ID_PREFIX = 'weather-alarms-';
const PERSISTENT_NOTIFICATION_ID = 'weather-current';
const LAST_ALERT_KEY = '@weather_last_alert';

export async function createNotificationChannels(): Promise<void> {
  await notifee.createChannel({
    id: PERSISTENT_CHANNEL_ID,
    name: 'Current Weather',
    description: 'Shows current temperature',
    importance: AndroidImportance.DEFAULT,
    visibility: AndroidVisibility.PUBLIC,
  });

  await notifee.createChannel({
    id: ALERT_CHANNEL_ID,
    name: 'Weather Alerts',
    description: 'Severe weather notifications',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });
}

async function getOrCreateAlarmChannel(sound: string): Promise<string> {
  const channelId = `${ALARM_CHANNEL_ID_PREFIX}${sound}`;

  let channelConfig: any = {
    id: channelId,
    name: `Weather Alarms (${sound})`,
    description: 'Weather Alarms',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  };

  if (sound === 'vibrate') {
    channelConfig.vibration = true;
  } else if (sound === 'silent') {
    channelConfig.vibration = false;
    channelConfig.importance = AndroidImportance.LOW; // Silent
  } else if (sound === 'default') {
    channelConfig.sound = 'default';
    channelConfig.vibration = true;
  } else {
    // custom tone like tone1, tone2
    channelConfig.sound = sound;
    channelConfig.vibration = true;
  }

  await notifee.createChannel(channelConfig);
  return channelId;
}

export async function sendAlarmNotification(
  sound: string,
  title: string,
  body: string
): Promise<void> {
  const channelId = await getOrCreateAlarmChannel(sound);

  const notificationId = await notifee.displayNotification({
    title,
    body,
    ios: {
      interruptionLevel: 'timeSensitive',
    },
    android: {
      channelId,
      pressAction: { id: 'default' },
      fullScreenAction: { id: 'default' },
      smallIcon: 'ic_launcher',
      importance: sound === 'silent' ? AndroidImportance.LOW : AndroidImportance.HIGH,
      category: AndroidCategory.ALARM,
      loopSound: true,
      autoCancel: false,
      flags: [AndroidFlags.FLAG_INSISTENT],
      timeoutAfter: 120000, // Auto cancel/dismiss on Android after 2 mins (120,000 ms)
    },
  });

  // Cross-platform fallback: set a timeout to cancel the notification programmatically after 2 minutes
  setTimeout(async () => {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (err) {
      console.warn('Failed to auto-cancel alarm notification:', err);
    }
  }, 120000);
}

export async function updatePersistentNotification(
  temp: number,
  city: string,
  condition: string,
  minTemp?: number,
  maxTemp?: number,
  sunrise?: string,
  sunset?: string,
  isOngoing: boolean = true,
  updateTime?: string
): Promise<void> {
  const parts = [];

  const now = new Date();

  let formattedTime = updateTime;
  if (!formattedTime) {
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = (hours % 12) || 12;
    formattedTime = `${displayHours}:${minutes} ${ampm}`;
  }

  // Find time elapsed in words (simplified version)
  // For persistent notification, it just updated, so it's "Just now" or the current time.
  // Actually, standard behavior for "updated X ago" is handled by the system timestamp
  // but if we want to display it in the body, we can just show the time it was updated.
  // The user asked "show when it got update? Like 5mins ago, 1 hour ago??"
  // Android natively shows "X min" next to the notification if `showTimestamp` is true and `when` is provided.
  // We're already doing `timestamp: Date.now(), showTimestamp: true` below!
  // So Android will automatically handle the "X mins ago" / "X hours ago" in the notification header.

  parts.push(`Updated: ${formattedTime}`);

  if (minTemp !== undefined && maxTemp !== undefined) {
    parts.push(`Min/Max: ${Math.round(minTemp)}°C/${Math.round(maxTemp)}°C`);
  }
  if (sunrise && sunset) {
    parts.push(`Sunrise: ${sunrise} - Sunset: ${sunset}`);
  }

  const bodyText = parts.join(' | ');

  await notifee.displayNotification({
    id: PERSISTENT_NOTIFICATION_ID,
    title: `${Math.round(temp)}°C — ${city}`,
    body: bodyText,
    android: {
      channelId: PERSISTENT_CHANNEL_ID,
      asForegroundService: true, // Requires this to be true if called inside fg service, but ongoing controls if it can be dismissed
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: isOngoing,
      autoCancel: false,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
      category: AndroidCategory.SERVICE,
      timestamp: Date.now(),
      showTimestamp: true,
      onlyAlertOnce: true,
    },
  });
}

const SEVERITY_LABELS: Record<SeverityType, string> = {
  rain: '🌧 Rain',
  snow: '❄️ Snow',
  thunderstorm: '⛈ Thunderstorm',
  fog: '🌫 Fog',
  none: '',
};

export async function clearAlertState(): Promise<void> {
  await AsyncStorage.removeItem(LAST_ALERT_KEY);
}

export async function cancelPersistentNotification(): Promise<void> {
  await notifee.cancelNotification(PERSISTENT_NOTIFICATION_ID);
}

export async function setAndroidSystemAlarm(hour: number, minute: number, message: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': hour,
        'android.intent.extra.alarm.MINUTES': minute,
        'android.intent.extra.alarm.MESSAGE': message,
        'android.intent.extra.alarm.SKIP_UI': true,
      },
    });
  } catch (err) {
    console.error('Failed to set Android system alarm via intent', err);
    throw err;
  }
}
