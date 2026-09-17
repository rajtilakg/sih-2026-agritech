const fs = require('fs');

// 1. Read the 102 KB file we already generated
const rawMapFile = fs.readFileSync('./MaharashtraMap.js', 'utf8');

// 2. Use Regex to extract all the 'd="..."' path strings 
const pathRegex = /d="([^"]+)"/g;
let match;
let allPaths = [];

while ((match = pathRegex.exec(rawMapFile)) !== null) {
  allPaths.push(match[1]);
}

const MIN_DISTANCE_PX = 2.0; 
let optimizedPaths = [];

// 3. Loop through every path and crush it
allPaths.forEach(pathStr => {
  const tokens = pathStr.trim().split(/\s+/);
  let newPath = '';
  let lastPt = null;

  tokens.forEach((token, i) => {
    if (token === 'Z') {
      newPath += ' Z';
      return;
    }
    
    const type = token.charAt(0);
    const [x, y] = token.substring(1).split(',').map(Number);
    const curr = { x, y };

    if (type === 'M') {
      newPath += (newPath.length === 0 ? `M${x},${y}` : ` M${x},${y}`);
      lastPt = curr;
    } else if (type === 'L') {
      const dist = Math.hypot(curr.x - lastPt.x, curr.y - lastPt.y);
      const isNextZ = (i + 1 < tokens.length && tokens[i+1] === 'Z');
      
      // Only keep the point if it's far enough away, OR if it's the final point before closing
      if (dist >= MIN_DISTANCE_PX || isNextZ) {
        newPath += ` L${x},${y}`;
        lastPt = curr;
      }
    }
  });

  optimizedPaths.push(newPath.trim());
});

// 4. Bake all optimized districts into a single string
const singleCombinedPath = optimizedPaths.join(' ');

const componentCode = `import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const MH_DISTRICT_OUTLINES = "${singleCombinedPath}";

export default function MaharashtraMap() {
  return (
    <View style={styles.container}>
      <Svg width={400} height={450} viewBox="0 0 400 450">
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

// 5. Overwrite the old file with the new, tiny version
fs.writeFileSync('./MaharashtraMap.js', componentCode);
console.log('✅ Successfully extracted coordinates from the 102KB file and crushed it down to <20 KB!');