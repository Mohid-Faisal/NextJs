"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

interface DeliveriesMapProps {
  deliveriesByCountry: { country: string; deliveries: number }[];
  selectedContinent: string;
  getCountryISO: (country: string) => string | null;
  getContinent: (iso: string) => string;
}

export default function DeliveriesMap({
  deliveriesByCountry,
  selectedContinent,
  getCountryISO,
  getContinent,
}: DeliveriesMapProps) {
  const [MapComponent, setMapComponent] = useState<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Load map components only on client side
    if (typeof window !== "undefined") {
      import("react-map-gl/maplibre")
        .then((module) => {
          setMapComponent(() => module.default);
        })
        .catch((err) => {
          console.error("Failed to load react-map-gl:", err);
          setMapError("Failed to load map library");
        });
    }
  }, []);

  // Filter deliveries by continent
  const filteredDeliveries = useMemo(() => {
    if (!deliveriesByCountry || !Array.isArray(deliveriesByCountry)) {
      return [];
    }
    if (selectedContinent === "All") return deliveriesByCountry;
    return deliveriesByCountry.filter((item) => {
      const iso = getCountryISO(item.country);
      if (!iso) return false;
      return getContinent(iso) === selectedContinent;
    });
  }, [deliveriesByCountry, selectedContinent, getCountryISO, getContinent]);

  // Create delivery count map
  const deliveryCountMap = useMemo(() => {
    const map: { [key: string]: number } = {};
    if (!filteredDeliveries || !Array.isArray(filteredDeliveries)) {
      return map;
    }
    filteredDeliveries.forEach((item) => {
      const iso = getCountryISO(item.country);
      if (iso) {
        map[iso] = (map[iso] || 0) + item.deliveries;
      }
    });
    return map;
  }, [filteredDeliveries, getCountryISO]);

  // Get max delivery count for color scaling
  const maxDeliveries = useMemo(() => {
    return Math.max(...Object.values(deliveryCountMap), 1);
  }, [deliveryCountMap]);

  const handleMapLoad = useCallback((e: any) => {
    const map = e.target;
    mapInstanceRef.current = map;

    // Wait for map to be fully loaded
    map.once('idle', () => {
      try {
        // Try to load country boundaries from a GeoJSON source with ISO codes
        // Using a GeoJSON that has ISO_A2 codes
        fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
          .then(response => response.json())
          .then(data => {
            try {
              // Add GeoJSON source
              if (map.getSource('countries')) {
                map.getSource('countries').setData(data);
              } else {
                map.addSource('countries', {
                  type: 'geojson',
                  data: data
                });
              }

              // Create color map for countries based on ISO codes
              // The GeoJSON might use different property names, so we'll try multiple
              const colorMap: { [key: string]: string } = {};
              
              Object.entries(deliveryCountMap).forEach(([iso, count]) => {
                const ratio = count / maxDeliveries;
                if (ratio <= 0.2) colorMap[iso] = "#8B5CF6";
                else if (ratio <= 0.4) colorMap[iso] = "#3B82F6";
                else if (ratio <= 0.6) colorMap[iso] = "#10B981";
                else if (ratio <= 0.8) colorMap[iso] = "#F59E0B";
                else colorMap[iso] = "#EF4444";
              });

              // Try to match on ISO_A2, ISO_A3, or ISO property
              let fillColorExpression: any = "#E5E7EB";
              
              if (Object.keys(colorMap).length > 0) {
                // Try ISO_A2 first (most common)
                const matchCases: any[] = ['match', ['get', 'ISO_A2']];
                Object.entries(colorMap).forEach(([iso, color]) => {
                  matchCases.push(iso, color);
                });
                matchCases.push("#E5E7EB");
                
                if (matchCases.length >= 5) {
                  fillColorExpression = matchCases;
                }
              }

              // Add or update country fill layer
              if (!map.getLayer('country-fills')) {
                map.addLayer({
                  id: 'country-fills',
                  type: 'fill',
                  source: 'countries',
                  paint: {
                    'fill-color': fillColorExpression,
                    'fill-opacity': 0.7
                  }
                });
              } else {
                map.setPaintProperty('country-fills', 'fill-color', fillColorExpression);
              }

              // Add country borders
              if (!map.getLayer('country-borders')) {
                map.addLayer({
                  id: 'country-borders',
                  type: 'line',
                  source: 'countries',
                  paint: {
                    'line-color': '#374151',
                    'line-width': 0.5,
                    'line-opacity': 0.3
                  }
                });
              }
            } catch (err) {
              console.error("Error adding country layers:", err);
            }
          })
          .catch(err => {
            console.error("Error loading country GeoJSON:", err);
            // Map will still display, just without country fills
          });
      } catch (err) {
        console.error("Error in map load handler:", err);
      }
    });
  }, [deliveryCountMap, maxDeliveries]);


  // Show error message if map failed to load
  if (mapError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 mb-2">
            Map unavailable
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {mapError}
          </div>
        </div>
      </div>
    );
  }

  if (!MapComponent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
      </div>
    );
  }

  const Map = MapComponent;

  // Use a simple map style - try MapLibre demo style first
  const mapStyle = "https://demotiles.maplibre.org/style.json";

  return (
    <Map
      initialViewState={{
        longitude: 0,
        latitude: 20,
        zoom: 1.5,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
      interactive={true}
      onError={(error: any) => {
        console.error("MapLibre error:", error);
        // Only show error if it's a critical map loading error
        // Ignore source-specific errors as they don't prevent the map from showing
        if (error?.error?.message && !error.error.message.includes('fetch') && !error.error.message.includes('pbf')) {
          const errorMessage = error.error.message || error?.message || "Failed to load map";
          setMapError(errorMessage);
        }
      }}
      onLoad={handleMapLoad}
    />
  );
}
