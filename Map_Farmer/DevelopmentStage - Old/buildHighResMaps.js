const fs = require('fs');

// Path to your archived GeoJSON
const jsonPath = 'C:\\Users\\91813\\Desktop\\Yougotthisonerightherebud\\Map Hotspot Farmer\\DevelopmentStage - Old\\maharashtra.json';

if (!fs.existsSync(jsonPath)) {
  console.error(`❌ File not found at: ${jsonPath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(jsonPath, 'utf8');
const geojson = JSON.parse(rawData);

let minLng = Infinity, maxLng = -Infinity;
let minLat = Infinity, maxLat = -Infinity;

function processBounds(coords) {
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
}

geojson.features.forEach(feature => {
  if (feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach(processBounds);
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(p => p.forEach(processBounds));
  }
});

function generateMap(VIEW_W, VIEW_H, filename) {
  // Prunes points within 2 pixels of viewBox space
  const MIN_DISTANCE_PX = 2.0;

  function project(lng, lat) {
    return {
      x: Math.round(((lng - minLng) / (maxLng - minLng)) * VIEW_W * 10) / 10,
      y: Math.round((VIEW_H - ((lat - minLat) / (maxLat - minLat)) * VIEW_H) * 10) / 10
    };
  }

  let allPaths = [];

  geojson.features.forEach(feature => {
    const coordsList = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    coordsList.forEach(polygon => {
      polygon.forEach(ring => {
        let ringPath = '';
        let lastPt = null;

        ring.forEach((pt, i) => {
          const curr = project(pt[0], pt[1]);

          if (i === 0) {
            ringPath += `M${curr.x},${curr.y}`;
            lastPt = curr;
          } else {
            const dist = Math.hypot(curr.x - lastPt.x, curr.y - lastPt.y);
            if (dist >= MIN_DISTANCE_PX || i === ring.length - 1) {
              ringPath += ` L${curr.x},${curr.y}`;
              lastPt = curr;
            }
          }
        });
        allPaths.push(ringPath + ' Z');
      });
    });
  });

  const singleCombinedPath = allPaths.join(' ');

  const componentCode = `import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

export const BOUNDS = {
  minLat: ${minLat},
  maxLat: ${maxLat},
  minLng: ${minLng},
  maxLng: ${maxLng}
};

export const VIEW_W = ${VIEW_W};
export const VIEW_H = ${VIEW_H};

export const MH_DISTRICT_OUTLINES = "${singleCombinedPath}";

export function projectCoordinate(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * VIEW_W;
  const y = VIEW_H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * VIEW_H;
  return { x, y };
}

export default function MaharashtraMap({ hotspots = [] }) {
  return (
    <View style={styles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 ${VIEW_W} ${VIEW_H}">
        <Path 
          d={MH_DISTRICT_OUTLINES} 
          fill="transparent" 
          stroke="#34495e" 
          strokeWidth="${(VIEW_W / 500).toFixed(1)}" 
        />
        <G>
          {hotspots.map((h, i) => {
            const { x, y } = projectCoordinate(h.lat, h.lng);
            const r = ${(VIEW_W / 80).toFixed(1)} * (h.severity || 0.8);
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill="#e74c3c"
                opacity={0.65}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: ${VIEW_W} / ${VIEW_H},
    alignItems: 'center',
    justifyContent: 'center',
  }
});
`;

  fs.writeFileSync(`./${filename}`, componentCode);
  const stats = fs.statSync(`./${filename}`);
  console.log(`✅ Generated: ${filename} | Canvas: ${VIEW_W}x${VIEW_H} | File Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

// Compile all 3 requested resolutions
console.log('⏳ Crunching coordinates for 1600, 2400, and 3600 resolutions...');
generateMap(1600, 1800, 'MaharashtraMap_1600.js');
generateMap(2400, 2700, 'MaharashtraMap_2400.js');
generateMap(3600, 4050, 'MaharashtraMap_3600.js');
// ~1 hectare per coordinate point
generateMap(7200, 8100, 'MaharashtraMap_7200.js');
console.log('🎉 Done! All 3 components generated.');