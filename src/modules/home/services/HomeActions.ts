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

const extractPickingsArray = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.pickings)) return res.pickings;
  if (Array.isArray(res.deliveries)) return res.deliveries;
  if (Array.isArray(res.cancelled_pickings)) return res.cancelled_pickings;
  if (Array.isArray(res.result)) return res.result;
  if (Array.isArray(res.result?.pickings)) return res.result.pickings;
  if (Array.isArray(res.result?.deliveries)) return res.result.deliveries;
  if (Array.isArray(res.result?.cancelled_pickings)) return res.result.cancelled_pickings;
  return [];
};

export class HomeActions {
  /**
   * Fetches live unassigned orders available for delivery pickup
   * Postman: "All New Orders" (POST /api/delivery/pickings/unassigned)
   */
  static async getUnassignedOrders(): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getUnassignedOrders();
      const list = extractPickingsArray(res);
      return list.map(item => mapDeliveryPickingToOrder(item, 'unassigned'));
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
      const list = extractPickingsArray(res);
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
      if (!data) return null;

      const handovers = Array.isArray(data.pending_handovers)
        ? data.pending_handovers
        : Array.isArray(data.orders)
        ? data.orders
        : [];

      const total = Number(
        data.total_pending_cash !== undefined
          ? data.total_pending_cash
          : handovers.reduce((acc: number, item: any) => acc + Number(item.amount || 0), 0),
      );

      return {
        ...data,
        total_pending_cash: total,
        orders: handovers,
      };
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