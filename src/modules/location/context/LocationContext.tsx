import React, { createContext, useContext, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { API_SETTINGS } from '../../../app/config';
import { reverseGeocodeCoordinates } from '../services/geocodingService';
import { LocationCoordinates, UserLocation } from '../types';

export interface LocationContextType {
  location: UserLocation;
  fetchLiveGpsLocation: () => Promise<UserLocation | null>;
  setManualLocation: (shortAddress: string, fullAddress: string) => void;
  isPickerVisible: boolean;
  openLocationPicker: () => void;
  closeLocationPicker: () => void;
}

const DEFAULT_LOCATION: UserLocation = {
  shortAddress: '',
  formattedAddress: '',
  locality: '',
  city: API_SETTINGS.defaultCity,
  state: API_SETTINGS.defaultState,
  postalCode: API_SETTINGS.defaultPostalCode,
  coordinates: API_SETTINGS.defaultCoordinates,
  isLiveGps: false,
  isLoading: false,
  error: null,
};

export const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [isPickerVisible, setIsPickerVisible] = useState<boolean>(false);

  const requestAndroidPermission = async (): Promise<boolean> => {
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

      return (
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('Location permission request error:', err);
      return false;
    }
  };

  const fetchLiveGpsLocation = async (): Promise<UserLocation | null> => {
    setLocation(prev => ({ ...prev, isLoading: true, error: null }));

    const hasPermission = await requestAndroidPermission();
    if (!hasPermission) {
      setLocation(prev => ({
        ...prev,
        isLoading: false,
        error: 'Location permission denied. Using default address.',
      }));
      return null;
    }

    try {
      Geolocation?.setRNConfiguration?.({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        locationProvider: 'auto',
      });
    } catch (confErr) {
      console.warn('Geolocation config warning:', confErr);
    }

    const getPosition = (highAccuracy: boolean, timeoutMs: number): Promise<any> => {
      return new Promise((resolve, reject) => {
        try {
          if (!Geolocation?.getCurrentPosition) {
            reject(new Error('Geolocation native module not available'));
            return;
          }
          Geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: 10000,
          });
        } catch (callErr) {
          reject(callErr);
        }
      });
    };

    let position: any = null;

    // 1. Try GPS satellite fix (5s)
    try {
      position = await getPosition(true, 5000);
    } catch (gpsErr) {
      console.log('High accuracy GPS notice, attempting network provider:', gpsErr);
    }

    // 2. If indoor / timeout, fallback to Network/Wi-Fi provider (works indoors in ~300ms)
    if (!position) {
      try {
        position = await getPosition(false, 10000);
      } catch (netErr) {
        console.log('Network provider error:', netErr);
      }
    }

    if (!position) {
      setLocation(prev => ({
        ...prev,
        isLoading: false,
        error: 'Unable to retrieve GPS position.',
      }));
      return null;
    }

    try {
      const coords: LocationCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const geocoded = await reverseGeocodeCoordinates(coords);

      const updatedLocation: UserLocation = {
        formattedAddress: geocoded.formattedAddress || 'Live GPS Location',
        shortAddress: geocoded.shortAddress || 'Current GPS Location',
        locality: geocoded.locality || geocoded.subLocality || 'Local Area',
        subLocality: geocoded.subLocality,
        street: geocoded.street,
        houseNumber: geocoded.houseNumber,
        city: geocoded.city || API_SETTINGS.defaultCity,
        state: geocoded.state || API_SETTINGS.defaultState,
        postalCode: geocoded.postalCode || API_SETTINGS.defaultPostalCode,
        coordinates: coords,
        isLiveGps: true,
        isLoading: false,
        error: null,
      };

      setLocation(updatedLocation);
      return updatedLocation;
    } catch (err) {
      console.warn('GPS geocoding error:', err);
      setLocation(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  };

  const setManualLocation = (shortAddress: string, fullAddress: string) => {
    setLocation(prev => ({
      ...prev,
      shortAddress,
      formattedAddress: fullAddress,
      isLiveGps: false,
      isLoading: false,
      error: null,
    }));
    setIsPickerVisible(false);
  };


  return (
    <LocationContext.Provider
      value={{
        location,
        fetchLiveGpsLocation,
        setManualLocation,
        isPickerVisible,
        openLocationPicker: () => setIsPickerVisible(true),
        closeLocationPicker: () => setIsPickerVisible(false),
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
