import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, Alert, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { NavigationContainer, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TodoScreen from './src/screens/TodoScreen';
import ZipCodeDrawer from './src/screens/ZipCodeDrawer';
import { createNotificationChannels } from './src/services/notifications';
import { startForegroundService, getDefaultZipCode, initBackgroundFetch } from './src/tasks/weatherTask';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function WeatherStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeStack"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Weather',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
              style={{ marginLeft: 10, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="menu" size={22} color="#0984e3" style={{ marginRight: 4 }} />
              <Text style={{ color: '#0984e3', fontWeight: 'bold' }}>All Cities</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
              <Text style={{ color: '#0984e3', fontWeight: 'bold', marginRight: 10 }}>Settings</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

function WeatherDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <ZipCodeDrawer {...props} />}>
      <Drawer.Screen
        name="HomeDrawer"
        component={WeatherStack}
        options={{ headerShown: false }}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Request notification permission
        const settings = await notifee.requestPermission();
        if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
          Alert.alert(
            'Notifications Disabled',
            'Enable notifications in settings for weather alerts.'
          );
        }

        // Create notification channels
        await createNotificationChannels();

        // Auto-start foreground service if city is already saved
        if (Platform.OS === 'android') {
          const zip = await getDefaultZipCode();
          if (zip) {
            try {
              await startForegroundService();
            } catch (e) {
              console.warn('Could not auto-start foreground service:', e);
            }
          }
        }

        // Initialize background fetch for alarm reliability when app is killed
        await initBackgroundFetch();
      } catch (error) {
        console.error('App init error:', error);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0984e3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar translucent={false} backgroundColor="#0984e3" barStyle="light-content" />
      <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: any = 'help';
            if (route.name === 'WeatherTab') {
              iconName = focused ? 'partly-sunny' : 'partly-sunny-outline';
            } else if (route.name === 'Todo 1' || route.name === 'Todo 2' || route.name === 'Todo 3') {
              iconName = focused ? 'list' : 'list-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#0984e3',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen
          name="WeatherTab"
          component={WeatherDrawer}
          options={{ title: 'Weather' }}
        />
        <Tab.Screen
          name="Todo 1"
          component={TodoScreen}
          options={{ headerShown: true }}
        />
        <Tab.Screen
          name="Todo 2"
          component={TodoScreen}
          options={{ headerShown: true }}
        />
        <Tab.Screen
          name="Todo 3"
          component={TodoScreen}
          options={{ headerShown: true }}
        />
      </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0984e3',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
});
