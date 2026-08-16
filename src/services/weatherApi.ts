import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORE_KEY = '@weather_api_key';
const BASE_URL = 'https://api.weatherapi.com/v1';

export async function getApiKey(): Promise<string | null> {
  try {
    const key = await AsyncStorage.getItem(API_KEY_STORE_KEY);
    if (key) return key;
  } catch (e) {
    console.error('Error fetching API key from AsyncStorage', e);
  }
  return process.env.EXPO_PUBLIC_WEATHER_API_KEY || null;
}

export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORE_KEY, key);
}

export async function removeApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY_STORE_KEY);
}

export interface WeatherCondition {
  text: string;
  icon?: string;
  code: number;
}

export interface CurrentWeather {
  temp_c: number;
  temp_f: number;
  condition: WeatherCondition;
  wind_kph: number;
  wind_mph: number;
  wind_degree: number;
  wind_dir: string;
  pressure_mb: number;
  pressure_in: number;
  precip_mm: number;
  precip_in: number;
  humidity: number;
  cloud: number;
  is_day: number;
  feelslike_c: number;
  feelslike_f: number;
  vis_km: number;
  vis_miles: number;
  uv: number;
  gust_kph: number;
  gust_mph: number;
}

export interface WeatherAlert {
  headline: string;
  severity: string;
  event: string;
  desc: string;
}

export interface HourlyWeather {
  time: string;
  time_epoch: number;
  temp_c: number;
  temp_f: number;
  is_day: number;
  condition: WeatherCondition;
  wind_kph: number;
  wind_mph: number;
  wind_degree: number;
  wind_dir: string;
  pressure_mb: number;
  pressure_in: number;
  precip_mm: number;
  precip_in: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  feelslike_f: number;
  windchill_c: number;
  windchill_f: number;
  heatindex_c: number;
  heatindex_f: number;
  dewpoint_c: number;
  dewpoint_f: number;
  will_it_rain: number;
  chance_of_rain: number;
  will_it_snow: number;
  chance_of_snow: number;
  vis_km: number;
  vis_miles: number;
  gust_kph: number;
  gust_mph: number;
  uv: number;
}

export interface WeatherResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
  };
  current: CurrentWeather;
  forecast?: {
    forecastday: {
      date: string;
      date_epoch: number;
      day: {
        maxtemp_c: number;
        maxtemp_f: number;
        mintemp_c: number;
        mintemp_f: number;
        avgtemp_c: number;
        avgtemp_f: number;
        maxwind_kph: number;
        maxwind_mph: number;
        totalprecip_mm: number;
        totalprecip_in: number;
        totalsnow_cm: number;
        avgvis_km: number;
        avgvis_miles: number;
        avghumidity: number;
        daily_will_it_rain: number;
        daily_will_it_snow: number;
        daily_chance_of_rain: number;
        daily_chance_of_snow: number;
        condition: WeatherCondition;
        uv: number;
      };
      astro: {
        sunrise: string;
        sunset: string;
        moonrise: string;
        moonset: string;
        moon_phase: string;
        moon_illumination: number;
        is_moon_up: number;
        is_sun_up: number;
      };
      hour: HourlyWeather[];
    }[];
  };
  alerts?: {
    alert: WeatherAlert[];
  };
}

// Severity categories mapped from WeatherAPI condition codes
export type SeverityType = 'rain' | 'snow' | 'thunderstorm' | 'fog' | 'none';

const RAIN_CODES = [1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246];
const SNOW_CODES = [1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264];
const THUNDERSTORM_CODES = [1087, 1273, 1276, 1279, 1282];
const FOG_CODES = [1135, 1147];

export function getSeverityType(conditionCode: number): SeverityType {
  if (THUNDERSTORM_CODES.includes(conditionCode)) return 'thunderstorm';
  if (SNOW_CODES.includes(conditionCode)) return 'snow';
  if (RAIN_CODES.includes(conditionCode)) return 'rain';
  if (FOG_CODES.includes(conditionCode)) return 'fog';
  return 'none';
}

export function isSevere(conditionCode: number): boolean {
  return getSeverityType(conditionCode) !== 'none';
}

export async function fetchWeather(city: string): Promise<WeatherResponse> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('pls update key');
  }

  const response = await axios.get<WeatherResponse>(
    `${BASE_URL}/forecast.json`,
    {
      params: {
        key: apiKey,
        q: city,
        aqi: 'no',
        alerts: 'yes',
        days: 10,
      },
      timeout: 15000,
    }
  );
  return response.data;
}
