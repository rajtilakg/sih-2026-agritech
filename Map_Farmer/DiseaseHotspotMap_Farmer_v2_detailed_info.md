# Disease Hotspot Map — Handoff Document

**File:** `DiseaseHotspotMap_Farmer_v2.js`  
**Size:** ~115 KB (mostly the 113,860 char SVG path string)  
**Dependencies:** `react-native-svg` only  
**Platform:** React Native (iOS + Android)  
**Use case:** Farmer POV map showing disease outbreak hotspots across Maharashtra  
**Cloud integration:** Hotspot data is passed as a prop — heavy calculations (density clustering, trend analysis, prediction) run server-side. This component only renders.

---

## Exported Symbols

These are available for both frontend and backend teams to import independently.

### Constants

| Name | Type | Description |
|------|------|-------------|
| `BOUNDS` | `object` | `{ minLat, maxLat, minLng, maxLng }` — Maharashtra GPS bounding box |
| `VIEW_W` | `number` | SVG virtual width (7200) |
| `VIEW_H` | `number` | SVG virtual height (8100) |
| `MH_DISTRICT_OUTLINES` | `string` | Full SVG path data for Maharashtra district boundaries (113,860 chars) |
| `COLOR_MAP` | `object` | Disease name → hex color mapping |
| `DEFAULT_HOTSPOTS` | `array` | 7 placeholder hotspots for dev/testing |

### Functions

| Name | Signature | Description |
|------|-----------|-------------|
| `projectCoordinate` | `(lat: number, lng: number) → { x: number, y: number }` | Converts GPS coordinates to SVG pixel positions using linear bounding-box scaling |
| `DiseaseHotspotMap` (default) | React component — see props below | Renders the map with hotspots |

---

## Backend Team — Using `projectCoordinate`

Your cloud service should pre-compute hotspot positions before sending to the app.

### Example (Node.js)

```js
const { projectCoordinate, BOUNDS } = require('./DiseaseHotspotMap_Farmer_v2');

// Your cloud processing:
// 1. Query government dashboard API
// 2. Run density/trend/prediction algorithms
// 3. Return simplified hotspot list

const hotpotsFromCloud = [
  { lat: 19.8, lng: 75.9, diseaseName: 'Late_Blight', severity: 0.9, reportedCases: 342 },
  { lat: 21.1, lng: 79.1, diseaseName: 'Bacterial_Spot', severity: 0.75, reportedCases: 189 },
];

// Pre-compute pixel positions for efficient mobile rendering
const payload = hotpotsFromCloud.map(h => ({
  ...h,
  ...projectCoordinate(h.lat, h.lng),
}));

// Send payload to app via API
// app receives: [{ lat, lng, diseaseName, severity, x, y, ... }]
```

### Why pre-compute?
- Saves ~2ms per hotspot on the phone (no math needed)
- Reduces battery on low-end farmer devices
- Server can add computed fields (trend direction, confidence, cluster ID)

---

## Backend Team — Data Contract

Each hotspot object the app expects:

```ts
interface Hotspot {
  lat: number;           // Latitude (required for projection if x/y not pre-computed)
  lng: number;           // Longitude (required)
  diseaseName: string;   // Key in COLOR_MAP (e.g., 'Late_Blight')
  severity: number;      // 0.0 to 1.0+ (dictates circle radius)
  // Optional (can come from cloud processing):
  x?: number;            // Pre-computed X (if provided, projection skipped)
  y?: number;            // Pre-computed Y
  cases?: number;        // Reported case count
  trend?: 'up' | 'down' | 'stable';
  confidence?: number;   // 0-1 prediction confidence
}
```

If `x`/`y` are missing, the app falls back to `projectCoordinate()` client-side.

---

## Frontend Team — Component Props

