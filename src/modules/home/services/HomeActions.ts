// src/modules/home/services/HomeActions.ts
import { DeliveryApiService } from '../../delivery/services/deliveryApiService';
import {
  AttendanceSummary,
  DeliveryPartnerProfile,
  DeliveryPicking,
  PendingCashHandoverResponse,
} from '../../delivery/types';
import { Order } from '../../orders/types';
import { mapDeliveryPickingToOrder } from '../../orders/utils/orderMapper';

export class HomeActions {
  /**
   * Fetches live unassigned orders available for delivery pickup
   * Postman: "All New Orders" (POST /api/delivery/pickings/unassigned)
   */
  static async getUnassignedOrders(): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getUnassignedOrders();
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.pickings)
        ? res.pickings
        : Array.isArray(res)
        ? res
        : [];
      return list.map(mapDeliveryPickingToOrder);
    } catch (error) {
      console.warn('HomeActions.getUnassignedOrders error:', error);
      return [];
    }
  }

  /**
   * Fetches active orders currently in progress for the driver
   * Postman: "All My delivery" (POST /api/delivery/pickings/all_my_delivery)
   */
  static async getMyActiveDeliveries(driverUserId: number): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getMyDeliveries(driverUserId);
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.pickings)
        ? res.pickings
        : Array.isArray(res)
        ? res
        : [];
      const orders = list.map(mapDeliveryPickingToOrder);
      return orders.filter((o: Order) => o.status !== 'delivered' && o.status !== 'cancelled');
    } catch (error) {

      console.warn('HomeActions.getMyActiveDeliveries error:', error);
      return [];
    }
  }

  /**
   * Fetches attendance summary for driver
   * Postman: "Emp Attendence" (POST /api/mobile/attendance_summary)
   */
  static async getAttendanceSummary(driverUserId: number): Promise<AttendanceSummary | null> {
    try {
      const res = await DeliveryApiService.getAttendanceSummary({ uid: driverUserId });
      const data = res?.result !== undefined ? res.result : res;
      return data || null;
    } catch (error) {
      console.warn('HomeActions.getAttendanceSummary error:', error);
      return null;
    }
  }

  /**
   * Check in shift
   * Postman: "Checkin" (POST /api/mobile/check_in)
   */
  static async checkIn(login: string, password?: string): Promise<any> {
    return DeliveryApiService.checkIn({ login, password });
  }

  /**
   * Check out shift
   * Postman: "Checkout" (POST /api/mobile/check_out)
   */
  static async checkOut(login: string, password?: string): Promise<any> {
    return DeliveryApiService.checkOut({ login, password });
  }

  /**
   * Fetches pending cash handover amount & list
   * Postman: "Pending Cash Handover" (POST /api/delivery/cash_handover/pending)
   */
  static async getPendingCashHandover(
    driverUserId: number,
  ): Promise<PendingCashHandoverResponse | null> {
    try {
      const res = await DeliveryApiService.getPendingCashHandover(driverUserId);
      const data = res?.result !== undefined ? res.result : res;
      return data || null;
    } catch (error) {
      console.warn('HomeActions.getPendingCashHandover error:', error);
      return null;
    }
  }

  /**
   * Fetches driver partner profile
   * Postman: "Delivery Partner Profile" (POST /api/delivery/profile)
   */
  static async getProfile(driverUserId: number): Promise<DeliveryPartnerProfile | null> {
    try {
      return await DeliveryApiService.getProfile(driverUserId);
    } catch (error) {
      console.warn('HomeActions.getProfile error:', error);
      return null;
    }
  }
}

export interface TermsAndSupportData {
  supportEmail: string;
  supportPhone: string;
  termsAndConditions: string;
}

export const getTermsAndConditionsAndSupport = async (): Promise<TermsAndSupportData> => {
  return {
    supportEmail: 'support@lbdelivery.com',
    supportPhone: '+91 98430 12345',
    termsAndConditions: `<h3>LB Delivery Partner Terms & Conditions</h3>
    <p>Welcome to LB Delivery Partner App. By using this application, delivery drivers agree to safely transport order pickings, accurately reconcile COD cash payments, verify delivery OTPs with customers, and maintain active shift attendance.</p>`,
  };
};

export const getProductCategoriesData = async (): Promise<any> => ({ result: [] });

export const formatOdooImage = (rawImage?: any): string | undefined => {
  if (!rawImage || typeof rawImage !== 'string' || rawImage === 'false') {
    return undefined;
  }
  const trimmed = rawImage.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
};

export default HomeActions;