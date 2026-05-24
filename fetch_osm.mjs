import fs from 'fs';

const bbox = "13.80,100.40,13.84,100.45"; // South, West, North, East
const overpassQuery = `
  [out:json];
  (
    way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential"](${bbox});
  );
  out body;
  >;
  out skel qt;
`;

async function fetchData() {
  console.log("Fetching data from Overpass API...");
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: overpassQuery,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Rama5TrafficSimulator/1.0'
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Overpass API Error:", res.status, text);
    return;
  }
  
  const data = await res.json();

  console.log("Processing data...");
  const nodes = {};
  data.elements.forEach(el => {
    if (el.type === 'node') {
      nodes[el.id] = [el.lon, el.lat]; // GeoJSON expects [lon, lat]
    }
  });

  const ways = [];
  data.elements.forEach(el => {
    if (el.type === 'way' && el.nodes) {
      const coordinates = el.nodes.map(nodeId => nodes[nodeId]).filter(Boolean);
      if (coordinates.length > 1) {
        ways.push(coordinates);
      }
    }
  });

  console.log(`Found ${ways.length} ways.`);
  
  // Create trips for simulation
  const trips = [];
  const numCars = 1500; // Generate 1500 cars for the simulation
  
  for (let i = 0; i < numCars; i++) {
    // Pick a random way
    const way = ways[Math.floor(Math.random() * ways.length)];
    if (!way || way.length < 2) continue;
    
    let path = [];
    let currentTime = Math.floor(Math.random() * 500); // Random start time
    
    for (let j = 0; j < way.length; j++) {
      path.push({
        coordinates: way[j],
        timestamp: currentTime
      });
      // Add time for next node (simulating speed)
      currentTime += 20 + Math.random() * 80; 
    }
    
    trips.push({
      vendor: i,
      path: path.map(p => p.coordinates),
      timestamps: path.map(p => p.timestamp)
    });
  }

  // Also save the ways as geojson for rendering the roads
  const geojson = {
    type: "FeatureCollection",
    features: ways.map(way => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: way
      },
      properties: {}
    }))
  };

  if (!fs.existsSync('./public')) {
      fs.mkdirSync('./public');
  }

  fs.writeFileSync('./public/trips.json', JSON.stringify(trips));
  fs.writeFileSync('./public/roads.geojson', JSON.stringify(geojson));
  console.log(`Saved ${trips.length} trips and ${ways.length} roads to public directory.`);
}

fetchData().catch(console.error);
