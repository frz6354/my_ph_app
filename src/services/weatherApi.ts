import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORE_KEY = '@weather_api_key';

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

export interface AirQuality {
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  pm2_5?: number;
  pm10?: number;
  'us-epa-index'?: number;
  'gb-defra-index'?: number;
  us_aqi?: number;
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
  air_quality?: AirQuality;
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

export interface DailyForecastDay {
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
    forecastday: DailyForecastDay[];
  };
  alerts?: {
    alert: WeatherAlert[];
  };
}

export type SeverityType = 'rain' | 'snow' | 'thunderstorm' | 'fog' | 'none';

const THUNDERSTORM_WMO_CODES = [95, 96, 99];
const SNOW_WMO_CODES = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86];
const RAIN_WMO_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82];
const FOG_WMO_CODES = [45, 48];

export function getSeverityType(conditionCode: number): SeverityType {
  if (THUNDERSTORM_WMO_CODES.includes(conditionCode)) return 'thunderstorm';
  if (SNOW_WMO_CODES.includes(conditionCode)) return 'snow';
  if (RAIN_WMO_CODES.includes(conditionCode)) return 'rain';
  if (FOG_WMO_CODES.includes(conditionCode)) return 'fog';
  return 'none';
}

export function isSevere(conditionCode: number): boolean {
  return getSeverityType(conditionCode) !== 'none';
}

function getWindDirection(degree: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degree / 22.5) % 16;
  return directions[index] || 'N';
}

function parseWmoCode(code: number, isDay: number = 1): WeatherCondition {
  let text = 'Clear';
  let iconPath = '113.png';

  if (code === 0) {
    text = isDay ? 'Sunny' : 'Clear';
    iconPath = isDay ? '113.png' : '113.png';
  } else if (code === 1) {
    text = 'Mainly Clear';
    iconPath = '116.png';
  } else if (code === 2) {
    text = 'Partly Cloudy';
    iconPath = '116.png';
  } else if (code === 3) {
    text = 'Overcast';
    iconPath = '122.png';
  } else if (code === 45 || code === 48) {
    text = 'Foggy';
    iconPath = '248.png';
  } else if (code >= 51 && code <= 55) {
    text = 'Drizzle';
    iconPath = '266.png';
  } else if (code === 56 || code === 57) {
    text = 'Freezing Drizzle';
    iconPath = '281.png';
  } else if (code >= 61 && code <= 65) {
    text = 'Rain';
    iconPath = '296.png';
  } else if (code === 66 || code === 67) {
    text = 'Freezing Rain';
    iconPath = '311.png';
  } else if (code >= 71 && code <= 77) {
    text = 'Snow';
    iconPath = '338.png';
  } else if (code >= 80 && code <= 82) {
    text = 'Rain Showers';
    iconPath = '353.png';
  } else if (code === 85 || code === 86) {
    text = 'Snow Showers';
    iconPath = '371.png';
  } else if (code >= 95 && code <= 99) {
    text = 'Thunderstorm';
    iconPath = '389.png';
  }

  const timeDir = isDay ? 'day' : 'night';
  return {
    text,
    icon: `//cdn.weatherapi.com/weather/64x64/${timeDir}/${iconPath}`,
    code,
  };
}

function getUsEpaIndex(usAqi?: number): number | undefined {
  if (usAqi === undefined) return undefined;
  if (usAqi <= 50) return 1;
  if (usAqi <= 100) return 2;
  if (usAqi <= 150) return 3;
  if (usAqi <= 200) return 4;
  if (usAqi <= 300) return 5;
  return 6;
}

