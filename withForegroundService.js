const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withForegroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application[0];

    const service = {
      $: {
        'android:name': 'app.notifee.core.ForegroundService',
        'android:foregroundServiceType': 'dataSync',
      },
    };

    if (!application.service) {
      application.service = [];
    }

    // Ensure we don't duplicate the service tag if it already exists
    const existingServiceIndex = application.service.findIndex(
      (s) => s.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (existingServiceIndex > -1) {
      application.service[existingServiceIndex].$['android:foregroundServiceType'] = 'dataSync';
    } else {
      application.service.push(service);
    }

    return config;
  });
};
