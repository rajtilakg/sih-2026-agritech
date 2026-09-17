const fs = require('fs');

// 1. Read your massive JSON file
const rawData = fs.readFileSync('./maharashtra.json', 'utf8');
const geojson = JSON.parse(rawData);

let minLng = Infinity, maxLng = -Infinity;
let minLat = Infinity, maxLat = -Infinity;

// Helper to calculate bounding box
function processBounds(coords) {
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
}

// 2. Find the absolute bounds of Maharashtra
geojson.features.forEach(feature => {
  if (feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach(processBounds);
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(polygon => {
      polygon.forEach(processBounds);
    });
  }
});

const VIEW_W = 400;
const VIEW_H = 450;

// 3. Project GPS to Screen Pixels & Compress
function project(lng, lat) {
  const x = ((lng - minLng) / (maxLng - minLng)) * VIEW_W;
  const y = VIEW_H - ((lat - minLat) / (maxLat - minLat)) * VIEW_H;
  
  // The secret sauce for <200KB: Round to exactly 1 decimal place
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10
  };
}

let paths = [];

// 4. Generate the SVG Path strings
geojson.features.forEach(feature => {
  const districtName = feature.properties.district;
  
  function createPathString(coords) {
    return coords.map(ring => {
      return ring.map((pt, i) => {
        const { x, y } = project(pt[0], pt[1]);
        return (i === 0 ? `M${x},${y}` : `L${x},${y}`);
      }).join(' ') + ' Z';
    }).join(' ');
  }

  if (feature.geometry.type === 'Polygon') {
    paths.push({ name: districtName, d: createPathString(feature.geometry.coordinates) });
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(polygon => {
      paths.push({ name: districtName, d: createPathString(polygon) });
    });
  }
});

// 5. Generate the React Native Component
const componentCode = `import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function MaharashtraMap() {
  return (
    <View style={styles.container}>
      <Svg width={${VIEW_W}} height={${VIEW_H}} viewBox="0 0 ${VIEW_W} ${VIEW_H}">
        ${paths.map(p => `{/* ${p.name} */}\n        <Path d="${p.d}" fill="transparent" stroke="#34495e" strokeWidth="0.8" />`).join('\n        ')}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  }
});
`;

fs.writeFileSync('./MaharashtraMap.js', componentCode);
console.log('✅ MaharashtraMap.js successfully generated!');
console.log('🗑️  You can now safely delete maharashtra.json from your bundle.');