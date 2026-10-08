import { API_SETTINGS } from './apiSettings';

export interface RazorpayConfig {
  /** Razorpay Key ID (rzp_test_... or rzp_live_...) */
  keyId: string;
  /** Razorpay Secret Key */
  keySecret: string;
  /** Merchant display name on checkout bottom sheet */
  merchantName: string;
  /** Checkout description */
  description: string;
  /** Base currency */
  currency: 'INR';
  /** Primary brand header color */
  themeColor: string;
}

export const RAZORPAY_SETTINGS: RazorpayConfig = {
  keyId: API_SETTINGS.razorPay.key,
  keySecret: API_SETTINGS.razorPay.secret,
  merchantName: 'LB Fresh Basket',
  description: '15-Min Fast Grocery & Essentials Delivery',
  currency: 'INR',
  themeColor: '#063B00',
};

export default RAZORPAY_SETTINGS;
