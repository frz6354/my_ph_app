const fs = require('fs');

let content = fs.readFileSync('app.json', 'utf-8');
const data = JSON.parse(content);

// Remove edgeToEdgeEnabled
if (data.expo.android && data.expo.android.edgeToEdgeEnabled !== undefined) {
  delete data.expo.android.edgeToEdgeEnabled;
}

// Update kotlinVersion
const buildPropsPlugin = data.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-build-properties');
if (buildPropsPlugin && buildPropsPlugin[1] && buildPropsPlugin[1].android) {
  buildPropsPlugin[1].android.kotlinVersion = "2.1.20";
}

fs.writeFileSync('app.json', JSON.stringify(data, null, 2), 'utf-8');
console.log('Fixed app.json');
