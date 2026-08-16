import notifee, { AndroidNotificationSettings, AndroidForegroundServiceType, TriggerType, TimeUnit, AlarmType, TimestampTrigger } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundFetch from 'react-native-background-fetch';
import { Platform } from 'react-native';
import {
  fetchWeather,
  getSeverityType,
  isSevere,
  WeatherResponse,
} from '../services/weatherApi';
import {
  updatePersistentNotification,
  sendAlarmNotification,
  cancelPersistentNotification,
  setAndroidSystemAlarm,
} from '../services/notifications';
import { getAlarmSettings } from '../services/alarmApi';

const ZIP_CODES_KEY = '@weather_zip_codes';
const DEFAULT_ZIP_KEY = '@weather_default_zip';
const CITY_LIST_KEY = '@weather_city_list';
const WEATHER_DATA_MAP_KEY = '@weather_data_map';
const LAST_ALARMS_DATE_KEY = '@weather_last_alarms_date';
const LAST_SYSTEM_ALARM_TIMES_KEY = '@weather_last_system_alarm_times';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function getZipCodes(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ZIP_CODES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function getCityList(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CITY_LIST_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      // fallback
    }
  }
  const defaultCities = ['Prague', 'London', 'Tokyo', 'New York'];
  const zips = await getZipCodes();
  const initial = Array.from(new Set([...defaultCities, ...zips]));
  await saveCityList(initial);
  return initial;
}

export async function saveCityList(cities: string[]): Promise<void> {
  await AsyncStorage.setItem(CITY_LIST_KEY, JSON.stringify(cities));
}

export async function addZipCode(zip: string): Promise<void> {
  const codes = await getZipCodes();
  if (!codes.includes(zip)) {
    codes.push(zip);
    await AsyncStorage.setItem(ZIP_CODES_KEY, JSON.stringify(codes));
  }
  const cityList = await getCityList();
  if (!cityList.includes(zip)) {
    cityList.push(zip);
    await saveCityList(cityList);
  }
}

export async function removeZipCode(zip: string): Promise<void> {
  let codes = await getZipCodes();
  codes = codes.filter(c => c !== zip);
  await AsyncStorage.setItem(ZIP_CODES_KEY, JSON.stringify(codes));

  let cityList = await getCityList();
  cityList = cityList.filter(c => c !== zip && c.toLowerCase() !== zip.toLowerCase());
  await saveCityList(cityList);

  // if removing default zip code, set a new default or null
  const defaultZip = await getDefaultZipCode();
  if (defaultZip === zip) {
    if (cityList.length > 0) {
      await setDefaultZipCode(cityList[0]);
    } else {
      await AsyncStorage.removeItem(DEFAULT_ZIP_KEY);
    }
  }
}

export async function getDefaultZipCode(): Promise<string | null> {
  return AsyncStorage.getItem(DEFAULT_ZIP_KEY);
}

export async function setDefaultZipCode(zip: string): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_ZIP_KEY, zip);
}

export async function getWeatherMap(): Promise<Record<string, WeatherResponse>> {
  const raw = await AsyncStorage.getItem(WEATHER_DATA_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, WeatherResponse>;
  } catch {
    return {};
  }
}

async function saveWeatherMap(map: Record<string, WeatherResponse>): Promise<void> {
  await AsyncStorage.setItem(WEATHER_DATA_MAP_KEY, JSON.stringify(map));
}

export const getStoredCity = getDefaultZipCode;

function parseAstroTime(timeStr: string): Date {
  const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
  const now = new Date();
  if (!match) return now;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;

  now.setHours(h, m, 0, 0);
  return now;
}

