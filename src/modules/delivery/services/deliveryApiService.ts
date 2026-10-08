// src/modules/delivery/services/deliveryApiService.ts
import {
  ODOO_CONFIG,
  ODOO_DEFAULT_HEADERS,
  axiosInstance,
} from '../../../app/config';
import {
  CodReconciliationPayload,
  DeliverOrderPayload,
  DeliveryLoginPayload,
  DeliveryPartnerProfile,
  DeliveryPicking,
  DeliverySignupPayload,
  PendingCashHandoverResponse,
  RazorpayPaymentPayload,
} from '../types';

let rpcCounter = 1;

/**
 * Universal JSON-RPC helper for Odoo LB Delivery Partner endpoints.
 * Handles both plain {"jsonrpc": "2.0", "params": {}} and {"jsonrpc": "2.0", "method": "call", ...} formats.
 */
async function callDeliveryEndpoint<T = any>(
  endpoint: string,
  params: Record<string, any> = {},
  withMethodCall = false,
): Promise<T> {
  const rpcId = ++rpcCounter;

  const payload: any = {
    jsonrpc: '2.0',
    params,
  };

  if (withMethodCall) {
    payload.method = 'call';
    payload.id = rpcId;
  }

  try {
    const response = await axiosInstance({
      method: 'POST',
      url: endpoint,
      headers: ODOO_DEFAULT_HEADERS,
      data: payload,
    });

    if (response.data?.error) {
      const err = response.data.error;
      const message =
        err.data?.message ||
        err.message ||
        `Error calling ${endpoint}`;
      console.warn(`[Delivery API Error] ${endpoint}:`, message);
      throw new Error(message);
    }

    // In Odoo jsonrpc, successful results are often wrapped in result
    const result = response.data?.result !== undefined ? response.data.result : response.data;
    return result as T;
  } catch (error: any) {
    console.warn(`[Delivery API Error] ${endpoint}:`, error?.message || error);
    throw error;
  }
}

