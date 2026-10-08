import React, { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_SETTINGS, GOOGLE_SETTINGS } from '../../app/config';
import { useTheme } from '../../theme';

export interface MapPreviewProps {
  latitude: number;
  longitude: number;
  height?: number;
  initialZoom?: number;
  showControls?: boolean;
  showPin?: boolean;
  badgeText?: string;
  onRefresh?: () => void;
  style?: any;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  latitude,
  longitude,
  height = 190,
  initialZoom = 16,
  showControls = true,
  showPin = true,
  badgeText = 'DELIVERY LOCATION PIN',
  onRefresh,
  style,
}) => {
  const { isDark, borderRadius } = useTheme();
  const [zoom, setZoom] = useState<number>(initialZoom);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 1, 19));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 1, 10));
  };

  // Google Maps Static API endpoint from configuration
  const googleApiKey = (
    (API_SETTINGS as any).googleMap?.key ||
    GOOGLE_SETTINGS.mapsApiKey ||
    'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc'
  ).trim().replace(/\.+$/, '');

  const googleStaticMapUrl = useMemo(() => {
    const safeLat = Math.max(-85.0511, Math.min(85.0511, isNaN(latitude) ? 13.0827 : latitude));
    const safeLon = Math.max(-180, Math.min(180, isNaN(longitude) ? 80.2707 : longitude));
    return `https://maps.googleapis.com/maps/api/staticmap?center=${safeLat},${safeLon}&zoom=${zoom}&size=640x360&scale=2&maptype=roadmap&format=png&visual_refresh=true&markers=color:red%7C${safeLat},${safeLon}&key=${googleApiKey}`;
  }, [latitude, longitude, zoom, googleApiKey]);

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
          borderRadius: borderRadius.md,
        },
        style,
      ]}
    >
      {/* Google Maps Static Preview Layer (Standard Industry Roadmap) */}
      <Image
        key={googleStaticMapUrl}
        source={{ uri: googleStaticMapUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Top Controls & Badge */}
      <View style={styles.topBar}>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : <View />}
      </View>

      {/* Zoom Controls (+ / -) */}
      {showControls && (
        <View style={styles.zoomControlWrapper}>
          <TouchableOpacity
            onPress={handleZoomIn}
            activeOpacity={0.8}
            style={[
              styles.zoomBtn,
              {
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(255,255,255,0.2)',
              },
            ]}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleZoomOut}
            activeOpacity={0.8}
            style={[
              styles.zoomBtn,
              {
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderBottomLeftRadius: 6,
                borderBottomRightRadius: 6,
              },
            ]}
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Center Pin Indicator */}
      {showPin && (
        <View pointerEvents="none" style={styles.pinContainer}>
          <View style={styles.pinShadow} />
          <View style={styles.pinIconBox}>
            <Ionicons name="location" size={32} color="#EF4444" />
          </View>
        </View>
      )}

      {/* Map Attribution Bar */}
      <View style={styles.attributionBar}>
        <Text style={styles.attributionText}>© Google Maps</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  zoomControlWrapper: {
    position: 'absolute',
    right: 10,
    bottom: 24,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  zoomBtn: {
    width: 32,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  pinIconBox: {
    marginBottom: 16,
  },
  pinShadow: {
    position: 'absolute',
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    bottom: '50%',
    marginBottom: -2,
  },
  attributionBar: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
