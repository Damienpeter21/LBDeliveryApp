import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import {
  InteractiveGoogleMap,
  InteractiveGoogleMapRef,
} from './InteractiveGoogleMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SelectedLocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface InteractiveMapPickerModalProps {
  visible: boolean;
  initialLocation?: { latitude: number; longitude: number };
  initialAddressText?: string;
  onClose: () => void;
  onSelectLocation: (location: SelectedLocationData) => void;
}

export const InteractiveMapPickerModal: React.FC<InteractiveMapPickerModalProps> = ({
  visible,
  initialLocation,
  initialAddressText,
  onClose,
  onSelectLocation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<InteractiveGoogleMapRef>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  }>(() => {
    return initialLocation || { latitude: 12.5855, longitude: 78.6433 };
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    initialAddressText || 'Pinpointing location on Google Map...',
  );
  const [isSearching, setIsSearching] = useState(false);

  const handleLocationSelect = (loc: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    setSelectedCoords({ latitude: loc.latitude, longitude: loc.longitude });
    if (loc.address) {
      setResolvedAddress(loc.address);
    }
  };

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);
    mapRef.current?.searchAddress(searchQuery.trim());
    setTimeout(() => setIsSearching(false), 800);
  };

  const handleConfirm = () => {
    onSelectLocation({
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      address: resolvedAddress,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Full-Screen Interactive Google Map Canvas with Pan & 2-Finger Pinch Zoom */}
        <InteractiveGoogleMap
          ref={mapRef}
          mode="picker"
          destination={{
            latitude: selectedCoords.latitude,
            longitude: selectedCoords.longitude,
            title: 'Selected Point',
          }}
          initialZoom={16}
          onLocationSelect={handleLocationSelect}
          showTrafficControls={false}
          showRecenterButton
          showTypeToggle
          interactive
        />

        {/* Top Floating Search & Header Bar */}
        <View style={[styles.topHeaderContainer, { top: Math.max(insets.top + 10, 36) }]}>
          <View
            style={[
              styles.searchBarCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: '#000',
              },
            ]}
          >
            <TouchableOpacity
              onPress={onClose}
              style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search area, landmark or street..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                autoCorrect={false}
              />
              {!!searchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSearchSubmit}
              style={[styles.searchActionBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Instruction Banner */}
        <View style={[styles.instructionBanner, { top: Math.max(insets.top + 72, 98) }]}>
          <View style={styles.bannerPill}>
            <Ionicons name="hand-left-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.bannerText}>
              Pinch to zoom • Drag map or tap to pinpoint exact address
            </Text>
          </View>
        </View>

        {/* Bottom Location Confirmation Sheet */}
        <View
          style={[
            styles.bottomSheetCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 12, 20),
            },
          ]}
        >
          {/* Location Details Info */}
          <View style={styles.locationDetailsRow}>
            <View style={[styles.locationBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="location" size={22} color={colors.primary} />
            </View>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.locationHeading, { color: colors.textSecondary }]}>
                SELECTED LOCATION PIN
              </Text>
              <Text style={[styles.locationAddressText, { color: colors.textPrimary }]} numberOfLines={2}>
                {resolvedAddress || 'Loading address details...'}
              </Text>
              <Text style={[styles.coordsText, { color: colors.textSecondary }]}>
                {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.selectBtnText}>Select Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  topHeaderContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 100,
  },
  searchBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
  },
  searchActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
    pointerEvents: 'none',
  },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSheetCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  locationDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  locationBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  locationHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  locationAddressText: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  coordsText: {
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
