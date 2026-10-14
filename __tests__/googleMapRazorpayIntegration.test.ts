import { API_SETTINGS } from '../src/app/config/apiSettings';
import { GOOGLE_SETTINGS } from '../src/app/config/googleSettings';
import { RAZORPAY_SETTINGS } from '../src/app/config/razorpaySettings';
import {
  geocodeAddress,
  getDirectionsRoute,
} from '../src/modules/location/services/geocodingService';
import { PaymentService } from '../src/modules/products/services/paymentService';

describe('Google Maps & Razorpay Integration Tests', () => {
  describe('Credentials Verification', () => {
    it('verifies Google Maps credentials match user configuration', () => {
      expect(API_SETTINGS.googleMap.key).toBe('AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc');
      expect(API_SETTINGS.googleMap.secret).toBe('5O0USbwRw8L4mQJhLzi7Wh-Qmv4=');
      expect(GOOGLE_SETTINGS.mapsApiKey).toBe('AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc');
    });

    it('verifies Razorpay credentials match user configuration', () => {
      expect(API_SETTINGS.razorPay.key).toBe('rzp_test_TdOidiEvuXTPfe');
      expect(API_SETTINGS.razorPay.secret).toBe('2GB25f8Hi71gF7yYJGWuV25z');
      expect(RAZORPAY_SETTINGS.keyId).toBe('rzp_test_TdOidiEvuXTPfe');
      expect(RAZORPAY_SETTINGS.keySecret).toBe('2GB25f8Hi71gF7yYJGWuV25z');
    });
  });

  describe('Google Maps Geocoding & Address Binding', () => {
    it('returns null safely for empty addresses', async () => {
      const res = await geocodeAddress('');
      expect(res).toBeNull();
    });

    it('resolves address coordinates when Google Maps Geocoding API responds', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              geometry: {
                location: {
                  lat: 12.7209,
                  lng: 77.8282,
                },
              },
            },
          ],
        }),
      });
      (globalThis as any).fetch = mockFetch;

      const coords = await geocodeAddress('Gandhi Road, Hosur');
      expect(coords).not.toBeNull();
      expect(coords?.latitude).toBe(12.7209);
      expect(coords?.longitude).toBe(77.8282);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc'),
        expect.anything(),
      );
    });

    it('handles geocoding errors without crashing and returns null', async () => {
      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const coords = await geocodeAddress('Unknown Location');
      expect(coords).toBeNull();
    });

    it('calculates driving road directions route between origin device and destination', async () => {
      const mockDirectionsFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          routes: [
            {
              overview_polyline: { points: 'mock_encoded_polyline_route' },
              legs: [
                {
                  distance: { text: '3.4 km', value: 3400 },
                  duration: { text: '9 mins', value: 540 },
                  steps: [
                    {
                      html_instructions: 'Head <b>north</b> on Mathigiri Rd',
                      distance: { text: '500 m' },
                      duration: { text: '2 mins' },
                    },
                    {
                      html_instructions: 'Turn <b>right</b> onto Gandhi Rd',
                      distance: { text: '2.9 km' },
                      duration: { text: '7 mins' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
      (globalThis as any).fetch = mockDirectionsFetch;

      const route = await getDirectionsRoute(
        { latitude: 12.5683, longitude: 77.8284 },
        { latitude: 12.7209, longitude: 77.8282 },
        { destLabel: 'S', destColor: 'green' },
      );

      expect(route).toBeDefined();
      expect(route.distance).toBe('3.4 km');
      expect(route.duration).toBe('9 mins');
      expect(route.polyline).toBe('mock_encoded_polyline_route');
      expect(route.staticMapUrl).toContain('mock_encoded_polyline_route');
      expect(route.staticMapUrl).toContain('label:D');
      expect(route.staticMapUrl).toContain('label:S');
      expect(route.steps.length).toBe(2);
      expect(route.steps[0].instruction).toBe('Head north on Mathigiri Rd');
    });

    it('gracefully provides fallback roadmap calculations when network fails', async () => {
      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Offline'));

      const fallbackRoute = await getDirectionsRoute(
        { latitude: 12.5683, longitude: 77.8284 },
        { latitude: 12.5783, longitude: 77.8384 },
        { destLabel: 'C', destColor: 'red' },
      );

      expect(fallbackRoute).toBeDefined();
      expect(fallbackRoute.distance).toBeDefined();
      expect(fallbackRoute.duration).toBeDefined();
      expect(fallbackRoute.staticMapUrl).toContain('label:D');
      expect(fallbackRoute.staticMapUrl).toContain('label:C');
    });
  });

  describe('Razorpay Dynamic UPI QR Code Generation', () => {
    it('generates dynamic UPI QR code containing exact payable amount and order number', async () => {
      const qrResult = await PaymentService.createRazorpayQrCode({
        amount: 224.4,
        orderId: 101,
        orderNumber: 'WH/OUT/00101',
      });

      expect(qrResult).toBeDefined();
      expect(qrResult.qrImageUrl).toContain('api.qrserver.com');
      expect(qrResult.upiUri).toContain('upi://pay');
      expect(qrResult.upiUri).toContain('am=224.40');
      expect(decodeURIComponent(qrResult.upiUri)).toContain('WH/OUT/00101');
    });

    it('formats rupees to two decimal places in UPI string for any amount', async () => {
      const qrResult = await PaymentService.createRazorpayQrCode({
        amount: 50,
        orderId: 102,
        orderNumber: 'WH/OUT/00102',
      });

      expect(qrResult.upiUri).toContain('am=50.00');
    });
  });
});
