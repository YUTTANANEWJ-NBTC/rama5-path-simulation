import React, { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Clock, Activity, CarFront, Route, Pointer, Trash2 } from 'lucide-react';

const INITIAL_VIEW_STATE = {
  longitude: 100.488,
  latitude: 13.805,
  zoom: 12,
  pitch: 45,
  bearing: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Utility for trip generation
function distance(lat1, lon1, lat2, lon2) {
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return Math.sqrt(dx*dx + dy*dy);
}

// Calculate true distance in kilometers
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

export default function App() {
  const [time, setTime] = useState(0);
  const [activeRoute, setActiveRoute] = useState(1);
  const [tripsData1, setTripsData1] = useState([]);
  const [routesData1, setRoutesData1] = useState(null);
  const [tripsData2, setTripsData2] = useState([]);
  const [routesData2, setRoutesData2] = useState(null);
  const [poisData, setPoisData] = useState([]);
  
  // Custom Route State (Mode 3)
  const [waypoints, setWaypoints] = useState([]);
  const [customTrips, setCustomTrips] = useState([]);
  const [customRoutes, setCustomRoutes] = useState(null);
  const [customStats, setCustomStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReturnTrip, setIsReturnTrip] = useState(false);

  const [animationSpeed, setAnimationSpeed] = useState(1.5);
  const [volume, setVolume] = useState(100);

  const loopLength = 12000;

  useEffect(() => {
    fetch('/trips.json').then(res => res.json()).then(data => setTripsData1(data));
    fetch('/routes.geojson').then(res => res.json()).then(data => setRoutesData1(data));
    fetch('/trips2.json').then(res => res.json()).then(data => setTripsData2(data));
    fetch('/routes2.geojson').then(res => res.json()).then(data => setRoutesData2(data));
    fetch('/pois.json').then(res => res.json()).then(data => setPoisData(data));
  }, []);

  useEffect(() => {
    let animationFrame;
    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      setTime(t => (t + (dt / 10) * animationSpeed) % loopLength);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [animationSpeed]);

  const handleMapClick = (info) => {
    if (activeRoute !== 3) return;
    if (info.coordinate) {
      setWaypoints([...waypoints, { lon: info.coordinate[0], lat: info.coordinate[1] }]);
    }
  };

  const generateCustomRoute = async () => {
    if (waypoints.length < 2) {
      alert("Please add at least 2 points on the map.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const activeWaypoints = isReturnTrip ? [...waypoints].reverse() : waypoints;
      const coordString = activeWaypoints.map(wp => `${wp.lon},${wp.lat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?geometries=geojson`;
      
      const res = await fetch(osrmUrl);
      const data = await res.json();
      
      if (data.code !== "Ok") throw new Error(data.message);

      const routeGeometry = data.routes[0].geometry;
      const osrmDurationSecs = data.routes[0].duration; // Base duration from OSRM
      
      setCustomRoutes({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: routeGeometry, properties: {} }]
      });

      // Generate Trips & calculate slow down
      const coords = routeGeometry.coordinates;
      const trips = [];
      const numCars = 1500;
      let totalTrafficDelayMultiplier = 0;
      let segmentCount = 0;

      for (let i = 0; i < numCars; i++) {
        let path = [];
        let currentTime = Math.floor(Math.random() * 800); 
        
        for (let j = 0; j < coords.length; j++) {
          const [lon, lat] = coords[j];
          path.push({ coordinates: [lon, lat], timestamp: currentTime });
          
          if (j < coords.length - 1) {
            const nextCoord = coords[j+1];
            const dist = distance(lat, lon, nextCoord[1], nextCoord[0]);
            
            let timeIncrement = dist * 20000; 
            
            // Check POI intersection
            let isNearPOI = false;
            for (const poi of poisData) {
              if (distance(lat, lon, poi.lat, poi.lon) < 0.005) { 
                isNearPOI = true;
                break;
              }
            }
            
            if (isNearPOI) {
              timeIncrement *= 4; 
              if (i === 0) totalTrafficDelayMultiplier += 4;
            } else {
              if (i === 0) totalTrafficDelayMultiplier += 1;
            }
            if (i === 0) segmentCount++;
            
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
      
      setCustomTrips(trips);
      
      // Calculate realistic display stats
      const avgMultiplier = segmentCount > 0 ? totalTrafficDelayMultiplier / segmentCount : 1;
      const baseMinutes = Math.round(osrmDurationSecs / 60);
      const trafficMinutes = Math.round(baseMinutes * avgMultiplier);
      
      setCustomStats({ baseMinutes, trafficMinutes });
      
    } catch (err) {
      console.error(err);
      alert("Failed to generate route. " + err.message);
    }
    setIsGenerating(false);
  };

  const clearWaypoints = () => {
    setWaypoints([]);
    setCustomTrips([]);
    setCustomRoutes(null);
    setCustomStats(null);
  };

  // Re-generate if direction changes and we already have a route
  useEffect(() => {
    if (waypoints.length >= 2 && customRoutes) {
      generateCustomRoute();
    }
  }, [isReturnTrip]);

  const currentTripsData = activeRoute === 1 ? tripsData1 : activeRoute === 2 ? tripsData2 : customTrips;
  const currentRoutesData = activeRoute === 1 ? routesData1 : activeRoute === 2 ? routesData2 : customRoutes;

  // Calculate distance in KM for active route
  const routeDistanceKm = useMemo(() => {
    if (!currentRoutesData || !currentRoutesData.features || currentRoutesData.features.length === 0) return 0;
    
    const coords = currentRoutesData.features[0].geometry.coordinates;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      total += haversineDistanceKm(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]);
    }
    return total;
  }, [currentRoutesData]);

  const activeTrips = useMemo(() => {
    if (!currentTripsData || currentTripsData.length === 0) return [];
    const count = Math.floor(currentTripsData.length * (volume / 100));
    return currentTripsData.slice(0, count);
  }, [currentTripsData, volume]);

  const layers = [
    new GeoJsonLayer({
      id: 'routes',
      data: currentRoutesData,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 4,
      getLineColor: [255, 255, 255, 40],
      getLineWidth: 4,
      updateTriggers: { data: currentRoutesData }
    }),
    new ScatterplotLayer({
      id: 'pois',
      data: poisData,
      getPosition: d => [d.lon, d.lat],
      getFillColor: d => {
        if (d.type === 'school') return [255, 204, 0, 180];
        if (d.type === 'market') return [255, 128, 0, 180];
        if (d.type === 'mall') return [153, 51, 255, 180];
        return [200, 200, 200, 150];
      },
      getRadius: 150,
      radiusMinPixels: 4,
      radiusMaxPixels: 15,
      pickable: true
    }),
    new TripsLayer({
      id: 'trips',
      data: activeTrips,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => d.vendor % 2 === 0 ? [253, 128, 93] : [23, 184, 190],
      opacity: 0.8,
      widthMinPixels: 3,
      rounded: true,
      fadeTrail: true,
      trailLength: 100,
      currentTime: time,
      updateTriggers: { data: activeTrips }
    }),
    new ScatterplotLayer({
      id: 'waypoints',
      data: activeRoute === 3 ? waypoints : [],
      getPosition: d => [d.lon, d.lat],
      getFillColor: [52, 211, 153, 255],
      getRadius: 30,
      radiusMinPixels: 6,
      updateTriggers: { data: waypoints }
    })
  ];

  return (
    <>
      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        onClick={handleMapClick}
        getTooltip={({object}) => object && (object.name || object.type)}
        style={{cursor: activeRoute === 3 ? 'crosshair' : 'grab'}}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={false} />
      </DeckGL>

      {/* Main Control Panel (Right) */}
      <div className="control-panel">
        <h1>Commute Simulation</h1>
        <p className="subtitle">Rama 5 ➔ Workplace</p>

        <div className="control-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <div style={{display: 'flex', gap: '8px'}}>
            <button 
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: activeRoute === 1 ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)', background: activeRoute === 1 ? 'rgba(96, 165, 250, 0.2)' : 'transparent', color: '#fff', cursor: 'pointer' }}
              onClick={() => setActiveRoute(1)}
            >
              Option 1 (Direct)
            </button>
            <button 
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: activeRoute === 2 ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)', background: activeRoute === 2 ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: '#fff', cursor: 'pointer' }}
              onClick={() => setActiveRoute(2)}
            >
              Option 2 (Express)
            </button>
          </div>
          <button 
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: activeRoute === 3 ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)', background: activeRoute === 3 ? 'rgba(52, 211, 153, 0.2)' : 'transparent', color: '#fff', cursor: 'pointer' }}
            onClick={() => setActiveRoute(3)}
          >
            Option 3 (Custom Interactive Route)
          </button>
        </div>

        <div className="stats-grid" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none', marginBottom: '20px' }}>
          <div className="stat-card" style={{ gridColumn: '1 / -1', background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="label">Total Distance</div>
            <div className="value">{routeDistanceKm > 0 ? `${routeDistanceKm.toFixed(2)} km` : '-'}</div>
          </div>
        </div>

        <div className="control-group">
          <label>
            <Clock size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: 4}} />
            Time of Day (Speed)
            <span className="value-display">{animationSpeed.toFixed(1)}x</span>
          </label>
          <input type="range" min="0.1" max="5" step="0.1" value={animationSpeed} onChange={e => setAnimationSpeed(parseFloat(e.target.value))} />
        </div>

        <div className="control-group">
          <label>
            <CarFront size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: 4}} />
            Traffic Density
            <span className="value-display">{volume}%</span>
          </label>
          <input type="range" min="5" max="100" step="5" value={volume} onChange={e => setVolume(parseInt(e.target.value))} />
        </div>

        <div className="legend-section" style={{marginTop: '16px', fontSize: '0.8rem', color: '#cbd5e1'}}>
          <div style={{fontWeight: 600, marginBottom: '8px', color: '#e5e7eb'}}>Points of Interest</div>
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '4px'}}>
            <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255, 204, 0, 0.8)', marginRight: '8px'}}></div> School
          </div>
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '4px'}}>
            <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255, 128, 0, 0.8)', marginRight: '8px'}}></div> Market
          </div>
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '4px'}}>
            <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(153, 51, 255, 0.8)', marginRight: '8px'}}></div> Mall
          </div>
        </div>
      </div>

      {/* Mode 3 Custom Panel (Left) */}
      {activeRoute === 3 && (
        <div className="custom-panel">
          <h1 style={{background: 'linear-gradient(90deg, #34d399, #10b981)', WebkitBackgroundClip: 'text'}}>Custom Route</h1>
          <p className="subtitle">Click on map to add waypoints.</p>
          
          <div style={{display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px'}}>
            <button 
              style={{ flex: 1, padding: '6px', borderRadius: '6px', border: !isReturnTrip ? '1px solid #34d399' : 'none', background: !isReturnTrip ? 'rgba(52, 211, 153, 0.2)' : 'transparent', color: !isReturnTrip ? '#fff' : '#9ca3af', cursor: 'pointer', fontSize: '0.875rem' }}
              onClick={() => setIsReturnTrip(false)}
            >
              Outbound (ขาไป)
            </button>
            <button 
              style={{ flex: 1, padding: '6px', borderRadius: '6px', border: isReturnTrip ? '1px solid #34d399' : 'none', background: isReturnTrip ? 'rgba(52, 211, 153, 0.2)' : 'transparent', color: isReturnTrip ? '#fff' : '#9ca3af', cursor: 'pointer', fontSize: '0.875rem' }}
              onClick={() => setIsReturnTrip(true)}
            >
              Return (ขากลับ)
            </button>
          </div>

          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px'}}>
            {waypoints.map((wp, i) => (
              <div key={i} style={{background: 'rgba(52, 211, 153, 0.2)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem'}}>
                Point {i+1}
              </div>
            ))}
          </div>

          <button className="custom-btn" onClick={generateCustomRoute} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Route & Simulate"}
          </button>
          
          <button className="custom-btn secondary" onClick={clearWaypoints}>
            <Trash2 size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: 4}} />
            Clear Route
          </button>

          {customStats && (
            <div className="stats-grid">
              <div className="stat-card" style={{gridColumn: '1 / -1', background: 'rgba(96, 165, 250, 0.1)'}}>
                <div className="label" style={{color: '#60a5fa'}}>Base Travel Time (No Traffic)</div>
                <div className="value">{customStats.baseMinutes} mins</div>
              </div>
              <div className="stat-card" style={{gridColumn: '1 / -1', background: 'rgba(239, 68, 68, 0.1)'}}>
                <div className="label" style={{color: '#f87171'}}>Estimated Time (High Traffic)</div>
                <div className="value">{customStats.trafficMinutes} mins</div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
