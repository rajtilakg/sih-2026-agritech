import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

// Maharashtra simplified SVG path (placeholder - swap for accurate TopoJSON)
const MH_PATH = "M180,30 Q220,40 260,60 T320,80 Q350,100 380,120 T340,180 Q300,200 280,240 T240,300 Q200,320 160,280 T120,220 Q100,160 140,110 Z";

// Maharashtra bounding box for projection (approximate state bounds)
const BOUNDS = { minLat: 15.5, maxLat: 22.0, minLng: 72.5, maxLng: 81.0 };
const VIEW_W = 400;
const VIEW_H = 450;

const DUMMY_HOTSPOTS = [
  { lat: 19.8, lng: 75.9, diseaseName: 'Late_Blight', severity: 1.0 },
  { lat: 21.1, lng: 79.1, diseaseName: 'Bacterial_Spot', severity: 0.85 },
  { lat: 18.7, lng: 74.2, diseaseName: 'Spider_Mites', severity: 0.7 },
  { lat: 20.5, lng: 77.3, diseaseName: 'Leaf_Mold', severity: 0.6 },
  { lat: 17.2, lng: 78.3, diseaseName: 'Aphids', severity: 0.9 },
  { lat: 16.8, lng: 73.7, diseaseName: 'Cercospora', severity: 0.5 },
  { lat: 19.3, lng: 76.5, diseaseName: 'Early_Blight', severity: 1.0 },
];

const COLOR_MAP = {
  'Late_Blight': '#e74c3c',
  'Bacterial_Spot': '#3498db',
  'Spider_Mites': '#f39c12',
  'Leaf_Mold': '#9b59b6',
  'Aphids': '#e67e22',
  'Cercospora': '#1abc9c',
  'Early_Blight': '#c0392b',
};

function project(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * VIEW_W;
  const y = VIEW_H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * VIEW_H;
  return { x, y };
}

export default function DiseaseHotspotMap() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maharashtra Disease Hotspots</Text>
      <Svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {/* Maharashtra base outline */}
        <Path d={MH_PATH} fill="#d4e6f1" stroke="#2980b9" strokeWidth="2" />
        {/* Hotspot circles */}
        <G>
          {DUMMY_HOTSPOTS.map((h, i) => {
            const { x, y } = project(h.lat, h.lng);
            const r = 6 + h.severity * 14; // 6–20 px radius based on severity
            const color = COLOR_MAP[h.diseaseName] || '#95a5a6';
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={color}
                opacity={0.6}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#2c3e50' },
});
