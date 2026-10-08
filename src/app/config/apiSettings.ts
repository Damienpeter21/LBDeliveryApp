/**
 * API & Backend Service Settings
 */

export interface ApiSettings {
  baseUrl: string;
  timeoutMs: number;
  minOrderAmount?: number;
  defaultDeliveryMinutes: number;
  freeDeliveryThreshold: number;
  defaultCity: string;
  defaultState: string;
  defaultPostalCode: string;
  googleMap: {
    key: string;
    secret: string;
  };
  razorPay: {
    key: string;
    secret: string;
  };
  defaultCoordinates: {
    latitude: number;
    longitude: number;
  };
}

export const API_SETTINGS: ApiSettings = {
  baseUrl: 'https://lbfreshbasket.com',
  timeoutMs: 25000,
  defaultDeliveryMinutes: 15,
  freeDeliveryThreshold: 199,
  defaultCity: 'Hosur',
  defaultState: 'Tamil Nadu',
  defaultPostalCode: '635110',
  googleMap: {
    key: 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc',
    secret: '5O0USbwRw8L4mQJhLzi7Wh-Qmv4=',
  },
  razorPay: {
    key: 'rzp_test_TdOidiEvuXTPfe',
    secret: '2GB25f8Hi71gF7yYJGWuV25z',
  },
  defaultCoordinates: {
    latitude: 12.5683,
    longitude: 77.8284, // Hosur Center Coordinates
  },
};

export default API_SETTINGS;

