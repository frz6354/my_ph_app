# WeatherApp

WeatherApp is a React Native application built with Expo that provides current weather updates and alerts. It features foreground service notifications on Android for constant weather monitoring and alerts for severe weather conditions (rain, snow, thunderstorms, and fog).

## Features

- **Multiple Locations**: Track weather for multiple zip codes simultaneously, and set one as your default location.
- **Current Weather**: Get real-time, detailed weather updates (feels like, humidity, wind, min/max temp, sunrise/sunset) for your locations.
- **Weather Alerts**: Receive notifications for severe weather (e.g., thunderstorms, snow, rain, fog) across all tracked zip codes.
- **API Alerts**: Integrates with WeatherAPI.com to display official weather alerts.
- **Foreground Service**: On Android, the app runs a foreground service to continuously check for weather updates every 5 minutes and alert you, even when the app is minimized.
- **Persistent Notifications**: Keep the current weather condition pinned in your notifications, which can be toggled via settings.
- **Customizable Alarms**: Set weather-triggered alarms with customizable times (custom time, sunrise, sunset, or time offset from sunrise/sunset) and personalized alert sounds (including vibrate or silent options).
- **Offline Data**: Caches the tracked zip codes, default location, and weather data locally using AsyncStorage.
- **Settings Widget**: Configure the WeatherAPI key, permanent notifications, and granular alarm controls natively within the app.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- An Android or iOS emulator/device for testing.

## Setup & Installation

1. **Clone the repository** (if applicable) or navigate to the project directory.

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file in the root directory and add your WeatherAPI key:
   ```env
   EXPO_PUBLIC_WEATHER_API_KEY=your_weatherapi_key_here
   ```
   *You can get a free API key from [WeatherAPI.com](https://www.weatherapi.com/).*

## Running the App

### Start the Expo Server
```bash
npx expo start
```
or
```bash
npm start
```

### Run on Android
```bash
npx expo run:android
```
or
```bash
npm run android
```

### Run on iOS
```bash
npx expo run:ios
```
or
```bash
npm run ios
```

### Run on Web
```bash
npx expo start --web
```
or
```bash
npm run web
```

## Permissions

The app requires several permissions (especially on Android) for notifications and foreground services to work correctly:
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_DATA_SYNC`
- `POST_NOTIFICATIONS` (Android 13+)
- `RECEIVE_BOOT_COMPLETED`
- `SCHEDULE_EXACT_ALARM`

Ensure you grant notification permissions when prompted in the app.

## Tech Stack

- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [@notifee/react-native](https://notifee.app/) for Notifications
- [Axios](https://axios-http.com/) for API requests
- [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) for local storage

