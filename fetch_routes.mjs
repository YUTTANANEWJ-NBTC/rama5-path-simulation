import fs from 'fs';

const start = [100.427278, 13.828002];
const end = [100.550156, 13.782600];

async function fetchData() {
  console.log("Fetching routes from OSRM...");
  const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?alternatives=true&geometries=geojson`;
  
  const osrmRes = await fetch(osrmUrl);
  const osrmData = await osrmRes.json();
  
  if (osrmData.code !== "Ok") {
    console.error("OSRM failed:", osrmData);
    return;
  }

  const routes = osrmData.routes;
  console.log(`Found ${routes.length} alternative routes.`);

  const geojson = {
    type: "FeatureCollection",
    features: routes.map((r, i) => ({
      type: "Feature",
      geometry: r.geometry,
      properties: { routeIndex: i }
    }))
  };

  fs.writeFileSync('./public/routes.geojson', JSON.stringify(geojson));

  console.log("Fetching POIs (Schools, Universities, Markets, Malls)...");
  // Expand search area slightly around the bounding box of the start and end
  const overpassQuery = `
    [out:json];
    (
      node["amenity"~"school|university|college|marketplace"](13.77,100.41,13.84,100.56);
      node["shop"~"mall|department_store"](13.77,100.41,13.84,100.56);
      way["amenity"~"school|university|college|marketplace"](13.77,100.41,13.84,100.56);
      way["shop"~"mall|department_store"](13.77,100.41,13.84,100.56);
    );
    out center;
  `;

  // Provide a User-Agent to avoid 403 Forbidden
  const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "User-Agent": "AntigravityTrafficSim/1.0"
    },
    body: overpassQuery
  });

  if (!overpassRes.ok) {
    console.error("Overpass API error:", await overpassRes.text());
    return;
  }

  const overpassData = await overpassRes.json();
  
  const pois = overpassData.elements.map(el => {
    let lat = el.lat;
    let lon = el.lon;
    if (el.type === 'way' && el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    }
    
    let type = 'unknown';
    if (el.tags.amenity === 'school' || el.tags.amenity === 'university' || el.tags.amenity === 'college') type = 'school';
    if (el.tags.amenity === 'marketplace') type = 'market';
    if (el.tags.shop === 'mall' || el.tags.shop === 'department_store') type = 'mall';

    return { lat, lon, type, name: el.tags.name || type };
  }).filter(poi => poi.lat && poi.lon);

  console.log(`Found ${pois.length} POIs.`);
  fs.writeFileSync('./public/pois.json', JSON.stringify(pois));

  // Generate Trips
  console.log("Generating trips...");
  const trips = [];
  const numCars = 1500;
  
  // Calculate distance between two points
  function distance(lat1, lon1, lat2, lon2) {
    const dx = lat1 - lat2;
    const dy = lon1 - lon2;
    return Math.sqrt(dx*dx + dy*dy);
  }

  for (let i = 0; i < numCars; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const coords = route.geometry.coordinates;
    
    let path = [];
    let currentTime = Math.floor(Math.random() * 800); // Random start
    
    for (let j = 0; j < coords.length; j++) {
      const [lon, lat] = coords[j];
      path.push({ coordinates: [lon, lat], timestamp: currentTime });
      
      if (j < coords.length - 1) {
        const nextCoord = coords[j+1];
        const dist = distance(lat, lon, nextCoord[1], nextCoord[0]);
        
        // Base time per segment depends on distance
        let timeIncrement = dist * 20000; 
        
        // Check if we are near a POI to slow down (traffic jam)
        let isNearPOI = false;
        for (const poi of pois) {
          if (distance(lat, lon, poi.lat, poi.lon) < 0.005) { // Roughly 500m
            isNearPOI = true;
            break;
          }
        }
        
        if (isNearPOI) {
          timeIncrement *= 4; // 4x slower near POIs
        }
        
        // Add random fluctuation
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

  fs.writeFileSync('./public/trips.json', JSON.stringify(trips));
  console.log("Done.");
}

fetchData().catch(console.error);
