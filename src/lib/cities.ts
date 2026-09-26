// Coordinates for the default search cities (map searches need a point, not a name).
export const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Austin, TX': { lat: 30.2672, lon: -97.7431 },
  'Denver, CO': { lat: 39.7392, lon: -104.9903 },
  'Miami, FL': { lat: 25.7617, lon: -80.1918 },
  'San Diego, CA': { lat: 32.7157, lon: -117.1611 },
  'Nashville, TN': { lat: 36.1627, lon: -86.7816 },
  'Toronto, Canada': { lat: 43.6532, lon: -79.3832 },
  'Calgary, Canada': { lat: 51.0447, lon: -114.0719 },
  'Manchester, UK': { lat: 53.4808, lon: -2.2426 },
  'Leeds, UK': { lat: 53.8008, lon: -1.5491 },
  'Dublin, Ireland': { lat: 53.3498, lon: -6.2603 },
  'Sydney, Australia': { lat: -33.8688, lon: 151.2093 },
  'Auckland, New Zealand': { lat: -36.8485, lon: 174.7633 },
};

export const UK_CITIES = ['Manchester', 'Leeds', 'Birmingham', 'Bristol', 'Liverpool', 'Glasgow', 'Edinburgh', 'London'];
