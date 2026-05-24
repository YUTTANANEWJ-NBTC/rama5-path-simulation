import fs from 'fs';

const start = [100.427278, 13.828002];
// Waypoint near Sirat Expressway Chatuchak Exit
const waypoint = [100.5350, 13.8100]; 
const end = [100.550156, 13.782600];

async function fetchData() {
  console.log("Fetching Route 2 (Expressway via Chatuchak) from OSRM...");
  const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${waypoint[0]},${waypoint[1]};${end[0]},${end[1]}?geometries=geojson`;
  
  const osrmRes = await fetch(osrmUrl);
  const osrmData = await osrmRes.json();
  
  if (osrmData.code !== "Ok") {
    console.error("OSRM failed:", osrmData);
    return;
  }

  const routes = osrmData.routes;
  console.log(`Found ${routes.length} route.`);

  const geojson = {
    type: "FeatureCollection",
    features: routes.map((r, i) => ({
      type: "Feature",
      geometry: r.geometry,
      properties: { routeIndex: i }
    }))
  };

  fs.writeFileSync('./public/routes2.geojson', JSON.stringify(geojson));

  // Load POIs to calculate traffic
  let pois = [];
  try {
    pois = JSON.parse(fs.readFileSync('./public/pois.json', 'utf-8'));
  } catch (e) {
    console.error("Could not load pois.json. Make sure to run fetch_routes.mjs first.");
  }

  // Generate Trips
  console.log("Generating trips for Route 2...");
  const trips = [];
  const numCars = 1500;
  
  function distance(lat1, lon1, lat2, lon2) {
    const dx = lat1 - lat2;
    const dy = lon1 - lon2;
    return Math.sqrt(dx*dx + dy*dy);
  }

  for (let i = 0; i < numCars; i++) {
    const route = routes[0]; // Only 1 route
    const coords = route.geometry.coordinates;
    
    let path = [];
    let currentTime = Math.floor(Math.random() * 800); 
    
    for (let j = 0; j < coords.length; j++) {
      const [lon, lat] = coords[j];
      path.push({ coordinates: [lon, lat], timestamp: currentTime });
      
      if (j < coords.length - 1) {
        const nextCoord = coords[j+1];
        const dist = distance(lat, lon, nextCoord[1], nextCoord[0]);
        
        let timeIncrement = dist * 20000; 
        
        // Expressway speeds (faster, so lower time multiplier)
        // Assume first half of the route is expressway, or just generally make base time faster
        timeIncrement *= 0.7; 

        let isNearPOI = false;
        for (const poi of pois) {
          if (distance(lat, lon, poi.lat, poi.lon) < 0.005) { 
            isNearPOI = true;
            break;
          }
        }
        
        if (isNearPOI) {
          timeIncrement *= 3; // Traffic jam near POIs
        }
        
        timeIncrement *= (0.8 + Math.random() * 0.4);
        currentTime += timeIncrement;
      }
    }
    
    trips.push({
      vendor: i,
      path: path.map(p => p.coordinates),
      timestamps: path.map(p => p.timestamp)
    });
  }

  fs.writeFileSync('./public/trips2.json', JSON.stringify(trips));
  console.log("Done generating Route 2.");
}

fetchData().catch(console.error);
