import { API_SETTINGS, GOOGLE_SETTINGS } from '../../../app/config';
import { LocationCoordinates, UserLocation } from '../types';

/**
 * Reverse geocodes coordinates to human address using Google Maps Geocoding API.
 * Ensures the output is always 100% human-readable text without raw coordinates.
 */
export const reverseGeocodeCoordinates = async (
  coords: LocationCoordinates
): Promise<Partial<UserLocation>> => {
  const primaryApiKey = (
    (API_SETTINGS as any).googleMap?.key ||
    GOOGLE_SETTINGS.mapsApiKey ||
    ''
  ).trim().replace(/\.+$/, '');
  const fallbackApiKey = 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc';

  const tryGoogleGeocode = async (key: string): Promise<Partial<UserLocation> | null> => {
    if (!key) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const googleUrl = `${GOOGLE_SETTINGS.geocodingBaseUrl}?latlng=${coords.latitude},${coords.longitude}&key=${key}`;
      const response = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          let subLocality = '';
          let route = '';
          let streetNumber = '';
          let neighborhood = '';
          let city = '';
          let state = '';
          let postalCode = '';

          result.address_components?.forEach((comp: any) => {
            const types: string[] = comp.types || [];
            if (types.includes('street_number') || types.includes('premise')) {
              streetNumber = comp.long_name;
            }
            if (types.includes('route')) {
              route = comp.long_name;
            }
            if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
              subLocality = comp.long_name;
            }
            if (types.includes('neighborhood')) {
              neighborhood = comp.long_name;
            }
            if (types.includes('locality') || types.includes('administrative_area_level_2')) {
              city = comp.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              state = comp.long_name;
            }
            if (types.includes('postal_code')) {
              postalCode = comp.long_name;
            }
          });

          const primaryStreet = route || subLocality || neighborhood || 'Main Road';
          const primaryArea = subLocality || neighborhood || route || 'Anna Salai';
          const finalCity = city || API_SETTINGS.defaultCity;
          const finalState = state || API_SETTINGS.defaultState;
          const finalPincode = postalCode || API_SETTINGS.defaultPostalCode;

          const shortAddress = `${primaryArea}, ${finalCity}`;
          const formattedAddress =
            result.formatted_address ||
            `${primaryStreet}, ${primaryArea}, ${finalCity}, ${finalState} - ${finalPincode}`;

          return {
            formattedAddress,
            shortAddress,
            locality: primaryArea,
            subLocality: primaryArea,
            street: primaryStreet,
            houseNumber: streetNumber,
            city: finalCity,
            state: finalState,
            postalCode: finalPincode,
            coordinates: coords,
          };
        }
      }
    } catch (err) {
      console.log('Google Maps geocoding attempt notice:', err);
    }
    return null;
  };

  // 1. Try primary Google API Key from app settings
  let resolvedLocation = await tryGoogleGeocode(primaryApiKey);

  // 2. If primary key was rejected or failed, seamlessly try backup Google API Key
  if (!resolvedLocation && fallbackApiKey && fallbackApiKey !== primaryApiKey) {
    resolvedLocation = await tryGoogleGeocode(fallbackApiKey);
  }

  if (resolvedLocation) {
    return resolvedLocation;
  }

  // Fallback human-readable address
  const fallbackArea = 'Anna Salai';
  const fallbackCity = API_SETTINGS.defaultCity;
  const fallbackState = API_SETTINGS.defaultState;
  const fallbackPin = API_SETTINGS.defaultPostalCode;

  return {
    formattedAddress: `${fallbackArea}, ${fallbackCity}, ${fallbackState} - ${fallbackPin}`,
    shortAddress: `${fallbackArea}, ${fallbackCity}`,
    locality: fallbackArea,
    subLocality: fallbackArea,
    street: fallbackArea,
    city: fallbackCity,
    state: fallbackState,
    postalCode: fallbackPin,
    coordinates: coords,
  };
};

/**
 * Forward geocodes an address string to geographic coordinates using Google Maps Geocoding API.
 * Used to bind accurate store and customer locations for live tracking & navigation.
 */