export async function runWeatherCheck(): Promise<Record<string, WeatherResponse> | null> {
  try {
    const zipCodes = await getZipCodes();
    if (zipCodes.length === 0) return null;

    const weatherMap: Record<string, WeatherResponse> = {};
    const defaultZip = await getDefaultZipCode();
    let defaultWeather: WeatherResponse | null = null;
    const alarmSettings = await getAlarmSettings();

    for (const zip of zipCodes) {
      try {
        const weather = await fetchWeather(zip);
        weatherMap[zip] = weather;

        if (zip === defaultZip || (!defaultZip && zip === zipCodes[0])) {
          defaultWeather = weather;
        }
      } catch (err: any) {
        console.error(`[WeatherTask] Error fetching for zip ${zip}:`, err);
        if (err.message === 'pls update key') {
          throw err;
        }
      }
    }

    await saveWeatherMap(weatherMap);

    // Persistent notification logic
    if (defaultWeather && alarmSettings.isPersistent) {
      let minTemp, maxTemp, sunrise, sunset;
      if (defaultWeather.forecast?.forecastday?.length) {
        const day = defaultWeather.forecast.forecastday[0];
        minTemp = day.day.mintemp_c;
        maxTemp = day.day.maxtemp_c;
        sunrise = day.astro.sunrise;
        sunset = day.astro.sunset;
      }

      await updatePersistentNotification(
        defaultWeather.current.temp_c,
        defaultWeather.location.name,
        defaultWeather.current.condition.text,
        minTemp,
        maxTemp,
        sunrise,
        sunset,
        true // always ongoing when isPersistent is enabled
      );
    } else if (!alarmSettings.isPersistent) {
      // Persistent notification is disabled — cancel it if it exists
      await cancelPersistentNotification();
    }

    // Alarm logic
    if (alarmSettings.alarms && alarmSettings.alarms.length > 0 && defaultWeather) {
      const todayDateStr = new Date().toDateString();

      const lastAlarmsRaw = await AsyncStorage.getItem(LAST_ALARMS_DATE_KEY);
      let lastAlarmsDate: Record<string, string> = {};
      if (lastAlarmsRaw) {
        try {
          lastAlarmsDate = JSON.parse(lastAlarmsRaw);
        } catch (e) {
          console.warn('Could not parse last alarms date', e);
        }
      }

      let datesUpdated = false;

      for (const alarm of alarmSettings.alarms) {
        if (alarm.type === 'none') continue;

        const lastFired = lastAlarmsDate[alarm.id];

        if (lastFired !== todayDateStr) {
          let targetTime: Date | null = null;

          if (alarm.type === 'custom') {
            targetTime = parseAstroTime(alarm.customTime);
          } else if (defaultWeather.forecast?.forecastday?.length) {
            const astro = defaultWeather.forecast.forecastday[0].astro;
            if (alarm.type === 'sunrise' || alarm.type === 'sunrise_offset') {
              targetTime = parseAstroTime(astro.sunrise);
            } else if (alarm.type === 'sunset' || alarm.type === 'sunset_offset') {
              targetTime = parseAstroTime(astro.sunset);
            }

            if (targetTime && (alarm.type === 'sunrise_offset' || alarm.type === 'sunset_offset')) {
              targetTime.setMinutes(targetTime.getMinutes() + alarm.offsetMinutes);
            }
          }

          if (targetTime) {
            const now = new Date();
            if (now >= targetTime) {
               const diffMs = now.getTime() - targetTime.getTime();
               if (diffMs < 30 * 60 * 1000) {
                  const hours = targetTime.getHours();
                  const mins = targetTime.getMinutes().toString().padStart(2, '0');
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = (hours % 12) || 12;
                  const alarmTimeStr = `${displayHours}:${mins} ${ampm}`;

                  let alarmTypeDetail = '';
                  if (alarm.type === 'custom') {
                    alarmTypeDetail = 'Custom Time';
                  } else if (alarm.type === 'sunrise') {
                    alarmTypeDetail = 'Sunrise';
                  } else if (alarm.type === 'sunset') {
                    alarmTypeDetail = 'Sunset';
                  } else if (alarm.type === 'sunrise_offset') {
                    const dir = alarm.offsetMinutes < 0 ? 'Before' : 'After';
                    alarmTypeDetail = `${Math.abs(alarm.offsetMinutes)} mins ${dir} Sunrise`;
                  } else if (alarm.type === 'sunset_offset') {
                    const dir = alarm.offsetMinutes < 0 ? 'Before' : 'After';
                    alarmTypeDetail = `${Math.abs(alarm.offsetMinutes)} mins ${dir} Sunset`;
                  }

                  const detailText = `Set for: ${alarmTimeStr} (${alarmTypeDetail})`;

                  await sendAlarmNotification(
                    alarm.sound,
                    'Weather Alarm',
                    `It's time! Current temp: ${Math.round(defaultWeather.current.temp_c)}°C in ${defaultWeather.location.name}\n${detailText}`
                  );
                  lastAlarmsDate[alarm.id] = todayDateStr;
                  datesUpdated = true;
               }
            }
          }
        }
      }

      if (datesUpdated) {
        await AsyncStorage.setItem(LAST_ALARMS_DATE_KEY, JSON.stringify(lastAlarmsDate));
      }
    }

    if (Platform.OS === 'android') {
      try {
        await syncSystemAlarms();
      } catch (e) {
        console.warn('Failed to sync system alarms in runWeatherCheck', e);
      }
    }

    return weatherMap;
  } catch (error: any) {
    console.error('[WeatherTask] Error:', error);
    if (error.message === 'pls update key') {
      throw error;
    }
    return null;
  }
}


