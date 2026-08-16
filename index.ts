import { registerRootComponent } from 'expo';
import './src/tasks/weatherTask';
import notifee, { EventType } from '@notifee/react-native';
import { runWeatherCheck, scheduleNextWeatherCheck } from './src/tasks/weatherTask';

import App from './App';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.DELIVERED && detail.notification?.id === 'weather-current' && detail.notification?.data?.internalTrigger === 'true') {
    await runWeatherCheck();
    await scheduleNextWeatherCheck();
  }
});

notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type === EventType.DELIVERED && detail.notification?.id === 'weather-current' && detail.notification?.data?.internalTrigger === 'true') {
    await runWeatherCheck();
    await scheduleNextWeatherCheck();
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