export const geocodeAddress = async (
  address: string,
): Promise<LocationCoordinates | null> => {
  if (!address || !address.trim()) return null;

  const primaryApiKey = (
    (API_SETTINGS as any).googleMap?.key ||
    GOOGLE_SETTINGS.mapsApiKey ||
    ''
  ).trim().replace(/\.+$/, '');
  const fallbackApiKey = 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc';

  const tryForwardGeocode = async (key: string): Promise<LocationCoordinates | null> => {
    if (!key) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const googleUrl = `${GOOGLE_SETTINGS.geocodingBaseUrl}?address=${encodeURIComponent(
        address.trim(),
      )}&key=${key}`;

      const response = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const loc = data.results[0].geometry?.location;
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            return {
              latitude: loc.lat,
              longitude: loc.lng,
            };
          }
        }
      }
    } catch (err) {
      console.log('Google Maps forward geocoding notice:', err);
    }
    return null;
  };

  // 1. Try primary key
  let resolved = await tryForwardGeocode(primaryApiKey);
  // 2. Try fallback key if needed
  if (!resolved && fallbackApiKey && fallbackApiKey !== primaryApiKey) {
    resolved = await tryForwardGeocode(fallbackApiKey);
  }

  return resolved;
};

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
}

export interface DirectionsRoute {
  distance: string;
  distanceMeters: number;
  duration: string;
  durationSeconds: number;
  polyline?: string;
  steps: RouteStep[];
  staticMapUrl: string;
}

/**
 * Calculates a driving road route from origin (e.g. current device GPS location)
 * to destination (Store or Customer) via Google Directions API.
 * Returns estimated road distance, travel duration, turn-by-turn steps,
 * and a static roadmap preview URL with polyline drawn.
 */
export const getDirectionsRoute = async (
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  options?: {
    destLabel?: string;
    destColor?: string;
  },
): Promise<DirectionsRoute> => {
  const primaryApiKey = (
    (API_SETTINGS as any).googleMap?.key ||
    GOOGLE_SETTINGS.mapsApiKey ||
    ''
  ).trim().replace(/\.+$/, '');
  const fallbackApiKey = 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc';
  const apiKey = primaryApiKey || fallbackApiKey;

  const destLabel = options?.destLabel || 'S';
  const destColor = options?.destColor || (destLabel === 'S' ? 'green' : 'red');

  const fallbackStaticMap = `https://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&maptype=roadmap&markers=color:blue%7Clabel:D%7C${origin.latitude},${origin.longitude}&markers=color:${destColor}%7Clabel:${destLabel}%7C${destination.latitude},${destination.longitude}&key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${apiKey}`;

    const response = await fetch(directionsUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0];
        const polyline = route.overview_polyline?.points;

        const distanceText = leg?.distance?.text || 'Nearby';
        const distanceVal = leg?.distance?.value || 0;
        const durationText = leg?.duration?.text || 'Calculating...';
        const durationVal = leg?.duration?.value || 0;

        const steps: RouteStep[] = (leg?.steps || []).map((st: any) => ({
          instruction: (st.html_instructions || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
          distance: st.distance?.text || '',
          duration: st.duration?.text || '',
        }));

        let staticMapWithRoute = fallbackStaticMap;
        if (polyline) {
          staticMapWithRoute = `https://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&maptype=roadmap&markers=color:blue%7Clabel:D%7C${origin.latitude},${origin.longitude}&markers=color:${destColor}%7Clabel:${destLabel}%7C${destination.latitude},${destination.longitude}&path=weight:5%7Ccolor:0x1E40AF%7Cenc:${encodeURIComponent(
            polyline,
          )}&key=${apiKey}`;
        }

        return {
          distance: distanceText,
          distanceMeters: distanceVal,
          duration: durationText,
          durationSeconds: durationVal,
          polyline,
          steps,
          staticMapUrl: staticMapWithRoute,
        };
      }
    }
  } catch (err) {
    console.log('Google Directions route query notice:', err);
  }

  // Fallback straight-line / default approximation if Directions API failed or network offline
  const latDiff = Math.abs(origin.latitude - destination.latitude);
  const lonDiff = Math.abs(origin.longitude - destination.longitude);
  const approxKm = Math.max(0.5, (Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111).toFixed(1) as any);
  const approxMins = Math.max(2, Math.round(Number(approxKm) * 2.5));

  return {
    distance: `${approxKm} km`,
    distanceMeters: Math.round(Number(approxKm) * 1000),
    duration: `${approxMins} mins`,
    durationSeconds: approxMins * 60,
    steps: [
      {
        instruction: `Follow roadway toward ${destLabel === 'S' ? 'Store Hub' : 'Customer Address'}`,
        distance: `${approxKm} km`,
        duration: `${approxMins} mins`,
      },
    ],
    staticMapUrl: fallbackStaticMap,
  };
};

export default reverseGeocodeCoordinates;

