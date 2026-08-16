import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  DeviceEventEmitter,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  getZipCodes,
  getDefaultZipCode,
  getWeatherMap,
  runWeatherCheck,
} from '../tasks/weatherTask';
import {
  WeatherResponse,
  getSeverityType,
  SeverityType,
} from '../services/weatherApi';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation?: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const [zipCodes, setZipCodes] = useState<string[]>([]);
  const [defaultZip, setDefaultZip] = useState<string | null>(null);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherResponse>>({});

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = async () => {
    const codes = await getZipCodes();
    const defZip = await getDefaultZipCode();
    const wMap = await getWeatherMap();
    setZipCodes(codes);
    setDefaultZip(defZip);
    setWeatherMap(wMap);
    if (Object.keys(wMap).length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  // Load stored zips + weather map on mount
  useEffect(() => {
    loadData();
    const subscription = DeviceEventEmitter.addListener('zip_changed', () => {
      loadData();
    });
    return () => subscription.remove();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const resultMap = await runWeatherCheck();
      if (resultMap) {
        setWeatherMap(resultMap);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (e: any) {
      if (e.message === 'pls update key') {
        setError('pls update key');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const defaultWeather = defaultZip ? weatherMap[defaultZip] : null;

  const copyToClipboard = async () => {
    if (defaultWeather) {
      await Clipboard.setStringAsync(JSON.stringify(defaultWeather, null, 2));
      Alert.alert('Success', 'Copied entire weather JSON to clipboard!');
    }
  };

  const severity: SeverityType = defaultWeather
    ? getSeverityType(defaultWeather.current.condition.code)
    : 'none';

  const bgColor =
    severity === 'thunderstorm'
      ? '#2c2c54'
      : severity === 'rain'
      ? '#485460'
      : severity === 'snow'
      ? '#dfe6e9'
      : severity === 'fog'
      ? '#b2bec3'
      : '#0984e3';

  const textColor = severity === 'snow' ? '#2d3436' : '#ffffff';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar translucent={false} barStyle={severity === 'snow' ? 'dark-content' : 'light-content'} />

      <Text style={[styles.title, { color: textColor }]}>Weather Alerts</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty State */}
      {zipCodes.length === 0 && (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Welcome to Weather Alerts! 🌤️</Text>
          <Text style={styles.emptyStateText}>
            Open the side menu to add a zip code and start monitoring local weather conditions.
          </Text>
        </View>
      )}

      {/* Default Weather Details */}
      {defaultWeather && (
        <>
          {/* Main Weather Card */}
          <View style={styles.weatherCard}>
            <Text style={styles.cityName}>{defaultWeather.location.name}</Text>
            <Text style={styles.region}>
              {defaultWeather.location.region}, {defaultWeather.location.country}
            </Text>

            {defaultWeather.current.condition.icon && (
              <Image
                source={{ uri: `https:${defaultWeather.current.condition.icon}` }}
                style={styles.conditionIcon}
              />
            )}

            <Text style={styles.temp}>
              {Math.round(defaultWeather.current.temp_c)}°C / {Math.round(defaultWeather.current.temp_f)}°F
            </Text>
            <Text style={styles.condition}>{defaultWeather.current.condition.text}</Text>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Feels Like</Text>
                <Text style={styles.detailValue}>
                  {Math.round(defaultWeather.current.feelslike_c)}°C / {Math.round(defaultWeather.current.feelslike_f)}°F
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Humidity</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.humidity}%</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Wind</Text>
                <Text style={styles.detailValue}>
                  {Math.round(defaultWeather.current.wind_kph)} km/h
                </Text>
              </View>
            </View>

            {/* Sunrise and Sunset times in the main section */}
            {defaultWeather.forecast?.forecastday?.[0] && (
              <View style={[styles.detailsRow, styles.astroRow]}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Sunrise 🌅</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].astro.sunrise}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Sunset 🌇</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].astro.sunset}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              style={styles.rawJsonButton}
              accessibilityLabel="Show raw API JSON modal"
            >
              <Ionicons name="code-working-outline" size={16} color={textColor} style={{ marginRight: 6 }} />
              <Text style={[styles.rawJsonButtonText, { color: textColor }]}>View Raw JSON</Text>
            </TouchableOpacity>
          </View>

          {/* Hourly Forecast Section */}
          {defaultWeather.forecast?.forecastday?.[0]?.hour && (
            <View style={styles.hourlyCard}>
              <Text style={styles.cardSectionTitle}>Hourly Forecast</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCellHeader, { flex: 1, color: textColor }]}>Time</Text>
                  <Text style={[styles.tableCellHeader, { flex: 1.5, textAlign: 'center', color: textColor }]}>Condition</Text>
                  <Text style={[styles.tableCellHeader, { flex: 1, textAlign: 'right', color: textColor }]}>Temp</Text>
                </View>
                {/* Table Body */}
                {defaultWeather.forecast.forecastday[0].hour.map((h, idx) => {
                  const timePart = h.time.split(' ')[1] || h.time;
                  const [hourStr, minStr] = timePart.split(':');
                  const hourInt = parseInt(hourStr, 10);
                  const ampm = hourInt >= 12 ? 'PM' : 'AM';
                  const displayHour = (hourInt % 12) || 12;
                  const formattedTime = `${displayHour}:${minStr} ${ampm}`;

                  return (
                    <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '500', color: textColor }]}>{formattedTime}</Text>
                      <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        {h.condition.icon && (
                          <Image
                            source={{ uri: `https:${h.condition.icon}` }}
                            style={styles.hourlyIcon}
                          />
                        )}
                        <Text style={[styles.tableCellText, { color: textColor }]} numberOfLines={1}>
                          {h.condition.text}
                        </Text>
                      </View>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: textColor }]}>
                        {Math.round(h.temp_c)}°C / {Math.round(h.temp_f)}°F
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Future Date Forecast Section */}
          {defaultWeather.forecast?.forecastday && defaultWeather.forecast.forecastday.length > 0 && (
            <View style={styles.forecastCard}>
              <Text style={styles.forecastTitle}>Extended Forecast</Text>
              {defaultWeather.forecast.forecastday.map((day, index) => {
                const dayDate = new Date(day.date + 'T00:00:00'); // Force local interpretation
                const dayName = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
                return (
                  <View key={index} style={styles.forecastRow}>
                    <Text style={styles.forecastDay}>{dayName}</Text>
                    <Text style={styles.forecastCond} numberOfLines={1}>{day.day.condition?.text || 'N/A'}</Text>
                    <Text style={styles.forecastTemp}>
                      {Math.round(day.day.maxtemp_c)}° / {Math.round(day.day.mintemp_c)}°
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Location Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardSectionTitle}>Location Details</Text>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Latitude / Longitude</Text>
                <Text style={styles.detailValue}>{defaultWeather.location.lat}° / {defaultWeather.location.lon}°</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Timezone</Text>
                <Text style={styles.detailValue}>{defaultWeather.location.tz_id}</Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Local Time</Text>
                <Text style={styles.detailValue}>{defaultWeather.location.localtime}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Localtime Epoch</Text>
                <Text style={styles.detailValue}>{defaultWeather.location.localtime_epoch}</Text>
              </View>
            </View>
          </View>

          {/* Current Conditions Extra Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardSectionTitle}>Current Conditions Details</Text>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Wind Speed</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.wind_kph} kph / {defaultWeather.current.wind_mph} mph</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Wind Direction</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.wind_dir} ({defaultWeather.current.wind_degree}°)</Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Pressure</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.pressure_mb} mb / {defaultWeather.current.pressure_in} in</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Precipitation</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.precip_mm} mm / {defaultWeather.current.precip_in} in</Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Cloud Cover</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.cloud}%</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>UV Index</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.uv}</Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Visibility</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.vis_km} km / {defaultWeather.current.vis_miles} miles</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.detailLabel}>Wind Gust</Text>
                <Text style={styles.detailValue}>{defaultWeather.current.gust_kph} kph / {defaultWeather.current.gust_mph} mph</Text>
              </View>
            </View>
          </View>

          {/* Today's Astronomy & Day Highlights */}
          {defaultWeather.forecast?.forecastday?.[0] && (
            <View style={styles.detailsCard}>
              <Text style={styles.cardSectionTitle}>Today's Astronomy & Highlights</Text>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Sunrise</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.sunrise}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Sunset</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.sunset}</Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Moonrise</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.moonrise}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Moonset</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.moonset}</Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Moon Phase</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.moon_phase}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Moon Illumination</Text>
                  <Text style={styles.detailValue}>{defaultWeather.forecast.forecastday[0].astro.moon_illumination}%</Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Max / Min Temp</Text>
                  <Text style={styles.detailValue}>
                    {Math.round(defaultWeather.forecast.forecastday[0].day.maxtemp_c)}°C / {Math.round(defaultWeather.forecast.forecastday[0].day.mintemp_c)}°C
                    {'\n'}({Math.round(defaultWeather.forecast.forecastday[0].day.maxtemp_f)}°F / {Math.round(defaultWeather.forecast.forecastday[0].day.mintemp_f)}°F)
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Avg Temp</Text>
                  <Text style={styles.detailValue}>
                    {Math.round(defaultWeather.forecast.forecastday[0].day.avgtemp_c)}°C / {Math.round(defaultWeather.forecast.forecastday[0].day.avgtemp_f)}°F
                  </Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Max Wind</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].day.maxwind_kph} kph / {defaultWeather.forecast.forecastday[0].day.maxwind_mph} mph
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Total Precip / Snow</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].day.totalprecip_mm} mm / {defaultWeather.forecast.forecastday[0].day.totalsnow_cm} cm
                  </Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Avg Visibility</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].day.avgvis_km} km / {defaultWeather.forecast.forecastday[0].day.avgvis_miles} miles
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Avg Humidity / UV</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].day.avghumidity}% / {defaultWeather.forecast.forecastday[0].day.uv}
                  </Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.detailLabel}>Chance of Rain / Snow</Text>
                  <Text style={styles.detailValue}>
                    {defaultWeather.forecast.forecastday[0].day.daily_chance_of_rain}% / {defaultWeather.forecast.forecastday[0].day.daily_chance_of_snow}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Active Alerts for all Zip Codes */}
      {zipCodes.map((zip, i) => {
        const w = weatherMap[zip];
        if (!w) return null;
        const sev = getSeverityType(w.current.condition.code);
        if (sev === 'none' && (!w.alerts?.alert || w.alerts.alert.length === 0)) return null;

        return (
          <View key={`alert-${zip}-${i}`} style={styles.alertCard}>
            <Text style={styles.alertTitle}>Alerts for {w.location.name} ({zip})</Text>
            {sev !== 'none' && (
              <Text style={styles.alertText}>
                ⚠️ {sev === 'thunderstorm' && '⛈ Thunderstorm detected'}
                {sev === 'rain' && '🌧 Rain detected'}
                {sev === 'snow' && '❄️ Snow detected'}
                {sev === 'fog' && '🌫 Fog detected'}
              </Text>
            )}
            {w.alerts?.alert && w.alerts.alert.length > 0 && w.alerts.alert.map((a, j) => (
              <View key={j} style={styles.apiAlert}>
                <Text style={styles.alertText}>📢 {a.headline || a.event}</Text>
                {a.desc ? (
                  <Text style={styles.alertDesc} numberOfLines={3}>
                    {a.desc}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}

      {/* Status */}
      <View style={styles.statusRow}>
        {lastUpdated && (
          <Text style={[styles.statusText, { color: textColor }]}>
            Last updated: {lastUpdated}
          </Text>
        )}
        <View style={styles.serviceStatus}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: serviceRunning ? '#00b894' : '#d63031' },
            ]}
          />
          <Text style={[styles.statusText, { color: textColor }]}>
            Service: {serviceRunning ? 'Running' : 'Stopped'}
          </Text>
        </View>
      </View>

      {/* Raw JSON Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raw Weather API JSON</Text>
              <View style={styles.modalHeaderButtons}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={copyToClipboard}
                  accessibilityLabel="Copy entire JSON"
                >
                  <Ionicons name="copy-outline" size={18} color="#0984e3" style={{ marginRight: 4 }} />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                  accessibilityLabel="Close JSON modal"
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.jsonScrollView}>
              <Text style={styles.jsonText}>
                {defaultWeather ? JSON.stringify(defaultWeather, null, 2) : 'No weather data loaded'}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  astroRow: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 16,
  },
  rawJsonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    alignSelf: 'center',
  },
  rawJsonButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hourlyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableHeader: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tableRowOdd: {
    backgroundColor: 'transparent',
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableCell: {
    fontSize: 14,
  },
  tableCellText: {
    fontSize: 13,
    marginLeft: 4,
    flexShrink: 1,
  },
  hourlyIcon: {
    width: 28,
    height: 28,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e1f5fe',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 12,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#0984e3',
    fontWeight: '600',
  },
  jsonButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  conditionIcon: {
    width: 64,
    height: 64,
    marginVertical: 8,
  },
  weatherCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    position: 'relative',
  },
  temp: {
    fontSize: 32,
    fontWeight: '200',
    color: '#fff',
    marginVertical: 8,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  jsonScrollView: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#a9ffaf',
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
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
  emptyStateCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  cityName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  region: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  condition: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    marginBottom: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  forecastCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  forecastTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  forecastDay: {
    fontSize: 16,
    color: '#fff',
    width: 60,
  },
  forecastCond: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  forecastTemp: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    width: 70,
    textAlign: 'right',
  },
  alertCard: {
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  alertText: {
    fontSize: 15,
    color: '#fff',
  },
  apiAlert: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  alertDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  statusRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  serviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    opacity: 0.8,
  },
});