export class DeliveryApiService {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Auth & Registration Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Postman: "Delivery partner Registration"
   * POST /api/delivery/signup
   */
  static async signup(payload: DeliverySignupPayload): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/signup', {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      vehicle_type: payload.vehicle_type,
      vehicle_number: payload.vehicle_number,
      license_number: payload.license_number,
      pan_number: payload.pan_number,
      aadhaar_number: payload.aadhaar_number,
      street: payload.street,
      city: payload.city,
      state_id: payload.state_id || 585,
      country_id: payload.country_id || 104,
      zip_code: payload.zip_code,
      profile_image_base64: payload.profile_image_base64,
      pan_doc_base64: payload.pan_doc_base64,
      aadhaar_front_base64: payload.aadhaar_front_base64,
      aadhaar_back_base64: payload.aadhaar_back_base64,
      license_doc_base64: payload.license_doc_base64,
    });
  }

  /**
   * Postman: "Delivery Partner login"
   * POST /web/session/authenticate
   */
  static async login(payload: DeliveryLoginPayload): Promise<any> {
    const db = payload.db || ODOO_CONFIG.DB;
    const login = payload.login.trim();
    const password = payload.password.trim();

    return callDeliveryEndpoint(
      '/web/session/authenticate',
      {
        db,
        login,
        password,
      },
      true, // withMethodCall
    );
  }

  /**
   * Postman: "Forgot Password"
   * POST /api/delivery/forgot_password
   */
  static async forgotPassword(email: string): Promise<any> {
    return callDeliveryEndpoint(
      '/api/delivery/forgot_password',
      { email: email.trim() },
      true,
    );
  }

  /**
   * Postman: "Delivery Partner Profile"
   * POST /api/delivery/profile
   */
  static async getProfile(userId: number): Promise<DeliveryPartnerProfile> {
    const res = await callDeliveryEndpoint('/api/delivery/profile', {
      user_id: Number(userId),
    });
    return res;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Attendance & Shift Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Postman: "Checkin"
   * POST /api/mobile/check_in
   */
  static async checkIn(params: { login: string; password?: string; db?: string }): Promise<any> {
    return callDeliveryEndpoint('/api/mobile/check_in', {
      db: params.db || ODOO_CONFIG.DB,
      login: params.login,
      password: params.password || ODOO_CONFIG.PASSWORD,
    });
  }

  /**
   * Postman: "Checkout"
   * POST /api/mobile/check_out
   */
  static async checkOut(params: { login: string; password?: string; db?: string }): Promise<any> {
    return callDeliveryEndpoint('/api/mobile/check_out', {
      db: params.db || ODOO_CONFIG.DB,
      login: params.login,
      password: params.password || ODOO_CONFIG.PASSWORD,
    });
  }

  /**
   * Postman: "Emp Attendence"
   * POST /api/mobile/attendance_summary
   */
  static async getAttendanceSummary(params: {
    uid: number;
    target_date?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    return callDeliveryEndpoint('/api/mobile/attendance_summary', {
      uid: Number(params.uid),
      target_date: params.target_date || today,
      date_from: params.date_from || `${today} 00:00:00`,
      date_to: params.date_to || `${today} 23:59:59`,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Delivery Orders & Workflow Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Postman: "All New Orders" (Unassigned pickings)
   * POST /api/delivery/pickings/unassigned
   */
  static async getUnassignedOrders(): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/pickings/unassigned', {});
  }

  /**
   * Postman: "Accept order"
   * POST /api/delivery/picking/accept
   */
  static async acceptOrder(pickingId: number, driverUserId: number): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/accept', {
      picking_id: Number(pickingId),
      driver_user_id: Number(driverUserId),
    });
  }

  /**
   * Postman: "Reject Order Picking"
   * POST /api/delivery/picking/reject
   */
  static async rejectOrder(pickingId: number, driverUserId: number): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/reject', {
      picking_id: Number(pickingId),
      driver_user_id: Number(driverUserId),
    });
  }

  /**
   * Postman: "Arrived at Store"
   * POST /api/delivery/picking/arrived-store
   */
  static async arrivedAtStore(
    pickingId: number,
    driverUserId: number,
    latitude?: number,
    longitude?: number,
  ): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/arrived-store', {
      picking_id: Number(pickingId),
      driver_user_id: Number(driverUserId),
      latitude: latitude ?? 12.5683,
      longitude: longitude ?? 77.8284,
    });
  }

  /**
   * Postman: "Picked Up from store"
   * POST /api/delivery/picking/picked-up
   */
  static async pickedUpFromStore(pickingId: number, driverUserId: number): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/picked-up', {
      picking_id: Number(pickingId),
      driver_user_id: Number(driverUserId),
    });
  }

  /**
   * Postman: "Arrived-Customer Location"
   * POST /api/delivery/picking/arrived-customer
   */
  static async arrivedCustomerLocation(pickingId: number, driverUserId: number): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/arrived-customer', {
      picking_id: Number(pickingId),
      driver_user_id: Number(driverUserId),
    });
  }

  /**
   * Postman: "Product Delivery to customer"
   * POST /api/delivery/picking/deliver
   */
  static async deliverOrder(payload: DeliverOrderPayload): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/picking/deliver', {
      picking_id: Number(payload.picking_id),
      driver_user_id: Number(payload.driver_user_id),
      signed_by: payload.signed_by,
      signature_base64: payload.signature_base64 || '',
      delivery_otp: payload.delivery_otp,
      latitude: payload.latitude ?? 12.5683,
      longitude: payload.longitude ?? 77.8284,
    });
  }

  /**
   * Postman: "Product Delivery Cancel"
   * POST /api/delivery/picking/cancel
   */
  static async cancelDelivery(
    pickingId: number,
    driverUserId: number,
    cancelReason: string,
  ): Promise<any> {
    return callDeliveryEndpoint(
      '/api/delivery/picking/cancel',
      {
        picking_id: Number(pickingId),
        driver_user_id: Number(driverUserId),
        cancel_reason: cancelReason,
      },
      true,
    );
  }

  /**
   * Postman: "All My delivery"
   * POST /api/delivery/pickings/all_my_delivery
   */
  static async getMyDeliveries(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/pickings/all_my_delivery', {
      driver_user_id: Number(driverUserId),
      status_filter: statusFilter,
    });
  }

  /**
   * Postman: "All Today Delivery"
   * POST /api/delivery/pickings/all_my_delivery
   */
  static async getTodayDeliveries(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/pickings/all_my_delivery', {
      driver_user_id: Number(driverUserId),
      status_filter: statusFilter,
    });
  }

  /**
   * Postman: "All My Cancelled Orders"
   * POST /api/delivery/pickings/cancelled
   */
  static async getMyCancelledOrders(driverUserId: number): Promise<any> {
    return callDeliveryEndpoint(
      '/api/delivery/pickings/cancelled',
      {
        driver_user_id: Number(driverUserId),
      },
      true,
    );
  }

  /**
   * Postman: "All My Today Cancelled Orders"
   * POST /api/delivery/pickings/cancelled/today
   */
  static async getMyTodayCancelledOrders(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/pickings/cancelled/today', {
      driver_user_id: Number(driverUserId),
      status_filter: statusFilter,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Payment & COD Reconciliation Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Postman: "Payment Status"
   * POST /api/delivery/check_payment_status
   */
  static async checkPaymentStatus(orderId: number): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/check_payment_status', {
      order_id: Number(orderId),
    });
  }

  /**
   * Postman: "Collect Cash Physically" (COD Reconciliation)
   * POST /api/delivery/cod_reconciliation
   */
  static async collectCashPhysically(payload: CodReconciliationPayload): Promise<any> {
    return callDeliveryEndpoint('/api/delivery/cod_reconciliation', {
      order_id: Number(payload.order_id),
      driver_user_id: Number(payload.driver_user_id),
      amount_collected: Number(payload.amount_collected),
      journal_id: payload.journal_id ?? 7,
      payment_reference: payload.payment_reference || `COD-REC-${Date.now().toString().slice(-6)}`,
    });
  }

  /**
   * Postman: "Collect Payment Online" (Razorpay)
   * POST /api/v1/sale/process_razorpay_payment
   */
  static async processRazorpayPayment(payload: RazorpayPaymentPayload): Promise<any> {
    return callDeliveryEndpoint(
      '/api/v1/sale/process_razorpay_payment',
      {
        order_id: Number(payload.order_id),
        journal_id: payload.journal_id ?? 6,
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_signature: payload.razorpay_signature,
        payment_status: payload.payment_status || 'success',
      },
      true,
    );
  }

  /**
   * Postman: "Pending Cash Handover"
   * POST /api/delivery/cash_handover/pending
   */
  static async getPendingCashHandover(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<PendingCashHandoverResponse | any> {
    return callDeliveryEndpoint('/api/delivery/cash_handover/pending', {
      driver_user_id: Number(driverUserId),
      status_filter: statusFilter,
    });
  }
}

export default DeliveryApiService;
