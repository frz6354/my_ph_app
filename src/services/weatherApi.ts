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
    iconPath = '113.png';
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
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('pls update key');
  }

  // 1. Primary Request to WeatherAPI for current weather, official alerts, location, and initial forecast
  const weatherApiResponse = await axios.get<WeatherResponse>(
    `${BASE_URL}/forecast.json`,
    {
      params: {
        key: apiKey,
        q: city,
        aqi: 'yes',
        alerts: 'yes',
        days: 10,
      },
      timeout: 15000,
    }
  );

  const weatherData = weatherApiResponse.data;
  const lat = weatherData.location.lat;
  const lon = weatherData.location.lon;
  const tz = weatherData.location.tz_id || 'auto';

  // 2. Query Open-Meteo for extended 16-day future forecast and AQI
  try {
    const [openMeteoForecastRes, openMeteoAqiRes] = await Promise.all([
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
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
          timezone: tz,
        },
        timeout: 10000,
      }),
      axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: {
          latitude: lat,
          longitude: lon,
          current: ['us_aqi', 'pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'].join(','),
          timezone: tz,
        },
        timeout: 8000,
      }),
    ]);

    // Attach Open-Meteo AQI details to current air quality object
    if (openMeteoAqiRes.data && openMeteoAqiRes.data.current) {
      const cAqi = openMeteoAqiRes.data.current;
      weatherData.current.air_quality = {
        ...weatherData.current.air_quality,
        us_aqi: cAqi.us_aqi,
        pm2_5: cAqi.pm2_5 ?? weatherData.current.air_quality?.pm2_5,
        pm10: cAqi.pm10 ?? weatherData.current.air_quality?.pm10,
        o3: cAqi.ozone ?? weatherData.current.air_quality?.o3,
        no2: cAqi.nitrogen_dioxide ?? weatherData.current.air_quality?.no2,
        so2: cAqi.sulphur_dioxide ?? weatherData.current.air_quality?.so2,
        co: cAqi.carbon_monoxide ?? weatherData.current.air_quality?.co,
      };
    }

    // Process Open-Meteo 16-day forecast
    if (openMeteoForecastRes.data && openMeteoForecastRes.data.daily) {
      const omDaily = openMeteoForecastRes.data.daily;
      const omHourly = openMeteoForecastRes.data.hourly;
      const daysCount = omDaily.time ? omDaily.time.length : 0;

      const mergedForecastDays: DailyForecastDay[] = [];

      // Existing forecast day map from WeatherAPI (indexed by date string 'YYYY-MM-DD')
      const weatherApiDayMap: Record<string, DailyForecastDay> = {};
      if (weatherData.forecast?.forecastday) {
        for (const fday of weatherData.forecast.forecastday) {
          weatherApiDayMap[fday.date] = fday;
        }
      }

      for (let i = 0; i < daysCount; i++) {
        const dateStr = omDaily.time[i];

        // If WeatherAPI already provides forecast for this date, keep WeatherAPI's data
        if (weatherApiDayMap[dateStr]) {
          mergedForecastDays.push(weatherApiDayMap[dateStr]);
        } else {
          // Beyond WeatherAPI range -> construct forecast day using Open-Meteo data
          const dateEpoch = Math.floor(new Date(dateStr).getTime() / 1000);

          const dayHours: HourlyWeather[] = [];
          if (omHourly && omHourly.time) {
            for (let h = 0; h < omHourly.time.length; h++) {
              if (omHourly.time[h].startsWith(dateStr)) {
                const hIsDay = omHourly.is_day?.[h] ?? 1;
                const hCode = omHourly.weather_code[h];
                const hTemp = omHourly.temperature_2m[h];
                const hAppTemp = omHourly.apparent_temperature[h];

                dayHours.push({
                  time: omHourly.time[h],
                  time_epoch: Math.floor(new Date(omHourly.time[h]).getTime() / 1000),
                  temp_c: hTemp,
                  temp_f: (hTemp * 9) / 5 + 32,
                  is_day: hIsDay,
                  condition: parseWmoCode(hCode, hIsDay),
                  wind_kph: omHourly.wind_speed_10m[h],
                  wind_mph: omHourly.wind_speed_10m[h] * 0.621371,
                  wind_degree: omHourly.wind_direction_10m[h],
                  wind_dir: getWindDirection(omHourly.wind_direction_10m[h]),
                  pressure_mb: omHourly.pressure_msl[h],
                  pressure_in: omHourly.pressure_msl[h] * 0.02953,
                  precip_mm: omHourly.precipitation[h] || 0,
                  precip_in: (omHourly.precipitation[h] || 0) * 0.0393701,
                  humidity: omHourly.relative_humidity_2m[h],
                  cloud: omHourly.cloud_cover[h],
                  feelslike_c: hAppTemp,
                  feelslike_f: (hAppTemp * 9) / 5 + 32,
                  windchill_c: hTemp,
                  windchill_f: (hTemp * 9) / 5 + 32,
                  heatindex_c: hTemp,
                  heatindex_f: (hTemp * 9) / 5 + 32,
                  dewpoint_c: omHourly.dew_point_2m[h],
                  dewpoint_f: (omHourly.dew_point_2m[h] * 9) / 5 + 32,
                  will_it_rain: omHourly.precipitation_probability[h] > 40 ? 1 : 0,
                  chance_of_rain: omHourly.precipitation_probability[h] || 0,
                  will_it_snow: 0,
                  chance_of_snow: 0,
                  vis_km: (omHourly.visibility[h] || 10000) / 1000,
                  vis_miles: ((omHourly.visibility[h] || 10000) / 1000) * 0.621371,
                  gust_kph: omHourly.wind_gusts_10m[h] || omHourly.wind_speed_10m[h],
                  gust_mph: (omHourly.wind_gusts_10m[h] || omHourly.wind_speed_10m[h]) * 0.621371,
                  uv: omHourly.uv_index[h] || 0,
                });
              }
            }
          }

          const maxTemp = omDaily.temperature_2m_max[i];
          const minTemp = omDaily.temperature_2m_min[i];
          const avgTemp = (maxTemp + minTemp) / 2;

          mergedForecastDays.push({
            date: dateStr,
            date_epoch: dateEpoch,
            day: {
              maxtemp_c: maxTemp,
              maxtemp_f: (maxTemp * 9) / 5 + 32,
              mintemp_c: minTemp,
              mintemp_f: (minTemp * 9) / 5 + 32,
              avgtemp_c: avgTemp,
              avgtemp_f: (avgTemp * 9) / 5 + 32,
              maxwind_kph: omDaily.wind_speed_10m_max[i],
              maxwind_mph: omDaily.wind_speed_10m_max[i] * 0.621371,
              totalprecip_mm: omDaily.precipitation_sum[i] || 0,
              totalprecip_in: (omDaily.precipitation_sum[i] || 0) * 0.0393701,
              totalsnow_cm: 0,
              avgvis_km: 10,
              avgvis_miles: 6.2,
              avghumidity: weatherData.current.humidity,
              daily_will_it_rain: (omDaily.precipitation_probability_max?.[i] || 0) > 40 ? 1 : 0,
              daily_will_it_snow: 0,
              daily_chance_of_rain: omDaily.precipitation_probability_max?.[i] || 0,
              daily_chance_of_snow: 0,
              condition: parseWmoCode(omDaily.weather_code[i], 1),
              uv: omDaily.uv_index_max?.[i] || 0,
            },
            astro: {
              sunrise: formatAstroTime(omDaily.sunrise?.[i]),
              sunset: formatAstroTime(omDaily.sunset?.[i]),
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
      }

      weatherData.forecast = {
        forecastday: mergedForecastDays,
      };
    }
  } catch (err) {
    console.warn('[WeatherApi] Extended Open-Meteo forecast fetch error:', err);
  }

  return weatherData;
}
