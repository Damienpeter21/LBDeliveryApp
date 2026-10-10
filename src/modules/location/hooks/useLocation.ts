import { useContext } from 'react';
import { LocationContext, LocationContextType } from '../context/LocationContext';
import { API_SETTINGS } from '../../../app/config';

const FALLBACK_LOCATION_CONTEXT: LocationContextType = {
  location: {
    shortAddress: 'Hosur, Tamil Nadu',
    formattedAddress: 'Hosur, Tamil Nadu',
    locality: 'Hosur',
    city: API_SETTINGS.defaultCity,
    state: API_SETTINGS.defaultState,
    postalCode: API_SETTINGS.defaultPostalCode,
    coordinates: API_SETTINGS.defaultCoordinates,
    isLiveGps: false,
    isLoading: false,
    error: null,
  },
  fetchLiveGpsLocation: async () => null,
  setManualLocation: () => {},
  isPickerVisible: false,
  openLocationPicker: () => {},
  closeLocationPicker: () => {},
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    return FALLBACK_LOCATION_CONTEXT;
  }
  return context;
};
