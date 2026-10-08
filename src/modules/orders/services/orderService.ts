// src/modules/orders/services/orderService.ts
import { DeliveryApiService } from '../../delivery/services/deliveryApiService';
import {
  CodReconciliationPayload,
  DeliverOrderPayload,
  PendingCashHandoverResponse,
  RazorpayPaymentPayload,
} from '../../delivery/types';
import { Order } from '../types';
import { mapDeliveryPickingToOrder } from '../utils/orderMapper';

export class OrderService {
  /**
   * Fetches unassigned new orders available for pickup.
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
      console.warn('Error fetching unassigned orders:', error);
      return [];
    }
  }

  /**
   * Fetches driver's assigned / active / all delivery orders.
   * Postman: "All My delivery" (POST /api/delivery/pickings/all_my_delivery)
   */
  static async getMyDeliveries(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getMyDeliveries(driverUserId, statusFilter);
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.pickings)
        ? res.pickings
        : Array.isArray(res)
        ? res
        : [];
      return list.map(mapDeliveryPickingToOrder);
    } catch (error) {
      console.warn('Error fetching my deliveries:', error);
      return [];
    }
  }

  /**
   * Fetches today's delivery orders.
   * Postman: "All Today Delivery" (POST /api/delivery/pickings/all_my_delivery)
   */
  static async getTodayDeliveries(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getTodayDeliveries(driverUserId, statusFilter);
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.pickings)
        ? res.pickings
        : Array.isArray(res)
        ? res
        : [];
      return list.map(mapDeliveryPickingToOrder);
    } catch (error) {
      console.warn('Error fetching today deliveries:', error);
      return [];
    }
  }

  /**
   * Fetches cancelled delivery orders.
   * Postman: "All My Cancelled Orders" (POST /api/delivery/pickings/cancelled)
   */
  static async getMyCancelledOrders(driverUserId: number): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getMyCancelledOrders(driverUserId);
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.cancelled_pickings)
        ? res.cancelled_pickings
        : Array.isArray(res)
        ? res
        : [];
      return list.map(mapDeliveryPickingToOrder);
    } catch (error) {
      console.warn('Error fetching cancelled orders:', error);
      return [];
    }
  }

  /**
   * Fetches today's cancelled orders.
   * Postman: "All My Today Cancelled Orders" (POST /api/delivery/pickings/cancelled/today)
   */
  static async getMyTodayCancelledOrders(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getMyTodayCancelledOrders(driverUserId, statusFilter);
      const list = Array.isArray(res?.result)
        ? res.result
        : Array.isArray(res?.cancelled_pickings)
        ? res.cancelled_pickings
        : Array.isArray(res)
        ? res
        : [];
      return list.map(mapDeliveryPickingToOrder);
    } catch (error) {
      console.warn('Error fetching today cancelled orders:', error);
      return [];
    }
  }

  /**
   * Accepts a delivery picking.
   * Postman: "Accept order" (POST /api/delivery/picking/accept)
   */
  static async acceptOrder(pickingId: number, driverUserId: number): Promise<any> {
    return DeliveryApiService.acceptOrder(pickingId, driverUserId);
  }

  /**
   * Rejects a delivery picking.
   * Postman: "Reject Order Picking" (POST /api/delivery/picking/reject)
   */
  static async rejectOrder(pickingId: number, driverUserId: number): Promise<any> {
    return DeliveryApiService.rejectOrder(pickingId, driverUserId);
  }

  /**
   * Updates stage: Driver arrived at store.
   * Postman: "Arrived at Store" (POST /api/delivery/picking/arrived-store)
   */
  static async arrivedAtStore(
    pickingId: number,
    driverUserId: number,
    latitude?: number,
    longitude?: number,
  ): Promise<any> {
    return DeliveryApiService.arrivedAtStore(pickingId, driverUserId, latitude, longitude);
  }

  /**
   * Updates stage: Driver picked up order from store.
   * Postman: "Picked Up from store" (POST /api/delivery/picking/picked-up)
   */
  static async pickedUpFromStore(pickingId: number, driverUserId: number): Promise<any> {
    return DeliveryApiService.pickedUpFromStore(pickingId, driverUserId);
  }

  /**
   * Updates stage: Driver arrived at customer location.
   * Postman: "Arrived-Customer Location" (POST /api/delivery/picking/arrived-customer)
   */
  static async arrivedCustomerLocation(pickingId: number, driverUserId: number): Promise<any> {
    return DeliveryApiService.arrivedCustomerLocation(pickingId, driverUserId);
  }

  /**
   * Completes delivery with OTP & signature.
   * Postman: "Product Delivery to customer" (POST /api/delivery/picking/deliver)
   */
  static async deliverOrder(payload: DeliverOrderPayload): Promise<any> {
    return DeliveryApiService.deliverOrder(payload);
  }

  /**
   * Cancels order delivery with reason.
   * Postman: "Product Delivery Cancel" (POST /api/delivery/picking/cancel)
   */
  static async cancelDelivery(
    pickingId: number,
    driverUserId: number,
    cancelReason: string,
  ): Promise<any> {
    return DeliveryApiService.cancelDelivery(pickingId, driverUserId, cancelReason);
  }

  /**
   * Checks order payment status.
   * Postman: "Payment Status" (POST /api/delivery/check_payment_status)
   */
  static async checkPaymentStatus(orderId: number): Promise<any> {
    return DeliveryApiService.checkPaymentStatus(orderId);
  }

  /**
   * Records cash collected physically (COD Reconciliation).
   * Postman: "Collect Cash Physically" (POST /api/delivery/cod_reconciliation)
   */
  static async collectCashPhysically(payload: CodReconciliationPayload): Promise<any> {
    return DeliveryApiService.collectCashPhysically(payload);
  }

  /**
   * Processes online Razorpay payment.
   * Postman: "Collect Payment Online" (POST /api/v1/sale/process_razorpay_payment)
   */
  static async processRazorpayPayment(payload: RazorpayPaymentPayload): Promise<any> {
    return DeliveryApiService.processRazorpayPayment(payload);
  }

  /**
   * Retrieves pending cash handover summary.
   * Postman: "Pending Cash Handover" (POST /api/delivery/cash_handover/pending)
   */
  static async getPendingCashHandover(
    driverUserId: number,
    statusFilter: string | null = null,
  ): Promise<PendingCashHandoverResponse | any> {
    return DeliveryApiService.getPendingCashHandover(driverUserId, statusFilter);
  }

  /**
   * Legacy method for general orders list
   */
  static async getAllOrders(
    partnerId?: number | string,
    _limit = 100,
    _offset = 0,
  ): Promise<{ result: Order[] }> {
    const driverUserId = Number(partnerId || 15);
    const orders = await this.getMyDeliveries(driverUserId);
    return { result: orders };
  }
}
