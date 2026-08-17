import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  getZipCodes,
  getCityList,
  saveCityList,
  addZipCode,
  removeZipCode,
  getDefaultZipCode,
  getWeatherMap,
  runWeatherCheck,
} from '../tasks/weatherTask';
import {
  WeatherResponse,
  fetchWeather,
  getSeverityType,
  HourlyWeather,
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
  const insets = useSafeAreaInsets();
  const [cityList, setCityList] = useState<string[]>([]);
  const [zipCodes, setZipCodes] = useState<string[]>([]);
  const [defaultZip, setDefaultZip] = useState<string | null>(null);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherResponse>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [addCityInput, setAddCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [savingCity, setSavingCity] = useState(false);

  const hourlyScrollRef = useRef<ScrollView>(null);

  const loadData = async () => {
    const cities = await getCityList();
    const codes = await getZipCodes();
    const defZip = await getDefaultZipCode();
    let wMap = await getWeatherMap();

    for (const city of cities) {
      if (!wMap[city]) {
        try {
          const w = await fetchWeather(city);
          wMap = { ...wMap, [city]: w };
        } catch (e) {
          console.warn(`Could not load weather for city ${city}`, e);
        }
      }
    }

    setCityList(cities);
    setZipCodes(codes);
    setDefaultZip(defZip);
    setWeatherMap(wMap);
    if (Object.keys(wMap).length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  const handleMoveCity = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cityList.length) return;
    const updated = [...cityList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCityList(updated);
    await saveCityList(updated);
    DeviceEventEmitter.emit('zip_changed');
  };

  const handleDeleteCity = (cityKey: string) => {
    Alert.alert(
      'Remove City',
      `Are you sure you want to remove ${cityKey} from saved cities?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeZipCode(cityKey);
            await loadData();
            DeviceEventEmitter.emit('zip_changed');
          },
        },
      ]
    );
  };

  const handleAddCityDirect = async () => {
    const trimmed = addCityInput.trim();
    if (!trimmed) return;
    setSavingCity(true);
    try {
      const weather = await fetchWeather(trimmed);
      const officialName = weather.location.name;
      await addZipCode(officialName);
      setWeatherMap((prev) => ({ ...prev, [officialName]: weather }));
      setAddCityInput('');
      await loadData();
      DeviceEventEmitter.emit('zip_changed');
      Alert.alert('Saved', `${officialName} added to your cities!`);
    } catch (e: any) {
      Alert.alert('Error', e.message === 'pls update key' ? 'Please update API key in Settings' : 'Location not found.');
    } finally {
      setSavingCity(false);
    }
  };

  useEffect(() => {
    loadData();
    const subscription = DeviceEventEmitter.addListener('zip_changed', () => {
      loadData();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (viewMode === 'detail' && activeWeather) {
      const currentHour = new Date().getHours();
      const itemWidth = 74;
      setTimeout(() => {
        hourlyScrollRef.current?.scrollTo({
          x: currentHour * itemWidth,
          animated: true,
        });
      }, 100);
    }
  }, [viewMode, selectedCity, activeWeather]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const resultMap = await runWeatherCheck();
      if (resultMap) {
        setWeatherMap(resultMap);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        await loadData();
      }
    } catch (e: any) {
      if (e.message === 'pls update key') {
        setError('pls update key');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setError(null);
    try {
      const query = searchQuery.trim();
      const weather = await fetchWeather(query);
      const cityName = weather.location.name;
      setWeatherMap((prev: Record<string, WeatherResponse>) => ({ ...prev, [cityName]: weather }));
      setSelectedCity(cityName);
      setViewMode('detail');
      setSearchQuery('');
    } catch (e: any) {
      Alert.alert('Search Error', e.message === 'pls update key' ? 'Please update API key in Settings' : 'Location not found.');
    } finally {
      setLoadingSearch(false);
    }
  };

  // Determine active city data for detail view
  const activeCityKey = selectedCity || defaultZip || (Object.keys(weatherMap).length > 0 ? Object.keys(weatherMap)[0] : 'London');
  const activeWeather = weatherMap[activeCityKey] || weatherMap[Object.keys(weatherMap)[0]];
  const isCitySaved = cityList.some(c => c.toLowerCase() === activeCityKey?.toLowerCase());

  const handleToggleSaveActiveCity = async () => {
    if (!activeCityKey) return;
    if (isCitySaved) {
      handleDeleteCity(activeCityKey);
    } else {
      try {
        setSavingCity(true);
        await addZipCode(activeCityKey);
        await loadData();
        DeviceEventEmitter.emit('zip_changed');
        Alert.alert('Saved', `${activeCityKey} saved to your cities!`);
      } catch (e: any) {
        Alert.alert('Error', 'Could not save city.');
      } finally {
        setSavingCity(false);
      }
    }
  };

  const copyToClipboard = async () => {
    if (activeWeather) {
      await Clipboard.setStringAsync(JSON.stringify(activeWeather, null, 2));
      Alert.alert('Success', 'Copied weather JSON to clipboard!');
    }
  };

  // Dew point estimation formula
  const getDewPoint = (tempC: number, humidity: number) => {
    const dew = tempC - (100 - humidity) / 5;
    return Math.round(dew);
  };

  // UV risk category helper
  const getUvCategory = (uv: number) => {
    if (uv <= 2) return { level: 'Low', advice: 'Low risk. Enjoy the outdoors!' };
    if (uv <= 5) return { level: 'Moderate', advice: 'Use sun protection around midday.' };
    if (uv <= 7) return { level: 'High', advice: 'Wear hat & sunscreen 11:00-16:00.' };
    if (uv <= 10) return { level: 'Very High', advice: 'Extra protection required. Avoid peak sun.' };
    return { level: 'Extreme', advice: 'Take full precautions. Avoid outdoor sun.' };
  };

  // AQI US EPA category helper
  const getAqiCategory = (epaIndex?: number) => {
    if (!epaIndex) return { status: 'Good (N/A)', desc: 'Air quality is satisfactory.' };
    switch (epaIndex) {
      case 1:
        return { status: '1 - Good', desc: 'Air quality is satisfactory, poses little/no risk.' };
      case 2:
        return { status: '2 - Moderate', desc: 'Air quality is acceptable for most people.' };
      case 3:
        return { status: '3 - Unhealthy for Sensitive Groups', desc: 'Sensitive individuals may experience health effects.' };
      case 4:
        return { status: '4 - Unhealthy', desc: 'Everyone may begin to experience health effects.' };
      case 5:
        return { status: '5 - Very Unhealthy', desc: 'Health alert: risk of health effects for everyone.' };
      case 6:
        return { status: '6 - Hazardous', desc: 'Health warning of emergency conditions.' };
      default:
        return { status: `${epaIndex}`, desc: 'Air quality data available.' };
    }
  };

  return (
    <View style={[styles.outerContainer, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.appTitle}>Meteo</Text>
            <View style={styles.headerRightControls}>
              {viewMode === 'detail' && (
                <TouchableOpacity
                  style={styles.allCitiesPillBtn}
                  onPress={() => setViewMode('grid')}
                >
                  <Ionicons name="chevron-back" size={18} color="#fff" />
                  <Text style={styles.allCitiesPillText}>All Cities</Text>
                </TouchableOpacity>
              )}
              {navigation && (
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Glass Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="rgba(255, 255, 255, 0.6)" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a city or airport"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {loadingSearch ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 6 }} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Sub-header All Cities back button in detail mode */}
          {viewMode === 'detail' && (
            <TouchableOpacity
              style={styles.subHeaderBackBtn}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
              <Text style={styles.subHeaderBackText}>All Cities</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ==================== VIEW MODE: OVERVIEW GRID (ALL CITIES) ==================== */}
        {viewMode === 'grid' ? (
          <View style={styles.gridSection}>
            {/* Quick Add / Save City Section */}
            <View style={styles.addCityCard}>
              <Text style={styles.addCityTitle}>Add New City</Text>
              <View style={styles.addCityInputRow}>
                <TextInput
                  style={styles.addCityInput}
                  placeholder="Enter city name or zip code..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={addCityInput}
                  onChangeText={setAddCityInput}
                  onSubmitEditing={handleAddCityDirect}
                  returnKeyType="done"
                  editable={!savingCity}
                />
                <TouchableOpacity
                  style={[styles.addCityBtn, savingCity && styles.addCityBtnDisabled]}
                  onPress={handleAddCityDirect}
                  disabled={savingCity}
                >
                  {savingCity ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.addCityBtnText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeaderTitle}>Saved Cities</Text>
              <Text style={styles.sectionHeaderCount}>{cityList.length} saved</Text>
            </View>

            <View style={styles.cityGrid}>
              {cityList.map((cityKey: string, index: number) => {
                const w = weatherMap[cityKey];
                const isSelected = activeCityKey === cityKey;

                return (
                  <TouchableOpacity
                    key={`${cityKey}-${index}`}
                    style={[styles.cityCard, isSelected && styles.cityCardSelected]}
                    onPress={() => {
                      setSelectedCity(cityKey);
                      setViewMode('detail');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cityName} numberOfLines={1}>
                          {w?.location?.name || cityKey}
                        </Text>
                        <Text style={styles.citySubtext} numberOfLines={1}>
                          {w?.location?.country || 'Saved Location'}
                        </Text>
                      </View>
                      <View style={styles.cardActionRow}>
                        {index > 0 && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMoveCity(index, 'up');
                            }}
                            style={styles.actionBtnIcon}
                          >
                            <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.8)" />
                          </TouchableOpacity>
                        )}
                        {index < cityList.length - 1 && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMoveCity(index, 'down');
                            }}
                            style={styles.actionBtnIcon}
                          >
                            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.8)" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteCity(cityKey);
                          }}
                          style={styles.deleteBtnIcon}
                        >
                          <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.cardBottomRow}>
                      <View>
                        <Text style={styles.gridTemp}>
                          {w ? `${Math.round(w.current.temp_c)}°` : '--°'}
                        </Text>
                        <Text style={styles.gridCondition} numberOfLines={1}>
                          {w?.current?.condition?.text || 'Loading...'}
                        </Text>
                      </View>

                      {w?.current?.condition?.icon ? (
                        <Image
                          source={{ uri: `https:${w.current.condition.icon}` }}
                          style={styles.gridIcon}
                        />
                      ) : w?.forecast?.forecastday?.[0]?.day ? (
                        <View style={styles.rangeContainer}>
                          <Text style={styles.rangeText}>
                            H: {Math.round(w.forecast.forecastday[0].day.maxtemp_c)}°
                          </Text>
                          <Text style={styles.rangeText}>
                            L: {Math.round(w.forecast.forecastday[0].day.mintemp_c)}°
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          /* ==================== VIEW MODE: CITY DETAIL ==================== */
          activeWeather && (
            <View style={styles.detailSection}>
              {/* Hero Main Weather Card */}
              <View style={styles.heroCard}>
                <View style={styles.heroLeft}>
                  <View style={styles.heroCityHeaderRow}>
                    <Text style={styles.heroCity}>{activeWeather.location.name}</Text>
                    <TouchableOpacity
                      style={[styles.saveCityPill, isCitySaved ? styles.saveCityPillSaved : styles.saveCityPillAdd]}
                      onPress={handleToggleSaveActiveCity}
                      disabled={savingCity}
                    >
                      <Ionicons
                        name={isCitySaved ? "bookmark" : "bookmark-outline"}
                        size={14}
                        color="#fff"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.saveCityPillText}>
                        {isCitySaved ? 'Saved' : 'Save City'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.heroCountry}>
                    {activeWeather.location.region ? `${activeWeather.location.region}, ` : ''}
                    {activeWeather.location.country}
                  </Text>
                  <Text style={styles.heroTemp}>
                    {Math.round(activeWeather.current.temp_c)}°
                  </Text>
                  <Text style={styles.heroCondition}>
                    {activeWeather.current.condition.text}
                  </Text>

                  {activeWeather.forecast?.forecastday?.[0]?.day && (
                    <Text style={styles.heroHL}>
                      H:{Math.round(activeWeather.forecast.forecastday[0].day.maxtemp_c)}°  L:
                      {Math.round(activeWeather.forecast.forecastday[0].day.mintemp_c)}°
                    </Text>
                  )}

                  {activeWeather.forecast?.forecastday?.[0]?.astro && (
                    <View style={styles.heroAstroRow}>
                      <Text style={styles.heroAstroText}>
                        <Ionicons name="sunny-outline" size={13} color="#ffce00" /> {activeWeather.forecast.forecastday[0].astro.sunrise}
                      </Text>
                      <Text style={styles.heroAstroText}>
                        <Ionicons name="moon-outline" size={13} color="#f1c40f" /> {activeWeather.forecast.forecastday[0].astro.sunset}
                      </Text>
                    </View>
                  )}
                </View>

                {activeWeather.current.condition.icon && (
                  <Image
                    source={{ uri: `https:${activeWeather.current.condition.icon}` }}
                    style={styles.heroIcon}
                  />
                )}
              </View>

              {/* Hourly Forecast Section */}
              {activeWeather.forecast?.forecastday?.[0]?.hour && (
                <View style={styles.glassCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.cardHeaderTitle}>HOURLY FORECAST</Text>
                  </View>

                  <ScrollView
                    ref={hourlyScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourlyScroll}
                    onLayout={() => {
                      const currentHour = new Date().getHours();
                      const itemWidth = 74;
                      hourlyScrollRef.current?.scrollTo({
                        x: currentHour * itemWidth,
                        animated: true,
                      });
                    }}
                  >
                    {activeWeather.forecast.forecastday[0].hour.map((h: HourlyWeather, idx: number) => {
                      const timePart = h.time.split(' ')[1] || h.time;
                      const [hourStr] = timePart.split(':');
                      const hourInt = parseInt(hourStr, 10);
                      const currentLocalHour = new Date().getHours();
                      const isCurrentHour = hourInt === currentLocalHour;
                      const displayHour = isCurrentHour ? 'Now' : `${(hourInt % 12) || 12} ${hourInt >= 12 ? 'PM' : 'AM'}`;

                      return (
                        <View
                          key={idx}
                          style={[
                            styles.hourlyItem,
                            isCurrentHour && styles.hourlyItemCurrent,
                          ]}
                        >
                          <Text style={[styles.hourlyTime, isCurrentHour && styles.hourlyTimeCurrent]}>
                            {displayHour}
                          </Text>
                          {h.condition.icon && (
                            <Image
                              source={{ uri: `https:${h.condition.icon}` }}
                              style={styles.hourlyIconImage}
                            />
                          )}
                          <Text style={[styles.hourlyTemp, isCurrentHour && styles.hourlyTempCurrent]}>
                            {Math.round(h.temp_c)}°
                          </Text>
                          {isCurrentHour && (
                            <View style={styles.nowBadge}>
                              <Text style={styles.nowBadgeText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Multi-day Forecast Section */}
              {activeWeather.forecast?.forecastday && (
                <View style={styles.glassCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.cardHeaderTitle}>5-DAY FORECAST</Text>
                  </View>

                  <View style={styles.dailyList}>
                    {activeWeather.forecast.forecastday.slice(0, 5).map((day: any, idx: number) => {
                      const dayDate = new Date(day.date + 'T00:00:00');
                      const dayName = idx === 0 ? 'Today' : dayDate.toLocaleDateString(undefined, { weekday: 'short' });
                      const min = Math.round(day.day.mintemp_c);
                      const max = Math.round(day.day.maxtemp_c);

                      return (
                        <View key={idx} style={styles.dailyRow}>
                          <Text style={styles.dailyDay}>{dayName}</Text>
                          {day.day.condition?.icon && (
                            <Image
                              source={{ uri: `https:${day.day.condition.icon}` }}
                              style={styles.dailyIcon}
                            />
                          )}
                          <Text style={styles.dailyMin}>{min}°</Text>
                          <View style={styles.tempBarTrack}>
                            <View style={[styles.tempBarFill, { left: '15%', right: '20%' }]} />
                          </View>
                          <Text style={styles.dailyMax}>{max}°</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Sunrise & Sunset Spotlight Card */}
              <View style={styles.glassCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="sunny-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeaderTitle}>SUN & MOON</Text>
                </View>
                <View style={styles.sunRow}>
                  <View style={styles.sunBox}>
                    <Ionicons name="sunny-outline" size={28} color="#ffce00" />
                    <Text style={styles.sunLabel}>Sunrise</Text>
                    <Text style={styles.sunTime}>
                      {activeWeather.forecast?.forecastday?.[0]?.astro?.sunrise || '6:00 AM'}
                    </Text>
                  </View>
                  <View style={styles.sunDivider} />
                  <View style={styles.sunBox}>
                    <Ionicons name="moon-outline" size={28} color="#f1c40f" />
                    <Text style={styles.sunLabel}>Sunset</Text>
                    <Text style={styles.sunTime}>
                      {activeWeather.forecast?.forecastday?.[0]?.astro?.sunset || '8:00 PM'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Air Quality (AQI) Card */}
              <View style={styles.glassCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="leaf-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeaderTitle}>AIR QUALITY (AQI)</Text>
                </View>
                <Text style={styles.aqiStatus}>
                  {getAqiCategory(activeWeather.current.air_quality?.['us-epa-index']).status}
                </Text>
                <Text style={styles.aqiDesc}>
                  {getAqiCategory(activeWeather.current.air_quality?.['us-epa-index']).desc}
                </Text>

                {activeWeather.current.air_quality && (
                  <View style={styles.aqiPollutantsRow}>
                    <View style={styles.pollutantBadge}>
                      <Text style={styles.pollutantLabel}>PM2.5</Text>
                      <Text style={styles.pollutantValue}>
                        {Math.round(activeWeather.current.air_quality.pm2_5 || 0)} µg/m³
                      </Text>
                    </View>
                    <View style={styles.pollutantBadge}>
                      <Text style={styles.pollutantLabel}>PM10</Text>
                      <Text style={styles.pollutantValue}>
                        {Math.round(activeWeather.current.air_quality.pm10 || 0)} µg/m³
                      </Text>
                    </View>
                    <View style={styles.pollutantBadge}>
                      <Text style={styles.pollutantLabel}>O₃</Text>
                      <Text style={styles.pollutantValue}>
                        {Math.round(activeWeather.current.air_quality.o3 || 0)} µg/m³
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 2x3 Weather Metrics Grid */}
              <View style={styles.metricsGrid}>
                {/* 1. WIND */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="navigate-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>WIND</Text>
                  </View>
                  <Text style={styles.metricValue}>{Math.round(activeWeather.current.wind_kph)} km/h</Text>
                  <Text style={styles.metricSubvalue}>
                    Dir: {activeWeather.current.wind_dir} ({activeWeather.current.wind_degree}°)
                  </Text>
                  <Text style={styles.metricFooter}>
                    Gusts up to {Math.round(activeWeather.current.gust_kph)} km/h
                  </Text>
                </View>

                {/* 2. HUMIDITY & DEW POINT */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="water-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>HUMIDITY</Text>
                  </View>
                  <Text style={styles.metricValue}>{activeWeather.current.humidity}%</Text>
                  <Text style={styles.metricSubvalue}>
                    Dew Point: {getDewPoint(activeWeather.current.temp_c, activeWeather.current.humidity)}°C
                  </Text>
                  <Text style={styles.metricFooter}>
                    The dew point is {getDewPoint(activeWeather.current.temp_c, activeWeather.current.humidity)}° right now.
                  </Text>
                </View>

                {/* 3. PRESSURE */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="speedometer-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>PRESSURE</Text>
                  </View>
                  <Text style={styles.metricValue}>{activeWeather.current.pressure_mb} hPa</Text>
                  <Text style={styles.metricSubvalue}>
                    {activeWeather.current.pressure_in} inHg
                  </Text>
                  <Text style={styles.metricFooter}>Atmospheric pressure is steady.</Text>
                </View>

                {/* 4. UV INDEX */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="sunny-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>UV INDEX</Text>
                  </View>
                  <Text style={styles.metricValue}>
                    {activeWeather.current.uv}{' '}
                    <Text style={{ fontSize: 16 }}>{getUvCategory(activeWeather.current.uv).level}</Text>
                  </Text>
                  <Text style={styles.metricFooter}>
                    {getUvCategory(activeWeather.current.uv).advice}
                  </Text>
                </View>

                {/* 5. VISIBILITY */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>VISIBILITY</Text>
                  </View>
                  <Text style={styles.metricValue}>{activeWeather.current.vis_km} km</Text>
                  <Text style={styles.metricFooter}>
                    {activeWeather.current.vis_km >= 10 ? "It's perfectly clear right now." : "Reduced visibility due to haze/clouds."}
                  </Text>
                </View>

                {/* 6. FEELS LIKE */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <Ionicons name="thermometer-outline" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                    <Text style={styles.metricCardTitle}>FEELS LIKE</Text>
                  </View>
                  <Text style={styles.metricValue}>
                    {Math.round(activeWeather.current.feelslike_c)}°
                  </Text>
                  <Text style={styles.metricFooter}>
                    {Math.round(activeWeather.current.feelslike_c) === Math.round(activeWeather.current.temp_c)
                      ? 'Similar to actual temperature.'
                      : 'Humidity/wind is altering perceived temperature.'}
                  </Text>
                </View>
              </View>

              {/* View Raw JSON Action Button */}
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.rawJsonButton}
              >
                <Ionicons name="code-working-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.rawJsonButtonText}>View Raw Weather JSON</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Active Alerts Section */}
        {zipCodes.map((zip: string, i: number) => {
          const w = weatherMap[zip];
          if (!w) return null;
          const sev = getSeverityType(w.current.condition.code);
          if (sev === 'none' && (!w.alerts?.alert || w.alerts.alert.length === 0)) return null;

          return (
            <View key={`alert-${zip}-${i}`} style={styles.alertCard}>
              <Text style={styles.alertTitle}>Alerts for {w.location.name} ({zip})</Text>
              {sev !== 'none' && (
                <Text style={styles.alertText}>
                  ⚠️ {sev === 'thunderstorm' && 'Thunderstorm detected'}
                  {sev === 'rain' && 'Rain detected'}
                  {sev === 'snow' && 'Snow detected'}
                  {sev === 'fog' && 'Fog detected'}
                </Text>
              )}
            </View>
          );
        })}

        {/* Status Line */}
        {lastUpdated && (
          <Text style={styles.statusText}>
            Updated at {lastUpdated}
          </Text>
        )}
      </ScrollView>

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
                <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                  <Ionicons name="copy-outline" size={16} color="#007aff" style={{ marginRight: 4 }} />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.jsonScrollView}>
              <Text style={styles.jsonText}>
                {activeWeather ? JSON.stringify(activeWeather, null, 2) : 'No weather data'}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allCitiesPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  allCitiesPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  settingsIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subHeaderBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subHeaderBackText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    padding: 0,
  },
  addCityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  addCityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  addCityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addCityInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
    marginRight: 10,
  },
  addCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00b894',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addCityBtnDisabled: {
    opacity: 0.6,
  },
  addCityBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 77, 75, 0.85)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionHeaderCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  gridSection: {
    marginBottom: 20,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cityCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'space-between',
    minHeight: 140,
  },
  cityCardSelected: {
    borderColor: '#38ef7d',
    backgroundColor: 'rgba(56, 239, 125, 0.12)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnIcon: {
    padding: 4,
    marginLeft: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  deleteBtnIcon: {
    padding: 4,
    marginLeft: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 8,
  },
  citySubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  gridIcon: {
    width: 38,
    height: 38,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  gridTemp: {
    fontSize: 28,
    fontWeight: '300',
    color: '#ffffff',
  },
  gridCondition: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  rangeContainer: {
    alignItems: 'flex-end',
  },
  rangeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  detailSection: {
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeft: {
    flex: 1,
  },
  heroCityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  heroCity: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  saveCityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  saveCityPillAdd: {
    backgroundColor: '#00b894',
  },
  saveCityPillSaved: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveCityPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroCountry: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  heroTemp: {
    fontSize: 54,
    fontWeight: '200',
    color: '#ffffff',
  },
  heroCondition: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  heroHL: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  heroAstroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  heroAstroText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  heroIcon: {
    width: 90,
    height: 90,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 10,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
  },
  hourlyScroll: {
    flexDirection: 'row',
  },
  hourlyItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  hourlyItemCurrent: {
    backgroundColor: 'rgba(56, 239, 125, 0.18)',
    borderWidth: 1.5,
    borderColor: '#38ef7d',
  },
  hourlyTime: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  hourlyTimeCurrent: {
    fontWeight: '800',
    color: '#38ef7d',
  },
  hourlyIconImage: {
    width: 36,
    height: 36,
    marginVertical: 2,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  hourlyTempCurrent: {
    fontWeight: '800',
    color: '#ffffff',
  },
  nowBadge: {
    backgroundColor: '#38ef7d',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 4,
  },
  nowBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0a0f1d',
  },
  dailyList: {
    width: '100%',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  dailyDay: {
    width: 60,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  dailyIcon: {
    width: 30,
    height: 30,
  },
  dailyMin: {
    width: 32,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'right',
  },
  dailyMax: {
    width: 32,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'left',
  },
  tempBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginHorizontal: 12,
    position: 'relative',
  },
  tempBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#38ef7d',
    borderRadius: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'space-between',
    minHeight: 140,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  metricSubvalue: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 6,
  },
  metricFooter: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 14,
  },
  sunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  sunBox: {
    alignItems: 'center',
    flex: 1,
  },
  sunLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  sunTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  sunDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  aqiStatus: {
    fontSize: 20,
    fontWeight: '700',
    color: '#38ef7d',
    marginBottom: 4,
  },
  aqiDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  aqiPollutantsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pollutantBadge: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  pollutantLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  pollutantValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
  },
  rawJsonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rawJsonButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  alertCard: {
    backgroundColor: 'rgba(255, 165, 0, 0.85)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    color: '#fff',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    height: '80%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  copyButtonText: {
    fontSize: 13,
    color: '#007aff',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  jsonScrollView: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#38ef7d',
  },
});
