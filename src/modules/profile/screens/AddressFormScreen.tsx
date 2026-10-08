import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_SETTINGS, GOOGLE_SETTINGS } from '../../../app/config';
import { AppHeader, MapPreview, useStatusModal } from '../../../components';
import { useLocation, UserLocation } from '../../location';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useAddress } from '../context/AddressContext';
import { AddressType, SavedAddress } from '../types/address';

interface AddressFormScreenProps {
  addressToEdit?: SavedAddress;
  onBack: () => void;
  onAddressSaved: () => void;
}

export const AddressFormScreen: React.FC<AddressFormScreenProps> = ({
  addressToEdit,
  onBack,
  onAddressSaved,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const { location, fetchLiveGpsLocation, setManualLocation } = useLocation();
  const { addresses, addAddress, updateAddress, setDefaultAddress, selectAddress } = useAddress();
  const { showStatusModal } = useStatusModal();

  const scrollViewRef = useRef<any>(null);
  const isEditing = Boolean(addressToEdit);

  // Form State initialized directly from addressToEdit or current active location
  const [receiverName, setReceiverName] = useState<string>(
    addressToEdit?.name || user?.name || ''
  );
  const [receiverPhone, setReceiverPhone] = useState<string>(
    addressToEdit?.phone || user?.phone || ''
  );
  const [pincode, setPincode] = useState<string>(
    addressToEdit?.pincode || location.postalCode || API_SETTINGS.defaultPostalCode
  );
  const [city, setCity] = useState<string>(
    addressToEdit?.city || location.city || API_SETTINGS.defaultCity
  );
  const [state, setState] = useState<string>(
    addressToEdit?.state || location.state || API_SETTINGS.defaultState
  );
  const [flatNo, setFlatNo] = useState<string>(addressToEdit?.flatNo || '');
  const [streetArea, setStreetArea] = useState<string>(
    addressToEdit?.streetArea || location.locality || location.shortAddress || ''
  );
  const [landmark, setLandmark] = useState<string>(addressToEdit?.landmark || '');
  const [addressType, setAddressType] = useState<AddressType>(
    addressToEdit?.type || 'HOME'
  );
  const [isDefault, setIsDefault] = useState<boolean>(
    addressToEdit ? addressToEdit.isDefault : addresses.length === 0
  );

  // Focus & Validation state
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsDetected, setGpsDetected] = useState<boolean>(Boolean(location.shortAddress));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Bind reverse-geocoded location data directly into the input fields below
  const bindLocationToFields = (loc: Partial<UserLocation>) => {
    const resolvedStreet =
      loc.street ||
      loc.subLocality ||
      loc.locality ||
      loc.shortAddress ||
      '';

    if (resolvedStreet) {
      setStreetArea(resolvedStreet);
    }
    if (loc.city) {
      setCity(loc.city);
    }
    if (loc.state) {
      setState(loc.state);
    }
    if (loc.postalCode) {
      setPincode(loc.postalCode);
    }
    if (loc.houseNumber) {
      setFlatNo(loc.houseNumber);
    }
    if (loc.coordinates) {
      setCoords({
        latitude: loc.coordinates.latitude,
        longitude: loc.coordinates.longitude,
      });
    }

    setGpsDetected(true);

    // Clear validation errors for auto-filled fields
    setErrors(prev => {
      const next = { ...prev };
      delete next.streetArea;
      delete next.city;
      delete next.state;
      delete next.pincode;
      if (loc.houseNumber) delete next.flatNo;
      return next;
    });
  };

  const showPermissionRequiredModal = () => {
    showStatusModal({
      type: 'warning',
      iconName: 'shield-checkmark-outline',
      title: 'Location Permission Needed',
      message:
        'LB Delivery requires location permission to show your current location on the map and auto-fill your address.',
      confirmText: 'Open Settings',
      cancelText: 'Enter Manually',
      onConfirm: () => {
        Linking.openSettings().catch(() => {});
      },
    });
  };

  const showGpsTurnOnModal = () => {
    showStatusModal({
      type: 'warning',
      iconName: 'location-outline',
      title: 'Turn On Device Location',
      message:
        'Please turn on GPS / Location service on your device to auto-detect your exact pinpoint delivery address on the map.',
      confirmText: 'Open Settings',
      cancelText: 'Enter Manually',
      onConfirm: () => {
        if (Platform.OS === 'android') {
          Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
            Linking.openSettings().catch(() => {});
          });
        } else {
          Linking.openSettings().catch(() => {});
        }
      },
    });
  };

  const checkAndRequestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const fineCheck = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      const coarseCheck = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );

      if (fineCheck || coarseCheck) return true;

      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const granted =
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

      return granted;
    } catch (err) {
      console.warn('Permission check error:', err);
      return false;
    }
  };

  const handleUseCurrentLocation = async (isAutoMount = false) => {
    try {
      setIsLocating(true);

      // 1. Check & Request Permissions
      const hasPermission = await checkAndRequestPermission();
      if (!hasPermission) {
        setIsLocating(false);
        if (!isAutoMount) {
          showPermissionRequiredModal();
        }
        return;
      }

      // 2. Check Device GPS Hardware Enabled
      let isGpsEnabled = true;
      try {
        if (DeviceInfo?.isLocationEnabled) {
          isGpsEnabled = await DeviceInfo.isLocationEnabled();
        }
      } catch (checkErr) {
        console.warn('DeviceInfo.isLocationEnabled error:', checkErr);
      }

      if (!isGpsEnabled) {
        setIsLocating(false);
        if (!isAutoMount) {
          showGpsTurnOnModal();
        }
        return;
      }

      // 3. Fetch Live Location & Reverse-Geocode
      const liveLoc = await fetchLiveGpsLocation();
      if (liveLoc) {
        bindLocationToFields(liveLoc);
      } else if (!isAutoMount) {
        showStatusModal({
          type: 'warning',
          title: 'Location Unavailable',
          message:
            'Could not acquire live GPS signal. Please enter your address details manually.',
          buttonText: 'OK',
        });
      }
    } catch (err) {
      console.warn('handleUseCurrentLocation error:', err);
    } finally {
      setIsLocating(false);
    }
  };

  // Auto-detect current location on mount if adding a new address
  useEffect(() => {
    if (!isEditing) {
      if (location.isLiveGps && (location.locality || location.shortAddress)) {
        bindLocationToFields(location);
      } else {
        handleUseCurrentLocation(true);
      }
    }
  }, [isEditing]);

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(() => {
    return {
      latitude: (addressToEdit as any)?.latitude || location.coordinates?.latitude || API_SETTINGS.defaultCoordinates?.latitude || 13.0827,
      longitude: (addressToEdit as any)?.longitude || location.coordinates?.longitude || API_SETTINGS.defaultCoordinates?.longitude || 80.2707,
    };
  });

  const [mapZoom, setMapZoom] = useState<number>(16);

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 1, 19));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => Math.max(prev - 1, 10));
  };

  const googleApiKey = (
    (API_SETTINGS as any).googleMap?.key ||
    GOOGLE_SETTINGS.mapsApiKey ||
    'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc'
  ).trim().replace(/\.+$/, '');

  const googleMapUri = useMemo(() => {
    const lat = coords.latitude || 13.0827;
    const lon = coords.longitude || 80.2707;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=${mapZoom}&size=640x360&scale=2&maptype=roadmap&format=png&visual_refresh=true&key=${googleApiKey}`;
  }, [coords.latitude, coords.longitude, mapZoom, googleApiKey]);

  // Form Validation
  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!receiverName.trim()) {
      errs.receiverName = 'Please enter receiver full name';
    }
    const cleanPhone = receiverPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      errs.receiverPhone = 'Mobile number is required';
    } else if (cleanPhone.length !== 10) {
      errs.receiverPhone = 'Enter a valid 10-digit mobile number';
    }
    if (!pincode.trim() || pincode.replace(/\D/g, '').length !== 6) {
      errs.pincode = 'Enter a valid 6-digit Pincode';
    }
    if (!flatNo.trim()) {
      errs.flatNo = 'House / Flat / Building No. is required';
    }
    if (!streetArea.trim()) {
      errs.streetArea = 'Road / Street / Area is required';
    }
    if (!city.trim()) {
      errs.city = 'City is required';
    }
    if (!state.trim()) {
      errs.state = 'State is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (!isEditing && addresses.length >= 5) {
      showStatusModal({
        type: 'warning',
        title: 'Address Limit Reached',
        message:
          'You can save a maximum of 5 delivery addresses. Please remove an unused address before adding a new one.',
        buttonText: 'OK',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPhone = receiverPhone.replace(/\D/g, '').slice(-10);

      if (isEditing && addressToEdit) {
        await updateAddress(addressToEdit.id, {
          name: receiverName.trim(),
          phone: cleanPhone,
          pincode: pincode.trim(),
          flatNo: flatNo.trim(),
          streetArea: streetArea.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          type: addressType,
          isDefault,
        });
        if (isDefault) {
          await setDefaultAddress(addressToEdit.id);
        }
        selectAddress(addressToEdit.id);
      } else {
        const saved = await addAddress({
          name: receiverName.trim(),
          phone: cleanPhone,
          pincode: pincode.trim(),
          flatNo: flatNo.trim(),
          streetArea: streetArea.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          type: addressType,
          isDefault,
        });
        selectAddress(saved.id);
        if (isDefault) {
          await setDefaultAddress(saved.id);
        }
      }

      // Sync active global location state
      const shortAddr = `${flatNo.trim()}, ${streetArea.trim()}`;
      const fullAddr = `${flatNo.trim()}, ${landmark ? landmark.trim() + ', ' : ''}${streetArea.trim()}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;
      setManualLocation(shortAddr, fullAddr);

      showStatusModal({
        type: 'success',
        title: isEditing ? 'Address Updated' : 'Address Saved',
        message: 'Your delivery address has been saved successfully.',
        buttonText: 'OK',
        onConfirm: onAddressSaved,
      });
    } catch (err: any) {
      console.warn('Save address error:', err);
      showStatusModal({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Could not save address. Please try again.',
        buttonText: 'OK',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isEditing ? 'Edit Delivery Address' : 'Add Delivery Address'}
        onBack={onBack}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 100, 130) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 🗺️ Interactive Delivery Map View Preview Card */}
          <View
            style={[
              styles.mapCard,
              {
                backgroundColor: colors.surface,
                borderColor: gpsDetected ? colors.primary : colors.border,
              },
            ]}
          >
            {/* Map Canvas with Pin & Controls */}
            <View style={[styles.mapCanvas, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
              {/* Google Maps Layer */}
              <Image
                key={googleMapUri}
                source={{ uri: googleMapUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />

              {/* Top Map Badges */}
              <View style={styles.mapTopBar}>
                <View style={[styles.mapBadge, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.mapBadgeText}>DELIVERY LOCATION PIN</Text>
                </View>
              </View>

              {/* Centered Animated Pin Marker */}
              <View pointerEvents="none" style={styles.centerPinContainer}>
                <View style={[styles.pinPulseRing, { backgroundColor: `${colors.primary}30` }]} />
                <View style={[styles.pinCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="location" size={20} color={colors.onPrimary} />
                </View>
                <View style={styles.pinShadow} />
              </View>

              {/* Floating Zoom Controls */}
              <View style={styles.zoomControlsCol}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleZoomIn}
                  style={[styles.zoomBtn, { backgroundColor: colors.surface }]}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleZoomOut}
                  style={[styles.zoomBtn, { backgroundColor: colors.surface }]}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Floating Locate Me GPS Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleUseCurrentLocation(false)}
                disabled={isLocating}
                style={[
                  styles.locateFloatingBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="navigate" size={18} color={colors.onPrimary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Address Details Under Map */}
            <View style={styles.mapAddressInfoBox}>
              <View style={styles.locationHeroTopRow}>
                <View style={[styles.locationIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Ionicons name="navigate-circle" size={26} color={colors.primary} />
                </View>

                <View style={styles.locationHeroTextCol}>
                  <View style={styles.detectedPill}>
                    <View style={[styles.statusDot, { backgroundColor: gpsDetected ? '#10B981' : colors.primary }]} />
                    <Text style={[styles.detectedPillText, { color: colors.primary }]}>
                      {gpsDetected ? 'SELECTED LOCATION' : 'DELIVERY PINPOINT'}
                    </Text>
                  </View>

                  <Text style={[styles.locationTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {streetArea || location.locality || location.shortAddress || 'Select Delivery Location'}
                  </Text>

                  <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                    {city ? `${city}, ${state} - ${pincode}` : 'Auto-fill address inputs from your current GPS'}
                  </Text>
                </View>
              </View>

              {/* Action Button: Auto Detect / Re-center Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleUseCurrentLocation(false)}
                disabled={isLocating}
                style={[
                  styles.autoFillButton,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.autoFillButtonText, { color: colors.primary }]}>
                  {isLocating ? 'Detecting Live GPS...' : 'Use Current Location to Auto-Fill'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 1: Contact Details */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconCircle, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons name="person" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Contact Information
              </Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Full Name <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: errors.receiverName
                      ? colors.error
                      : focusedField === 'name'
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={focusedField === 'name' ? colors.primary : colors.textTertiary}
                  style={styles.fieldLeadingIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={receiverName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={text => {
                    setReceiverName(text);
                    if (errors.receiverName) setErrors(prev => ({ ...prev, receiverName: '' }));
                  }}
                />
              </View>
              {errors.receiverName ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.receiverName}
                </Text>
              ) : null}
            </View>

            {/* 10-Digit Mobile Number with Country Code */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                10-Digit Mobile Number <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: errors.receiverPhone
                      ? colors.error
                      : focusedField === 'phone'
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <View style={[styles.countryCodeBadge, { borderRightColor: colors.border }]}>
                  <Text style={[styles.countryCodeText, { color: colors.textPrimary }]}>+91</Text>
                </View>
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary, paddingLeft: 10 }]}
                  placeholder="98400 12345"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={receiverPhone}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={text => {
                    const digits = text.replace(/\D/g, '');
                    setReceiverPhone(digits);
                    if (errors.receiverPhone) setErrors(prev => ({ ...prev, receiverPhone: '' }));
                  }}
                />
              </View>
              {errors.receiverPhone ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.receiverPhone}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Section 2: Address Details */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 14 }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconCircle, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons name="home" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Address Details
              </Text>
            </View>

            {/* Pincode & City 2-Column Row */}
            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Pincode <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.surfaceVariant,
                      borderColor: errors.pincode
                        ? colors.error
                        : focusedField === 'pincode'
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={17}
                    color={focusedField === 'pincode' ? colors.primary : colors.textTertiary}
                    style={styles.fieldLeadingIcon}
                  />
                  <TextInput
                    style={[styles.inputField, { color: colors.textPrimary }]}
                    placeholder="600002"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={pincode}
                    onFocus={() => setFocusedField('pincode')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={text => {
                      const clean = text.replace(/\D/g, '');
                      setPincode(clean);
                      if (errors.pincode) setErrors(prev => ({ ...prev, pincode: '' }));
                    }}
                  />
                </View>
                {errors.pincode ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {errors.pincode}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  City / District <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.surfaceVariant,
                      borderColor: errors.city
                        ? colors.error
                        : focusedField === 'city'
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="business-outline"
                    size={17}
                    color={focusedField === 'city' ? colors.primary : colors.textTertiary}
                    style={styles.fieldLeadingIcon}
                  />
                  <TextInput
                    style={[styles.inputField, { color: colors.textPrimary }]}
                    placeholder="Chennai"
                    placeholderTextColor={colors.inputPlaceholder}
                    value={city}
                    onFocus={() => setFocusedField('city')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={text => {
                      setCity(text);
                      if (errors.city) setErrors(prev => ({ ...prev, city: '' }));
                    }}
                  />
                </View>
                {errors.city ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {errors.city}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* State */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                State <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: errors.state
                      ? colors.error
                      : focusedField === 'state'
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="map-outline"
                  size={17}
                  color={focusedField === 'state' ? colors.primary : colors.textTertiary}
                  style={styles.fieldLeadingIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  placeholder="Tamil Nadu"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={state}
                  onFocus={() => setFocusedField('state')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={text => {
                    setState(text);
                    if (errors.state) setErrors(prev => ({ ...prev, state: '' }));
                  }}
                />
              </View>
              {errors.state ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.state}
                </Text>
              ) : null}
            </View>

            {/* House No / Building Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                House No., Building Name, Floor, Flat <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: errors.flatNo
                      ? colors.error
                      : focusedField === 'flatNo'
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="home-outline"
                  size={17}
                  color={focusedField === 'flatNo' ? colors.primary : colors.textTertiary}
                  style={styles.fieldLeadingIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  placeholder="e.g. Door No. 4B, Emerald Flats"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={flatNo}
                  onFocus={() => setFocusedField('flatNo')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={text => {
                    setFlatNo(text);
                    if (errors.flatNo) setErrors(prev => ({ ...prev, flatNo: '' }));
                  }}
                />
              </View>
              {errors.flatNo ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.flatNo}
                </Text>
              ) : null}
            </View>

            {/* Road Name / Area / Colony */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Road Name, Area, Colony, Street <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: errors.streetArea
                      ? colors.error
                      : focusedField === 'streetArea'
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="navigate-outline"
                  size={17}
                  color={focusedField === 'streetArea' ? colors.primary : colors.textTertiary}
                  style={styles.fieldLeadingIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  placeholder="e.g. 1st Main Road, Anna Nagar West"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={streetArea}
                  onFocus={() => setFocusedField('streetArea')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={text => {
                    setStreetArea(text);
                    if (errors.streetArea) setErrors(prev => ({ ...prev, streetArea: '' }));
                  }}
                />
              </View>
              {errors.streetArea ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.streetArea}
                </Text>
              ) : null}
            </View>

            {/* Nearby Landmark (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Nearby Landmark (Optional)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: focusedField === 'landmark' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="flag-outline"
                  size={17}
                  color={focusedField === 'landmark' ? colors.primary : colors.textTertiary}
                  style={styles.fieldLeadingIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  placeholder="e.g. Near Nilgiris Supermarket or Water Tank"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={landmark}
                  onFocus={() => setFocusedField('landmark')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setLandmark}
                />
              </View>
            </View>
          </View>

          {/* Section 3: Type of Address (Flipkart exact style) */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 14 }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconCircle, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons name="pricetag" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Type of Address
              </Text>
            </View>

            <View style={styles.typeChipsRow}>
              {(
                [
                  { type: 'HOME', label: 'Home', subtitle: 'All-day delivery', icon: 'home' },
                  { type: 'WORK', label: 'Work', subtitle: '10 AM - 6 PM', icon: 'briefcase' },
                  { type: 'OTHER', label: 'Other', subtitle: 'Standard delivery', icon: 'location' },
                ] as const
              ).map(item => {
                const isSelected = addressType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => setAddressType(item.type)}
                    activeOpacity={0.8}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: isSelected ? `${colors.primary}12` : colors.surfaceVariant,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <View style={styles.typeChipTopRow}>
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.typeChipLabel,
                          {
                            color: isSelected ? colors.primary : colors.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                    <Text style={[styles.typeChipSubtitle, { color: colors.textSecondary }]}>
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Set as Default Address Toggle */}
            <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>
                  Make this my default address
                </Text>
                <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>
                  Automatically selected for fast 1-click checkout
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Flipkart Style Primary Action Button */}
        <View
          style={[
            styles.bottomStickyBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 10, 16),
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isSubmitting || (!isEditing && addresses.length >= 5)}
            onPress={handleSave}
            style={[
              styles.saveButton,
              {
                backgroundColor: !isEditing && addresses.length >= 5 ? colors.surfaceVariant : colors.primary,
                borderRadius: borderRadius.lg,
                opacity: isSubmitting ? 0.8 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons
                name={!isEditing && addresses.length >= 5 ? 'lock-closed' : 'checkmark-circle'}
                size={18}
                color={!isEditing && addresses.length >= 5 ? colors.textSecondary : colors.onPrimary}
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              style={[
                styles.saveButtonText,
                { color: !isEditing && addresses.length >= 5 ? colors.textSecondary : colors.onPrimary },
              ]}
            >
              {isSubmitting
                ? 'Saving Address...'
                : !isEditing && addresses.length >= 5
                ? 'Address Limit Reached (Max 5)'
                : isEditing
                ? 'Update Delivery Address'
                : 'Save Address & Deliver Here'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mapCard: {
    borderRadius: 16,
    borderWidth: 1.2,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3.5,
  },
  mapCanvas: {
    height: 200,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTilesAnchor: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  mapTileImage: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  mapErrorFallback: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 3,
  },
  mapErrorText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 8,
  },
  retryMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryMapBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  mapTopBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  mapBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  mapTypeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 12,
    marginLeft: 6,
  },
  mapTypeToggleText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  centerPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  pinPulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  pinShadow: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 2,
  },
  zoomControlsCol: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    width: '100%',
  },
  locateFloatingBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  mapAddressInfoBox: {
    padding: 14,
  },
  locationHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  locationHeroTextCol: {
    flex: 1,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  detectedPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  locationSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  autoFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9.5,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  autoFillButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  formCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  twoColRow: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fieldLeadingIcon: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10.5,
    fontSize: 13.5,
    fontWeight: '500',
  },
  countryCodeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10.5,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  typeChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    padding: 10,
    borderWidth: 1.2,
    alignItems: 'flex-start',
  },
  typeChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  typeChipLabel: {
    fontSize: 13,
  },
  typeChipSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 12,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  switchSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  bottomStickyBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

export default AddressFormScreen;
