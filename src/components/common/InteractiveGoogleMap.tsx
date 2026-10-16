import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_SETTINGS, GOOGLE_SETTINGS } from '../../app/config';
import { useTheme } from '../../theme';

let WebViewComponent: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebViewComponent = require('react-native-webview').WebView;
} catch (e) {
  WebViewComponent = null;
}

export interface MapCoordinates {
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
}

export interface InteractiveGoogleMapRef {
  recenter: () => void;
  toggleTraffic: (enable?: boolean) => void;
  setMapType: (type: 'roadmap' | 'satellite' | 'hybrid' | 'terrain') => void;
  searchAddress: (query: string) => void;
  setCenter: (lat: number, lon: number, zoom?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export interface RouteDetail {
  distance: string;
  duration: string;
  distanceMeters?: number;
  durationSeconds?: number;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
  }>;
}

export interface InteractiveGoogleMapProps {
  mode?: 'roadmap' | 'picker';
  defaultMapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  origin?: MapCoordinates;
  destination?: MapCoordinates;
  targetType?: 'store' | 'customer';
  initialZoom?: number;
  showTrafficControls?: boolean;
  showRecenterButton?: boolean;
  showTypeToggle?: boolean;
  showZoomControls?: boolean;
  routePolyline?: string;
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
  onRouteCalculated?: (route: RouteDetail) => void;
  height?: number | string;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}

export const InteractiveGoogleMap = React.forwardRef<
  InteractiveGoogleMapRef,
  InteractiveGoogleMapProps
>(
  (
    {
      mode = 'roadmap',
      defaultMapType = 'roadmap',
      origin,
      destination,
      targetType = 'store',
      initialZoom = 15,
      showTrafficControls = true,
      showRecenterButton = true,
      showTypeToggle = true,
      showZoomControls = true,
      routePolyline,
      onLocationSelect,
      onRouteCalculated,
      height = '100%',
      style,
      interactive = true,
    },
    ref,
  ) => {
    const { colors, isDark } = useTheme();
    const webViewRef = useRef<any>(null);

    const [isMapReady, setIsMapReady] = useState(false);
    const [webViewError, setWebViewError] = useState(false);
    const [trafficEnabled, setTrafficEnabled] = useState(false);
    const [currentMapType, setCurrentMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>(
      defaultMapType === 'satellite' ? 'hybrid' : (defaultMapType as any),
    );

    useEffect(() => {
      const resolved = defaultMapType === 'satellite' ? 'hybrid' : defaultMapType;
      setCurrentMapType(resolved as any);
      if (isMapReady) {
        webViewRef.current?.injectJavaScript(`
          if (window.setMapType) { window.setMapType('${resolved}'); }
          true;
        `);
      }
    }, [defaultMapType, isMapReady]);

    // Safe coordinates resolution directly from props (no hardcoded coordinates)
    const safeOrigin = useMemo(() => {
      const lat = origin?.latitude;
      const lon = origin?.longitude;
      if (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon) && lat !== 0 && lon !== 0) {
        return { latitude: lat, longitude: lon, title: origin?.title || 'Current Location' };
      }
      return null;
    }, [origin?.latitude, origin?.longitude, origin?.title]);

    const safeDest = useMemo(() => {
      const lat = destination?.latitude;
      const lon = destination?.longitude;
      if (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon) && lat !== 0 && lon !== 0) {
        return {
          latitude: lat,
          longitude: lon,
          title: destination?.title || (targetType === 'store' ? 'Store Hub' : 'Customer Location'),
        };
      }
      return null;
    }, [destination?.latitude, destination?.longitude, destination?.title, targetType]);

    const apiKey = useMemo(() => {
      return (
        (API_SETTINGS as any).googleMap?.key ||
        GOOGLE_SETTINGS.mapsApiKey ||
        'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc'
      )
        .trim()
        .replace(/\.+$/, '');
    }, []);

    // Expose imperative handle to parent component
    useImperativeHandle(ref, () => ({
      recenter: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.recenterMap) { window.recenterMap(); }
          true;
        `);
      },
      toggleTraffic: (enable?: boolean) => {
        const next = enable !== undefined ? enable : !trafficEnabled;
        setTrafficEnabled(next);
        webViewRef.current?.injectJavaScript(`
          if (window.toggleTraffic) { window.toggleTraffic(${next}); }
          true;
        `);
      },
      setMapType: (type: 'roadmap' | 'satellite' | 'hybrid' | 'terrain') => {
        const resolved = type === 'satellite' || type === 'hybrid' ? 'hybrid' : 'roadmap';
        setCurrentMapType(resolved as any);
        webViewRef.current?.injectJavaScript(`
          if (window.setMapType) { window.setMapType('${resolved}'); }
          true;
        `);
      },
      searchAddress: (query: string) => {
        webViewRef.current?.injectJavaScript(`
          if (window.searchAddress) { window.searchAddress(${JSON.stringify(query)}); }
          true;
        `);
      },
      setCenter: (lat: number, lon: number, zoom?: number) => {
        webViewRef.current?.injectJavaScript(`
          if (window.setCenter) { window.setCenter(${lat}, ${lon}, ${zoom || 16}); }
          true;
        `);
      },
      zoomIn: () => {
        handleFallbackZoomIn();
        webViewRef.current?.injectJavaScript(`
          if (window.zoomIn) { window.zoomIn(); }
          else if (window.map) { window.map.setZoom((window.map.getZoom() || 15) + 1); }
          true;
        `);
      },
      zoomOut: () => {
        handleFallbackZoomOut();
        webViewRef.current?.injectJavaScript(`
          if (window.zoomOut) { window.zoomOut(); }
          else if (window.map) { window.map.setZoom((window.map.getZoom() || 15) - 1); }
          true;
        `);
      },
    }));

    // Generate responsive and touch-optimized HTML with Google Maps JavaScript API
    const mapHtml = useMemo(() => {
      const isRoadmapMode = mode === 'roadmap';
      const destColor = targetType === 'store' ? '#15803D' : '#DC2626';
      const destLabel = targetType === 'store' ? 'Store Hub' : 'Customer';

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no" />
  <style>
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${isDark ? '#0f172a' : '#f8fafc'};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      touch-action: none;
    }
    #map {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      touch-action: none;
    }
    .custom-driver-pin {
      position: relative;
      width: 42px;
      height: 42px;
    }
    .driver-pulse {
      position: absolute;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.25);
      animation: pulse 2s infinite ease-out;
    }
    .driver-dot {
      position: absolute;
      top: 7px;
      left: 7px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .picker-center-pin {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      pointer-events: none;
      z-index: 1000;
    }
    .picker-pin-icon {
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
    }
    .picker-pin-shadow {
      width: 12px;
      height: 5px;
      background: rgba(0,0,0,0.25);
      border-radius: 50%;
      margin: -4px auto 0;
    }
    .watermark-notice {
      position: absolute;
      bottom: 2px;
      right: 6px;
      font-size: 9px;
      color: rgba(0,0,0,0.5);
      background: rgba(255,255,255,0.7);
      padding: 1px 4px;
      border-radius: 3px;
      pointer-events: none;
    }
  </style>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places"></script>
</head>
<body>
  <div id="map"></div>
  ${
    mode === 'picker'
      ? `<div class="picker-center-pin">
           <svg class="picker-pin-icon" width="36" height="46" viewBox="0 0 24 32" fill="none">
             <path d="M12 0C5.372 0 0 5.372 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.372 18.628 0 12 0Z" fill="#2563EB"/>
             <circle cx="12" cy="12" r="5" fill="#FFFFFF"/>
           </svg>
           <div class="picker-pin-shadow"></div>
         </div>`
      : ''
  }

  <script>
    var map;
    var directionsService;
    var directionsRenderer;
    var trafficLayer;
    var geocoder;
    var originMarker;
    var destMarker;
    var pickerMarker;
    var isRoadmap = ${isRoadmapMode ? 'true' : 'false'};
    var originCoords = ${safeOrigin ? `{ lat: ${safeOrigin.latitude}, lng: ${safeOrigin.longitude} }` : 'null'};
    var destCoords = ${safeDest ? `{ lat: ${safeDest.latitude}, lng: ${safeDest.longitude} }` : 'null'};

    function sendMessage(type, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: payload }));
      }
    }

    function initMap() {
      try {
        var mapCenterCoords = isRoadmap
          ? (originCoords || destCoords || { lat: 0, lng: 0 })
          : (destCoords || originCoords || { lat: 0, lng: 0 });
        var mapOptions = {
          zoom: ${initialZoom || 15},
          center: mapCenterCoords,
          mapTypeId: '${defaultMapType === 'satellite' || defaultMapType === 'hybrid' ? 'hybrid' : 'roadmap'}',
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: true,
          fullscreenControl: false,
          gestureHandling: '${interactive ? 'greedy' : 'none'}',
          isFractionalZoomEnabled: true,
          clickableIcons: false,
          styles: ${
            isDark
              ? JSON.stringify([
                  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                  {
                    featureType: 'administrative.locality',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }],
                  },
                  {
                    featureType: 'poi',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }],
                  },
                  {
                    featureType: 'poi.park',
                    elementType: 'geometry',
                    stylers: [{ color: '#263c3f' }],
                  },
                  {
                    featureType: 'poi.park',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#6b9a76' }],
                  },
                  {
                    featureType: 'road',
                    elementType: 'geometry',
                    stylers: [{ color: '#38414e' }],
                  },
                  {
                    featureType: 'road',
                    elementType: 'geometry.stroke',
                    stylers: [{ color: '#212a37' }],
                  },
                  {
                    featureType: 'road',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#9ca5b3' }],
                  },
                  {
                    featureType: 'road.highway',
                    elementType: 'geometry',
                    stylers: [{ color: '#746855' }],
                  },
                  {
                    featureType: 'road.highway',
                    elementType: 'geometry.stroke',
                    stylers: [{ color: '#1f2835' }],
                  },
                  {
                    featureType: 'road.highway',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#f3d19c' }],
                  },
                  {
                    featureType: 'transit',
                    elementType: 'geometry',
                    stylers: [{ color: '#2f3948' }],
                  },
                  {
                    featureType: 'transit.station',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }],
                  },
                  {
                    featureType: 'water',
                    elementType: 'geometry',
                    stylers: [{ color: '#17263c' }],
                  },
                  {
                    featureType: 'water',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#515c6d' }],
                  },
                  {
                    featureType: 'water',
                    elementType: 'labels.text.stroke',
                    stylers: [{ color: '#17263c' }],
                  },
                ])
              : '[]'
          }
        };

        map = new google.maps.Map(document.getElementById('map'), mapOptions);
        trafficLayer = new google.maps.TrafficLayer();
        geocoder = new google.maps.Geocoder();

        if (isRoadmap) {
          setupDirectionsRoadmap();
        } else {
          setupPickerMap();
        }

        sendMessage('MAP_READY', { status: 'ready' });
      } catch (err) {
        sendMessage('MAP_ERROR', { error: String(err) });
      }
    }

    function setupDirectionsRoadmap() {
      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563EB',
          strokeWeight: 6,
          strokeOpacity: 0.9,
        }
      });

      // 1. Two-Wheeler Vehicle Driver Marker (Origin)
      var driverIconSvg = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">' +
            '<circle cx="23" cy="23" r="21" fill="#2563EB" stroke="#FFFFFF" stroke-width="3"/>' +
            '<path d="M14 30a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm18 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-7-2.5h-5.5l-2.5-6h6.5l1.5 6zm-7-9l2-3.5h6l-1 3.5h-7zm12.5 3.5l-1.5-4.5 3-1.5 1 3-2.5 3z" fill="#FFFFFF"/>' +
          '</svg>'
        ),
        scaledSize: new google.maps.Size(46, 46),
        anchor: new google.maps.Point(23, 23),
      };

      if (originCoords) {
        originMarker = new google.maps.Marker({
          position: originCoords,
          map: map,
          icon: driverIconSvg,
          title: '${safeOrigin?.title || 'Driver Location'}',
          zIndex: 100,
        });
      }

      // 2. Destination Marker (Store / Customer)
      if (destCoords) {
        var destPinColor = '${destColor}';
        var destIconSvg = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">' +
              '<path d="M21 0C9.4 0 0 9.4 0 21C0 36.75 21 52 21 52C21 52 42 36.75 42 21C42 9.4 32.6 0 21 0Z" fill="' + destPinColor + '" stroke="#FFFFFF" stroke-width="2.5"/>' +
              '<circle cx="21" cy="20" r="13" fill="#FFFFFF"/>' +
              '${targetType === 'store'
                ? '<path d="M14 26V14h14v12h-3v-6h-8v6h-3zm3-8h2v-2h-2v2zm6 0h2v-2h-2v2z" fill="' + destColor + '"/>'
                : '<path d="M21 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" fill="' + destColor + '"/>'
              }' +
            '</svg>'
          ),
          scaledSize: new google.maps.Size(42, 52),
          anchor: new google.maps.Point(21, 52),
        };

        destMarker = new google.maps.Marker({
          position: destCoords,
          map: map,
          icon: destIconSvg,
          title: '${destLabel}',
          zIndex: 101,
        });
      }

      // Calculate driving route via Google Directions API
      if (originCoords && destCoords) {
        calculateRoute();
      } else if (destCoords) {
        map.panTo(destCoords);
      } else if (originCoords) {
        map.panTo(originCoords);
      }
    }

    function calculateRoute() {
      var request = {
        origin: originCoords,
        destination: destCoords,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      };

      directionsService.route(request, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);

          var route = result.routes[0];
          var leg = route.legs[0];

          var steps = [];
          if (leg.steps) {
            for (var i = 0; i < leg.steps.length; i++) {
              var s = leg.steps[i];
              var cleanInstr = s.instructions.replace(/<[^>]*>?/gm, ' ');
              steps.push({
                instruction: cleanInstr.trim(),
                distance: s.distance.text,
                duration: s.duration.text,
              });
            }
          }

          var routeData = {
            distance: leg.distance.text,
            distanceMeters: leg.distance.value,
            duration: leg.duration.text,
            durationSeconds: leg.duration.value,
            steps: steps,
          };

          sendMessage('ROUTE_CALCULATED', routeData);

          // Auto-fit route bounds with pleasant mobile padding
          var bounds = new google.maps.LatLngBounds();
          bounds.extend(originCoords);
          bounds.extend(destCoords);
          map.fitBounds(bounds);
        } else {
          // Fallback fit bounds between origin and destination
          var bounds = new google.maps.LatLngBounds();
          bounds.extend(originCoords);
          bounds.extend(destCoords);
          map.fitBounds(bounds);
        }
      });
    }

    function setupPickerMap() {
      // Idle listener on map center for pinpoint selection
      map.addListener('idle', function() {
        var center = map.getCenter();
        var lat = center.lat();
        var lng = center.lng();

        geocoder.geocode({ location: { lat: lat, lng: lng } }, function(results, status) {
          var formatted = '';
          if (status === 'OK' && results && results[0]) {
            formatted = results[0].formatted_address;
          }
          sendMessage('LOCATION_SELECTED', {
            latitude: lat,
            longitude: lng,
            address: formatted,
          });
        });
      });

      // Tap on map centers pin
      map.addListener('click', function(e) {
        map.panTo(e.latLng);
      });
    }

    // Window interface callable from React Native
    window.recenterMap = function() {
      if (isRoadmap) {
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(originCoords);
        bounds.extend(destCoords);
        map.fitBounds(bounds);
      } else {
        map.panTo(destCoords);
        map.setZoom(16);
      }
    };

    window.toggleTraffic = function(enable) {
      if (enable) {
        trafficLayer.setMap(map);
      } else {
        trafficLayer.setMap(null);
      }
    };

    window.setMapType = function(type) {
      if (map) {
        var resolvedType = (type === 'satellite' || type === 'hybrid')
          ? google.maps.MapTypeId.HYBRID
          : google.maps.MapTypeId.ROADMAP;
        map.setMapTypeId(resolvedType);
      }
    };

    window.searchAddress = function(query) {
      if (!query || !geocoder) return;
      geocoder.geocode({ address: query }, function(results, status) {
        if (status === 'OK' && results && results[0]) {
          var loc = results[0].geometry.location;
          map.panTo(loc);
          map.setZoom(17);
        }
      });
    };

    window.setCenter = function(lat, lng, zoom) {
      if (map) {
        map.panTo({ lat: lat, lng: lng });
        if (zoom) map.setZoom(zoom);
      }
    };

    window.updateDriverPosition = function(lat, lng) {
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
      originCoords = { lat: lat, lng: lng };
      if (originMarker) {
        originMarker.setPosition(originCoords);
      } else if (map) {
        originMarker = new google.maps.Marker({
          position: originCoords,
          map: map,
          icon: driverIconSvg,
          title: 'Driver Location',
          zIndex: 100,
        });
      }
      if (destCoords && directionsService && isRoadmap) {
        calculateRoute();
      }
    };

    window.updateDestination = function(lat, lng, title) {
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
      destCoords = { lat: lat, lng: lng };
      if (destMarker) {
        destMarker.setPosition(destCoords);
        if (title) destMarker.setTitle(title);
      } else if (map) {
        destMarker = new google.maps.Marker({
          position: destCoords,
          map: map,
          icon: destIconSvg,
          title: title || '${destLabel}',
          zIndex: 101,
        });
      }
      if (originCoords && directionsService && isRoadmap) {
        calculateRoute();
      } else if (map) {
        map.panTo(destCoords);
      }
    };

    window.setMapZoom = function(zoom) {
      if (map && typeof zoom === 'number' && !isNaN(zoom)) {
        map.setZoom(zoom);
      }
    };

    window.zoomIn = function() {
      if (map) map.setZoom((map.getZoom() || 15) + 1);
    };

    window.zoomOut = function() {
      if (map) map.setZoom((map.getZoom() || 15) - 1);
    };

    window.onload = initMap;
  </script>
</body>
</html>`;
    }, [
      mode,
      targetType,
      interactive,
      apiKey,
      isDark,
    ]);

    // Handle WebView message bridge
    const handleMessage = useCallback(
      (event: any) => {
        try {
          const raw = event.nativeEvent.data;
          const msg = JSON.parse(raw);

          if (msg.type === 'MAP_READY') {
            setIsMapReady(true);
            setWebViewError(false);
          } else if (msg.type === 'ROUTE_CALCULATED') {
            onRouteCalculated?.(msg.data);
          } else if (msg.type === 'LOCATION_SELECTED') {
            onLocationSelect?.(msg.data);
          } else if (msg.type === 'MAP_ERROR') {
            console.warn('In-App Google Map JS error notice:', msg.data);
          }
        } catch (err) {
          console.warn('handleMessage error:', err);
        }
      },
      [onRouteCalculated, onLocationSelect],
    );

    // Seamlessly update driver position & re-calculate route in WebView when safeOrigin changes
    useEffect(() => {
      if (isMapReady && safeOrigin?.latitude && safeOrigin?.longitude) {
        webViewRef.current?.injectJavaScript(`
          if (window.updateDriverPosition) {
            window.updateDriverPosition(${safeOrigin.latitude}, ${safeOrigin.longitude});
          }
          true;
        `);
      }
    }, [isMapReady, safeOrigin?.latitude, safeOrigin?.longitude]);

    // Seamlessly update destination & re-calculate route in WebView when safeDest changes
    useEffect(() => {
      if (isMapReady && safeDest?.latitude && safeDest?.longitude) {
        webViewRef.current?.injectJavaScript(`
          if (window.updateDestination) {
            window.updateDestination(${safeDest.latitude}, ${safeDest.longitude}, ${JSON.stringify(safeDest.title || '')});
          }
          true;
        `);
      }
    }, [isMapReady, safeDest?.latitude, safeDest?.longitude, safeDest?.title]);

    // Dynamic fallback Static Map if WebView is unavailable or encounters error
    const [fallbackZoom, setFallbackZoom] = useState(initialZoom);
    const [fallbackPan] = useState(new Animated.ValueXY({ x: 0, y: 0 }));

    const fallbackPanResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderMove: Animated.event(
            [null, { dx: fallbackPan.x, dy: fallbackPan.y }],
            { useNativeDriver: false },
          ),
          onPanResponderRelease: () => {
            Animated.spring(fallbackPan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              friction: 6,
            }).start();
          },
        }),
      [fallbackPan],
    );

    const staticMapFallbackUrl = useMemo(() => {
      const destColor = targetType === 'store' ? 'green' : 'red';
      const destLabel = targetType === 'store' ? 'S' : 'C';
      const mapTypeParam =
        currentMapType === 'hybrid' || currentMapType === 'satellite' ? 'hybrid' : 'roadmap';

      if (mode === 'roadmap') {
        const polylineParam = routePolyline
          ? `&path=weight:5%7Ccolor:0x1E40AF%7Cenc:${encodeURIComponent(routePolyline)}`
          : '';
        const originMarkerParam = safeOrigin
          ? `&markers=color:blue%7Clabel:V%7C${safeOrigin.latitude},${safeOrigin.longitude}`
          : '';
        const destMarkerParam = safeDest
          ? `&markers=color:${destColor}%7Clabel:${destLabel}%7C${safeDest.latitude},${safeDest.longitude}`
          : '';

        if (!safeDest && !safeOrigin) return '';

        // OMIT center and zoom so Google Static Maps automatically frames all markers and the entire road route
        return `https://maps.googleapis.com/maps/api/staticmap?size=640x960&scale=2&maptype=${mapTypeParam}&format=png&visual_refresh=true${originMarkerParam}${destMarkerParam}${polylineParam}&key=${apiKey}`;
      }
      if (!safeDest) return '';
      return `https://maps.googleapis.com/maps/api/staticmap?center=${safeDest.latitude},${safeDest.longitude}&zoom=${fallbackZoom}&size=640x960&scale=2&maptype=${mapTypeParam}&format=png&visual_refresh=true&markers=color:red%7C${safeDest.latitude},${safeDest.longitude}&key=${apiKey}`;
    }, [mode, targetType, currentMapType, safeOrigin, safeDest, routePolyline, fallbackZoom, apiKey]);

    const handleFallbackZoomIn = () => {
      setFallbackZoom(prev => Math.min(prev + 1, 19));
    };

    const handleFallbackZoomOut = () => {
      setFallbackZoom(prev => Math.max(prev - 1, 10));
    };

    const handleToggleTraffic = () => {
      const next = !trafficEnabled;
      setTrafficEnabled(next);
      webViewRef.current?.injectJavaScript(`
        if (window.toggleTraffic) { window.toggleTraffic(${next}); }
        true;
      `);
    };

    const handleToggleMapType = () => {
      const nextType = currentMapType === 'roadmap' ? 'hybrid' : 'roadmap';
      setCurrentMapType(nextType);
      webViewRef.current?.injectJavaScript(`
        if (window.setMapType) { window.setMapType('${nextType}'); }
        true;
      `);
    };

    const handleRecenter = () => {
      webViewRef.current?.injectJavaScript(`
        if (window.recenterMap) { window.recenterMap(); }
        true;
      `);
    };

    // Render Webview or Fallback
    const renderContent = () => {
      if (!WebViewComponent || webViewError) {
        return (
          <View style={StyleSheet.absoluteFill} {...fallbackPanResponder.panHandlers}>
            <Animated.Image
              source={{ uri: staticMapFallbackUrl }}
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: fallbackPan.x },
                    { translateY: fallbackPan.y },
                  ],
                },
              ]}
              resizeMode="cover"
            />
          </View>
        );
      }

      return (
        <WebViewComponent
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml, baseUrl: 'https://maps.googleapis.com' }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          scalesPageToFit={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          androidHardwareAccelerationDisabled={false}
          setSupportMultipleWindows={false}
          onMessage={handleMessage}
          onError={(e: any) => {
            console.warn('In-App Google Map WebView Error:', e.nativeEvent);
            if (!isMapReady) {
              setWebViewError(true);
            }
          }}
          onHttpError={(e: any) => {
            console.warn('In-App Google Map HTTP warning:', e.nativeEvent?.statusCode, e.nativeEvent?.url);
          }}
          startInLoadingState={false}
        />
      );
    };

    return (
      <View
        style={[
          styles.container,
          { height, backgroundColor: isDark ? '#0f172a' : '#e2e8f0' },
          style,
        ]}
      >
        {renderContent()}

        {/* Loading Indicator */}
        {!isMapReady && !webViewError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
              Loading Live Google Map...
            </Text>
          </View>
        )}

        {/* Floating Controls Overlay (Sleek Google Map Style) */}
        {interactive && (
          <View style={styles.floatingControlsContainer}>
            {/* Traffic Toggle */}
            {showTrafficControls && (
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  {
                    backgroundColor: trafficEnabled ? '#2563EB' : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleToggleTraffic}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="car-outline"
                  size={19}
                  color={trafficEnabled ? '#FFFFFF' : colors.textPrimary}
                />
              </TouchableOpacity>
            )}

            {/* Map Type Toggle (Satellite vs Standard Roadmap) */}
            {showTypeToggle && (
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  {
                    backgroundColor:
                      currentMapType === 'satellite' || currentMapType === 'hybrid'
                        ? '#2563EB'
                        : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleToggleMapType}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={currentMapType === 'satellite' || currentMapType === 'hybrid' ? 'earth' : 'layers-outline'}
                  size={19}
                  color={
                    currentMapType === 'satellite' || currentMapType === 'hybrid'
                      ? '#FFFFFF'
                      : colors.textPrimary
                  }
                />
              </TouchableOpacity>
            )}

            {/* Recenter Bounds */}
            {showRecenterButton && (
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={handleRecenter}
                activeOpacity={0.8}
              >
                <Ionicons name="locate" size={19} color="#2563EB" />
              </TouchableOpacity>
            )}

            {/* Zoom Controls (+ / -) */}
            {showZoomControls && (
              <View style={[styles.fallbackZoomGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.fallbackZoomBtn}
                  onPress={() => {
                    handleFallbackZoomIn();
                    webViewRef.current?.injectJavaScript(`
                      if (window.zoomIn) { window.zoomIn(); }
                      else if (window.map) { window.map.setZoom((window.map.getZoom() || 15) + 1); }
                      true;
                    `);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={[styles.fallbackDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.fallbackZoomBtn}
                  onPress={() => {
                    handleFallbackZoomOut();
                    webViewRef.current?.injectJavaScript(`
                      if (window.zoomOut) { window.zoomOut(); }
                      else if (window.map) { window.map.setZoom((window.map.getZoom() || 15) - 1); }
                      true;
                    `);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  },
);

InteractiveGoogleMap.displayName = 'InteractiveGoogleMap';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  floatingControlsContainer: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    zIndex: 50,
    gap: 10,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  fallbackZoomGroup: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  fallbackZoomBtn: {
    width: 42,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackDivider: {
    height: 1,
    width: '100%',
  },
});
