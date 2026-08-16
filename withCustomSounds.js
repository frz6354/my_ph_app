const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCustomSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const soundsDir = path.join(config.modRequest.projectRoot, 'assets', 'sounds');
      const resRawDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');

      if (!fs.existsSync(resRawDir)) {
        fs.mkdirSync(resRawDir, { recursive: true });
      }

      if (fs.existsSync(soundsDir)) {
        const files = fs.readdirSync(soundsDir);
        for (const file of files) {
          if (file.endsWith('.wav') || file.endsWith('.mp3')) {
            fs.copyFileSync(path.join(soundsDir, file), path.join(resRawDir, file));
          }
        }
      }
      return config;
    },
  ]);
};
