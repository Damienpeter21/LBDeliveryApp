export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface UserLocation {
  formattedAddress: string;
  shortAddress: string;
  locality?: string;
  subLocality?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  coordinates?: LocationCoordinates;
  isLiveGps: boolean;
  isLoading: boolean;
  error?: string | null;
}
