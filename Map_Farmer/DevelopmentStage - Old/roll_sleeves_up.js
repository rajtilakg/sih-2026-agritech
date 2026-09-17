const fs = require('fs');

// Pointing exactly to your archived DevelopmentStage JSON
const rawData = fs.readFileSync('C:\\Users\\91813\\Desktop\\Yougotthisonerightherebud\\Map Hotspot Farmer\\DevelopmentStage - Old\\maharashtra.json', 'utf8');
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

// A dynamic compiler that accepts custom dimensions
function buildMapForResolution(VIEW_W, VIEW_H, filename) {
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
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const MH_DISTRICT_OUTLINES = "${singleCombinedPath}";

export default function MaharashtraMap() {
  return (
    <View style={styles.container}>
      <Svg width={${VIEW_W}} height={${VIEW_H}} viewBox="0 0 ${VIEW_W} ${VIEW_H}">
        <Path 
          d={MH_DISTRICT_OUTLINES} 
          fill="transparent" 
          stroke="#34495e" 
          strokeWidth="0.8" 
        />
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

  fs.writeFileSync(`./${filename}`, componentCode);
  console.log(`✅ ${filename} generated successfully! (${VIEW_W}x${VIEW_H})`);
}

// Fire the compiler for both requested resolutions
buildMapForResolution(800, 900, 'MaharashtraMap_800.js');
buildMapForResolution(1200, 1350, 'MaharashtraMap_1200.js');
console.log('🎉 Done! Both high-res maps are ready for testing.');