function formatAstroTime(isoString?: string): string {
  if (!isoString) return '6:00 AM';
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export async function fetchWeather(city: string): Promise<WeatherResponse> {
  // 1. Geocoding search using Open-Meteo Geocoding API
  const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: {
      name: city,
      count: 1,
      language: 'en',
      format: 'json',
    },
    timeout: 10000,
  });

  if (!geoRes.data || !geoRes.data.results || geoRes.data.results.length === 0) {
    throw new Error('Location not found.');
  }

  const locationData = geoRes.data.results[0];
  const { latitude: lat, longitude: lon, name, country, admin1, timezone } = locationData;

  // 2. Fetch Open-Meteo Weather Forecast (16 days)
  const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'pressure_msl',
        'cloud_cover',
        'visibility',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'uv_index',
        'is_day',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      forecast_days: 16,
      timezone: timezone || 'auto',
    },
    timeout: 15000,
  });

  // 3. Fetch Air Quality Index from Open-Meteo AQI API
  let airQualityData: AirQuality | undefined = undefined;
  try {
    const aqiRes = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
      params: {
        latitude: lat,
        longitude: lon,
        current: ['us_aqi', 'pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'].join(','),
        timezone: timezone || 'auto',
      },
      timeout: 8000,
    });

    if (aqiRes.data && aqiRes.data.current) {
      const cAqi = aqiRes.data.current;
      airQualityData = {
        us_aqi: cAqi.us_aqi,
        co: cAqi.carbon_monoxide,
        no2: cAqi.nitrogen_dioxide,
        o3: cAqi.ozone,
        so2: cAqi.sulphur_dioxide,
        pm2_5: cAqi.pm2_5,
        pm10: cAqi.pm10,
        'us-epa-index': getUsEpaIndex(cAqi.us_aqi),
      };
    }
  } catch (aqiErr) {
    console.warn('[WeatherApi] AQI fetch error:', aqiErr);
  }

  const data = weatherRes.data;
  const currentRaw = data.current;
  const dailyRaw = data.daily;
  const hourlyRaw = data.hourly;

  const isDayVal = currentRaw.is_day ?? 1;
  const currentWeather: CurrentWeather = {
    temp_c: currentRaw.temperature_2m,
    temp_f: (currentRaw.temperature_2m * 9) / 5 + 32,
    condition: parseWmoCode(currentRaw.weather_code, isDayVal),
    wind_kph: currentRaw.wind_speed_10m,
    wind_mph: currentRaw.wind_speed_10m * 0.621371,
    wind_degree: currentRaw.wind_direction_10m,
    wind_dir: getWindDirection(currentRaw.wind_direction_10m),
    pressure_mb: currentRaw.pressure_msl,
    pressure_in: currentRaw.pressure_msl * 0.02953,
    precip_mm: currentRaw.precipitation || 0,
    precip_in: (currentRaw.precipitation || 0) * 0.0393701,
    humidity: currentRaw.relative_humidity_2m,
    cloud: currentRaw.cloud_cover,
    is_day: isDayVal,
    feelslike_c: currentRaw.apparent_temperature,
    feelslike_f: (currentRaw.apparent_temperature * 9) / 5 + 32,
    vis_km: (hourlyRaw?.visibility?.[0] || 10000) / 1000,
    vis_miles: ((hourlyRaw?.visibility?.[0] || 10000) / 1000) * 0.621371,
    uv: dailyRaw?.uv_index_max?.[0] || 0,
    gust_kph: currentRaw.wind_gusts_10m || currentRaw.wind_speed_10m,
    gust_mph: (currentRaw.wind_gusts_10m || currentRaw.wind_speed_10m) * 0.621371,
    air_quality: airQualityData,
  };

  // Construct forecast days (up to 16)
  const forecastday: DailyForecastDay[] = [];
  const daysCount = dailyRaw.time ? dailyRaw.time.length : 0;

  for (let i = 0; i < daysCount; i++) {
    const dateStr = dailyRaw.time[i];
    const dateEpoch = Math.floor(new Date(dateStr).getTime() / 1000);

    // Group hourly items for this day
    const dayHours: HourlyWeather[] = [];
    if (hourlyRaw && hourlyRaw.time) {
      for (let h = 0; h < hourlyRaw.time.length; h++) {
        if (hourlyRaw.time[h].startsWith(dateStr)) {
          const hIsDay = hourlyRaw.is_day?.[h] ?? 1;
          const hCode = hourlyRaw.weather_code[h];
          const hTemp = hourlyRaw.temperature_2m[h];
          const hAppTemp = hourlyRaw.apparent_temperature[h];

          dayHours.push({
            time: hourlyRaw.time[h],
            time_epoch: Math.floor(new Date(hourlyRaw.time[h]).getTime() / 1000),
            temp_c: hTemp,
            temp_f: (hTemp * 9) / 5 + 32,
            is_day: hIsDay,
            condition: parseWmoCode(hCode, hIsDay),
            wind_kph: hourlyRaw.wind_speed_10m[h],
            wind_mph: hourlyRaw.wind_speed_10m[h] * 0.621371,
            wind_degree: hourlyRaw.wind_direction_10m[h],
            wind_dir: getWindDirection(hourlyRaw.wind_direction_10m[h]),
            pressure_mb: hourlyRaw.pressure_msl[h],
            pressure_in: hourlyRaw.pressure_msl[h] * 0.02953,
            precip_mm: hourlyRaw.precipitation[h] || 0,
            precip_in: (hourlyRaw.precipitation[h] || 0) * 0.0393701,
            humidity: hourlyRaw.relative_humidity_2m[h],
            cloud: hourlyRaw.cloud_cover[h],
            feelslike_c: hAppTemp,
            feelslike_f: (hAppTemp * 9) / 5 + 32,
            windchill_c: hTemp,
            windchill_f: (hTemp * 9) / 5 + 32,
            heatindex_c: hTemp,
            heatindex_f: (hTemp * 9) / 5 + 32,
            dewpoint_c: hourlyRaw.dew_point_2m[h],
            dewpoint_f: (hourlyRaw.dew_point_2m[h] * 9) / 5 + 32,
            will_it_rain: hourlyRaw.precipitation_probability[h] > 40 ? 1 : 0,
            chance_of_rain: hourlyRaw.precipitation_probability[h] || 0,
            will_it_snow: 0,
            chance_of_snow: 0,
            vis_km: (hourlyRaw.visibility[h] || 10000) / 1000,
            vis_miles: ((hourlyRaw.visibility[h] || 10000) / 1000) * 0.621371,
            gust_kph: hourlyRaw.wind_gusts_10m[h] || hourlyRaw.wind_speed_10m[h],
            gust_mph: (hourlyRaw.wind_gusts_10m[h] || hourlyRaw.wind_speed_10m[h]) * 0.621371,
            uv: hourlyRaw.uv_index[h] || 0,
          });
        }
      }
    }

    const maxTemp = dailyRaw.temperature_2m_max[i];
    const minTemp = dailyRaw.temperature_2m_min[i];
    const avgTemp = (maxTemp + minTemp) / 2;

    forecastday.push({
      date: dateStr,
      date_epoch: dateEpoch,
      day: {
        maxtemp_c: maxTemp,
        maxtemp_f: (maxTemp * 9) / 5 + 32,
        mintemp_c: minTemp,
        mintemp_f: (minTemp * 9) / 5 + 32,
        avgtemp_c: avgTemp,
        avgtemp_f: (avgTemp * 9) / 5 + 32,
        maxwind_kph: dailyRaw.wind_speed_10m_max[i],
        maxwind_mph: dailyRaw.wind_speed_10m_max[i] * 0.621371,
        totalprecip_mm: dailyRaw.precipitation_sum[i] || 0,
        totalprecip_in: (dailyRaw.precipitation_sum[i] || 0) * 0.0393701,
        totalsnow_cm: 0,
        avgvis_km: 10,
        avgvis_miles: 6.2,
        avghumidity: currentRaw.relative_humidity_2m,
        daily_will_it_rain: (dailyRaw.precipitation_probability_max?.[i] || 0) > 40 ? 1 : 0,
        daily_will_it_snow: 0,
        daily_chance_of_rain: dailyRaw.precipitation_probability_max?.[i] || 0,
        daily_chance_of_snow: 0,
        condition: parseWmoCode(dailyRaw.weather_code[i], 1),
        uv: dailyRaw.uv_index_max?.[i] || 0,
      },
      astro: {
        sunrise: formatAstroTime(dailyRaw.sunrise?.[i]),
        sunset: formatAstroTime(dailyRaw.sunset?.[i]),
        moonrise: '7:00 PM',
        moonset: '6:00 AM',
        moon_phase: 'Waxing Crescent',
        moon_illumination: 50,
        is_moon_up: 1,
        is_sun_up: 1,
      },
      hour: dayHours,
    });
  }

  const nowEpoch = Math.floor(Date.now() / 1000);
  const localTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

  return {
    location: {
      name: name,
      region: admin1 || '',
      country: country || '',
      lat: lat,
      lon: lon,
      tz_id: timezone || 'UTC',
      localtime_epoch: nowEpoch,
      localtime: localTimeStr,
    },
    current: currentWeather,
    forecast: {
      forecastday,
    },
    alerts: {
      alert: [],
    },
  };
}
