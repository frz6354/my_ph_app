import WeatherWidget from './WeatherWidget';

export function updateWeatherWidget(temperature: number | undefined, condition: string | undefined, city: string | undefined) {
  try {
    WeatherWidget.updateSnapshot({
      temperature,
      condition,
      city,
    });
  } catch (err) {
    console.error('Failed to update weather widget:', err);
  }
}