export async function syncSystemAlarms(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const alarmSettings = await getAlarmSettings();
  if (!alarmSettings.alarms || alarmSettings.alarms.length === 0) return;

  // Try to get default weather to compute astronomical times
  const defaultZip = await getDefaultZipCode();
  const weatherMap = await getWeatherMap();
  const defaultWeather = defaultZip ? weatherMap[defaultZip] : null;

  const lastTimesRaw = await AsyncStorage.getItem(LAST_SYSTEM_ALARM_TIMES_KEY);
  let lastTimes: Record<string, string> = {};
  if (lastTimesRaw) {
    try {
      lastTimes = JSON.parse(lastTimesRaw);
    } catch {
      // ignore
    }
  }

  let updated = false;

  for (const alarm of alarmSettings.alarms) {
    if (!alarm.useSystemAlarm || alarm.type === 'none') continue;

    let targetTime: Date | null = null;

    if (alarm.type === 'custom') {
      targetTime = parseAstroTime(alarm.customTime);
    } else if (defaultWeather && defaultWeather.forecast?.forecastday?.length) {
      const astro = defaultWeather.forecast.forecastday[0].astro;
      if (alarm.type === 'sunrise' || alarm.type === 'sunrise_offset') {
        targetTime = parseAstroTime(astro.sunrise);
      } else if (alarm.type === 'sunset' || alarm.type === 'sunset_offset') {
        targetTime = parseAstroTime(astro.sunset);
      }

      if (targetTime && (alarm.type === 'sunrise_offset' || alarm.type === 'sunset_offset')) {
        targetTime.setMinutes(targetTime.getMinutes() + alarm.offsetMinutes);
      }
    }

    if (targetTime) {
      const targetTimeStr = targetTime.toISOString();
      if (lastTimes[alarm.id] === targetTimeStr) {
        // Already scheduled for this exact target time, skip to avoid flooding!
        continue;
      }

      const hour = targetTime.getHours();
      const minute = targetTime.getMinutes();
      let label = 'Weather Alarm';
      if (alarm.type === 'custom') {
        label = `Weather Alarm: Custom ${alarm.customTime}`;
      } else if (alarm.type === 'sunrise') {
        label = 'Weather Alarm: Sunrise';
      } else if (alarm.type === 'sunset') {
        label = 'Weather Alarm: Sunset';
      } else if (alarm.type === 'sunrise_offset') {
        label = 'Weather Alarm: Sunrise Offset';
      } else if (alarm.type === 'sunset_offset') {
        label = 'Weather Alarm: Sunset Offset';
      }
      try {
        await setAndroidSystemAlarm(hour, minute, label);
        lastTimes[alarm.id] = targetTimeStr;
        updated = true;
      } catch (e) {
        console.error('[syncSystemAlarms] Error setting alarm:', e);
      }
    }
  }

  if (updated) {
    await AsyncStorage.setItem(LAST_SYSTEM_ALARM_TIMES_KEY, JSON.stringify(lastTimes));
  }
}

