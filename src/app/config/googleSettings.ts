/**
 * Google Mobile Services Settings (Google Maps & Google OAuth)
 */

export interface GoogleConfig {
  /** Google Maps & Geocoding API Key (Android / iOS) */
  mapsApiKey: string;
  /** Google Maps Reverse Geocoding API Base URL */
  geocodingBaseUrl: string;
  /** Google OAuth Client ID for Android package (com.lbdeliveryapp) */
  androidClientId: string;
  /** Google OAuth Client ID for iOS bundle identifier */
  iosClientId: string;
  /** Requested OAuth permissions */
  scopes: string[];
}

export const GOOGLE_SETTINGS: GoogleConfig = {
  // Google Maps SDK, Geocoding & Static Maps API Key
  mapsApiKey: 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc',
  geocodingBaseUrl: 'https://maps.googleapis.com/maps/api/geocode/json',

  // Native Mobile OAuth Client IDs (Matches Odoo auth.oauth.provider Google OAuth2)
  androidClientId: '84449601478-khmgc659452tjh9svb35tt9q4lfbmsse.apps.googleusercontent.com',
  iosClientId: '84449601478-khmgc659452tjh9svb35tt9q4lfbmsse.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
};

export default GOOGLE_SETTINGS;