```jsx
<DiseaseHotspotMap
  hotspots={hotspotsFromAPI}        // array — defaults to DEFAULT_HOTSPOTS
  farmerLocation={{ lat, lng }}      // object — defaults to Nagpur area { lat: 19.1, lng: 74.7 }
  title="Custom Map Title"           // string — defaults to 'Maharashtra Disease Outbreak Radar'
  loading={isLoading}                // boolean — shows ActivityIndicator when true
  onHotspotPress={(hotspot) => {    // function — called when farmer taps a circle
    // hotspot = the full hotspot object (lat, lng, diseaseName, severity, etc.)
    navigate('DiseaseDetail', { hotspot });
  }}
/>
```

---

## What the App Renders

1. **Maharashtra district outline** — SVG `<Path>` using `MH_DISTRICT_OUTLINES`, clipped via `ClipPath`
2. **Hotspot circles** — Colored per `COLOR_MAP`, sized by severity (radius = 90 + severity × 110 px)
3. **Farmer GPS dot** — Blue pulse circle (un-clipped so visible even slightly outside border)
4. **Loading spinner** — Blue `ActivityIndicator` overlay when `loading={true}`

---

## Color Reference

| Disease | Color | Hex |
|---------|-------|-----|
| Late Blight | Red | `#e74c3c` |
| Bacterial Spot | Blue | `#3498db` |
| Spider Mites | Orange | `#f39c12` |
| Leaf Mold | Purple | `#9b59b6` |
| Aphids | Dark Orange | `#e67e22` |
| Cercospora | Teal | `#1abc9c` |
| Early Blight | Dark Red | `#c0392b` |

Any disease not in this map defaults to `#e74c3c` (red).

---

## Integration Checklist

### Backend
- [ ] Set up cloud endpoint for hotspot data
- [ ] Run density/trend calculations server-side
- [ ] Pre-compute `x`, `y` via `projectCoordinate`
- [ ] Return array of hotspot objects (schema above)
- [ ] Handle empty results gracefully (return `[]`)
- [ ] Cache results (farmer devices refresh every 30 min)
- [ ] Add `region` filter for multi-state future expansion

### Frontend
- [ ] Import `DiseaseHotspotMap` and `projectCoordinate` from file
- [ ] Fetch hotspots from backend API
- [ ] Pass `hotspots` prop to component
- [ ] Handle loading state (`loading={true}` while fetching)
- [ ] Implement `onHotspotPress` → navigate to disease detail screen
- [ ] Show farmer GPS via `Geolocation` API → pass as `farmerLocation`
- [ ] Add pull-to-refresh for fresh hotspot data
- [ ] Test offline: `DEFAULT_HOTSPOTS` will show as fallback
- [ ] Add error boundary around component
- [ ] Verify on low-end Android device (640×720 SVG renders fine)
- [ ] Accessibility: circles have `accessibilityLabel` + `accessibilityRole="button"`

---

## Error Handling

The component handles these gracefully:
- `hotspots = null/undefined` → renders empty map (no crash, uses `const list = hotspots || []`)
- `hotspots = []` → clean map with just outline + farmer dot
- Missing disease in `COLOR_MAP` → defaults to red (`#e74c3c`)
- Missing severity → defaults to 0.6
- Missing `farmerLocation` → no GPS dot shown

---

## Performance Notes

- `MH_DISTRICT_OUTLINES` string is 113 KB but renders as a single SVG path — minimal GPU impact
- 7,200 × 8,100 virtual canvas — no actual pixel data until rendered
- Each hotspot is one `<Circle>` element — 100+ hotspots still smooth
- `Pressable` wrapper on circles for reliable touch on all Android versions
- `ClipPath` masks circles to state border — one-time GPU operation

---

## Future Expansion

- Multi-state: swap `MH_DISTRICT_OUTLINES` + `BOUNDS` for other Indian states
- Animations: add `react-native-reanimated` to circle radius for pulse effect (optional)
- Heatmap mode: stack circles with opacity blending for density visualization
- Offline first: bundle `DEFAULT_HOTSPOTS` + static outline, sync when online