let foregroundInterval: ReturnType<typeof setInterval> | null = null;

if (Platform.OS === 'android') {
  // Register foreground service runner in the global scope
  notifee.registerForegroundService(() => {
    return new Promise(() => {
      if (foregroundInterval) clearInterval(foregroundInterval);

      // This promise intentionally never resolves — keeps the service alive
      // Run immediately
      runWeatherCheck();
      scheduleNextWeatherCheck();
    });
  });
}

export async function scheduleNextWeatherCheck(): Promise<void> {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + POLL_INTERVAL,
    alarmManager: {
      type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
    },
  };

  await notifee.createTriggerNotification({
    id: 'weather-current',
    title: 'Updating Weather...',
    body: 'Checking weather...',
    data: { internalTrigger: 'true' },
    android: {
      channelId: 'weather-persistent',
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      onlyAlertOnce: true,
    }
  }, trigger);
}

export async function startForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const alarmSettings = await getAlarmSettings();

  // Start the service with an initial notification
  const city = await getStoredCity();
  await scheduleNextWeatherCheck();

  await notifee.displayNotification({
    id: 'weather-current',
    title: `Weather — ${city || 'Loading...'}`,
    body: 'Checking weather...',
    android: {
      channelId: 'weather-persistent',
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: alarmSettings.isPersistent,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
      onlyAlertOnce: true,
    },
  });
}

export function stopForegroundInterval(): void {
  if (foregroundInterval) {
    clearInterval(foregroundInterval);
    foregroundInterval = null;
  }
  notifee.cancelTriggerNotification('weather-current');
}

export async function stopForegroundService(): Promise<void> {
  stopForegroundInterval();
  await cancelPersistentNotification();
  if (Platform.OS === 'android') {
    await notifee.stopForegroundService();
  }
}

export async function initBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15, // minimum allowed interval in minutes
        stopOnTerminate: false,   // continue after app is killed
        startOnBoot: true,        // restart after device reboot
        enableHeadless: true,     // allow headless execution on Android
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      async (taskId) => {
        // This callback fires when a background fetch event occurs
        console.log('[BackgroundFetch] Event received:', taskId);
        try {
          await runWeatherCheck();
        } catch (e) {
          console.error('[BackgroundFetch] Error during weather check:', e);
        }
        BackgroundFetch.finish(taskId);
      },
      async (taskId) => {
        // Timeout callback — OS is forcing us to stop
        console.warn('[BackgroundFetch] Timeout:', taskId);
        BackgroundFetch.finish(taskId);
      }
    );
    console.log('[BackgroundFetch] Configure status:', status);
  } catch (e) {
    console.error('[BackgroundFetch] Failed to configure:', e);
  }
}

// Register Android headless task — runs even when app process is dead
const headlessTask = async (event: { taskId: string; timeout: boolean }) => {
  const { taskId, timeout } = event;
  if (timeout) {
    console.warn('[BackgroundFetch Headless] Timeout:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }
  console.log('[BackgroundFetch Headless] Event:', taskId);
  try {
    await runWeatherCheck();
  } catch (e) {
    console.error('[BackgroundFetch Headless] Error:', e);
  }
  BackgroundFetch.finish(taskId);
};

BackgroundFetch.registerHeadlessTask(headlessTask);
