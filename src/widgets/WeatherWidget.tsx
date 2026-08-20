import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type WeatherWidgetProps = {
  temperature?: number;
  condition?: string;
  city?: string;
};

const WeatherWidget = (props: WeatherWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <VStack>
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#FFFFFF')]}>
          {props.temperature ? `${Math.round(props.temperature)}°` : '--°'}
        </Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack>
        <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#FFFFFF')]}>
          {props.city || 'No City'}
        </Text>
        <HStack>
          <Text modifiers={[foregroundStyle('#FFFFFF')]}>
            {props.temperature ? `${Math.round(props.temperature)}°` : '--°'}
          </Text>
          <Text modifiers={[foregroundStyle('#FFFFFF')]}>
             - {props.condition || '--'}
          </Text>
        </HStack>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'accessoryInline') {
    return (
      <Text>
        {props.temperature ? `${Math.round(props.temperature)}°` : '--°'} {props.condition ? `- ${props.condition}` : ''}
      </Text>
    );
  }

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack>
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#000000')]}>
          {props.city || 'No City'}
        </Text>
        <Text>{props.temperature ? `${Math.round(props.temperature)}°` : '--°'}</Text>
        <Text>{props.condition || '--'}</Text>
      </VStack>
    );
  }

  return (
    <VStack>
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#000000')]}>
        {props.city || 'No City'}
      </Text>
      <HStack>
        <Text>{props.temperature ? `${Math.round(props.temperature)}°` : '--°'}</Text>
        <Text> - </Text>
        <Text>{props.condition || '--'}</Text>
      </HStack>
    </VStack>
  );
};

export default createWidget('WeatherWidget', WeatherWidget);
