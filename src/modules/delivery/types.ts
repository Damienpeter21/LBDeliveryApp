/**
 * LB Delivery Partner Application - Core Type Definitions
 * Generated from the official Postman collection for Delivery Partner
 */

export interface DeliverySignupPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  pan_number: string;
  aadhaar_number: string;
  street: string;
  city: string;
  state_id: number;
  country_id: number;
  zip_code: string;
  profile_image_base64?: string;
  pan_doc_base64?: string;
  aadhaar_front_base64?: string;
  aadhaar_back_base64?: string;
  license_doc_base64?: string;
}

export interface DeliveryLoginPayload {
  db?: string;
  login: string;
  password: string;
}

export interface DeliveryPartnerProfile {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  street?: string;
  city?: string;
  state_id?: number | [number, string];
  country_id?: number | [number, string];
  zip_code?: string;
  profile_image_url?: string;
  active?: boolean;
}

export interface AttendanceRecord {
  id?: number;
  check_in?: string;
  check_out?: string;
  worked_hours?: number;
}

export interface AttendanceSummary {
  uid: number;
  target_date?: string;
  date_from?: string;
  date_to?: string;
  isCheckedIn?: boolean;
  todayWorkedHours?: number;
  checkInTime?: string;
  checkOutTime?: string;
  records?: AttendanceRecord[];
}

export type DeliveryStage =
  | 'unassigned'
  | 'assigned'
  | 'arrived_store'
  | 'picked_up'
  | 'arrived_customer'
  | 'delivered'
  | 'cancelled';

export interface OrderLineItem {
  id: number | string;
  product_id?: number;
  product_name: string;
  quantity: number;
  price_unit?: number;
  price_total?: number;
  image_url?: string;
}

export interface DeliveryPicking {
  id: number;
  picking_id: number;
  name: string; // e.g. "WH/OUT/00019"
  origin?: string; // e.g. "S00023" (Sale Order reference)
  sale_order_id?: number;
  driver_user_id?: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  city?: string;
  zip_code?: string;
  store_name?: string;
  store_address?: string;
  stage: DeliveryStage;
  amount_total: number;
  payment_method: 'cod' | 'online' | 'paid';
  payment_status: 'pending' | 'paid' | 'success' | 'collected';
  is_cod: boolean;
  date: string;
  scheduled_date?: string;
  items: OrderLineItem[];
  items_count: number;
  latitude?: number;
  longitude?: number;
  customer_latitude?: number;
  customer_longitude?: number;
  store_latitude?: number;
  store_longitude?: number;
  cancel_reason?: string;
}

export interface DeliverOrderPayload {
  picking_id: number;
  driver_user_id: number;
  signed_by: string;
  signature_base64?: string;
  delivery_otp: string;
  latitude?: number;
  longitude?: number;
}

export interface CodReconciliationPayload {
  order_id: number;
  driver_user_id: number;
  amount_collected: number;
  journal_id?: number;
  payment_reference?: string;
}

export interface RazorpayPaymentPayload {
  order_id: number;
  journal_id?: number;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  payment_status: string;
}

export interface PendingCashHandoverItem {
  order_id: number;
  order_name: string;
  amount: number;
  total_amount?: number;
  reference?: string;
  date: string;
  journal_name?: string;
  handover_id?: number;
}

export interface PendingCashHandoverResponse {
  driver_user_id: number;
  total_pending_cash: number;
  orders: PendingCashHandoverItem[];
}
