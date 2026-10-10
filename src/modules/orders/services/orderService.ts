// src/modules/orders/services/orderService.ts
import { callOdooRpc } from '../../../app/config';
import { DeliveryApiService } from '../../delivery/services/deliveryApiService';
import {
  CodReconciliationPayload,
  DeliverOrderPayload,
  PendingCashHandoverResponse,
  RazorpayPaymentPayload,
} from '../../delivery/types';
import { Order } from '../types';
import { mapDeliveryPickingToOrder } from '../utils/orderMapper';

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

export class OrderService {
  /**
   * Fetches unassigned new orders available for pickup.
   * Postman: "All New Orders" (POST /api/delivery/pickings/unassigned)
   */
  static async getUnassignedOrders(): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getUnassignedOrders();
      const list = extractPickingsArray(res);
      return list.map(item => mapDeliveryPickingToOrder(item, 'unassigned'));
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
      const list = extractPickingsArray(res);
      const orders = list.map(mapDeliveryPickingToOrder);

      // Merge any pickings assigned to this driver directly from Odoo stock.picking
      // to ensure pickings accepted across different dates are never missed
      try {
        const rpcRes: any = await callOdooRpc(
          'stock.picking',
          'search_read',
          [[['delivery_driver_id', '=', Number(driverUserId)]]],
          {
            fields: [
              'id',
              'name',
              'origin',
              'state',
              'scheduled_date',
              'delivery_app_status',
              'delivery_driver_id',
              'partner_id',
              'delivery_otp',
              'date_done',
            ],
            limit: 50,
          },
        );
        const rpcList = Array.isArray(rpcRes) ? rpcRes : rpcRes?.result;
        if (Array.isArray(rpcList) && rpcList.length > 0) {
          const existingIds = new Set(orders.map(o => o.pickingId || Number(o.id)));
          for (const item of rpcList) {
            const pId = Number(item.id);
            if (!existingIds.has(pId)) {
              orders.push(mapDeliveryPickingToOrder(item));
              existingIds.add(pId);
            }
          }
        }
      } catch (_) {}

      return orders;
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
    return this.getMyDeliveries(driverUserId, statusFilter);
  }

  /**
   * Fetches cancelled delivery orders.
   * Postman: "All My Cancelled Orders" (POST /api/delivery/pickings/cancelled)
   */
  static async getMyCancelledOrders(driverUserId: number): Promise<Order[]> {
    try {
      const res = await DeliveryApiService.getMyCancelledOrders(driverUserId);
      const list = extractPickingsArray(res);
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
      const list = extractPickingsArray(res);
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
   * Fetches full live order details from Odoo including line items and sale order info
   */
  static async getOrderDetails(pickingId: number, baseOrder?: Order): Promise<Order> {
    try {
      const pRes: any = await callOdooRpc(
        'stock.picking',
        'read',
        [[Number(pickingId)]],
        {
          fields: [
            'id',
            'name',
            'origin',
            'state',
            'scheduled_date',
            'delivery_app_status',
            'delivery_driver_id',
            'partner_id',
            'delivery_otp',
            'sale_id',
          ],
        },
      );

      const picking = Array.isArray(pRes) ? pRes[0] : (pRes?.result ? pRes.result[0] : null);
      if (!picking) {
        return baseOrder || mapDeliveryPickingToOrder({ id: pickingId });
      }

      const saleId = picking.sale_id
        ? Array.isArray(picking.sale_id)
          ? picking.sale_id[0]
          : picking.sale_id
        : undefined;

      let saleOrder: any = null;
      let orderLines: any[] = [];

      if (saleId) {
        try {
          const soRes: any = await callOdooRpc(
            'sale.order',
            'read',
            [[Number(saleId)]],
            {
              fields: [
                'id',
                'name',
                'amount_total',
                'order_line',
                'delivery_status',
                'invoice_status',
                'partner_id',
              ],
            },
          );
          saleOrder = Array.isArray(soRes) ? soRes[0] : (soRes?.result ? soRes.result[0] : null);

          if (saleOrder && Array.isArray(saleOrder.order_line) && saleOrder.order_line.length > 0) {
            const lineRes: any = await callOdooRpc(
              'sale.order.line',
              'read',
              [saleOrder.order_line],
              {
                fields: [
                  'id',
                  'product_id',
                  'product_uom_qty',
                  'price_unit',
                  'price_total',
                  'product_uom',
                ],
              },
            );
            orderLines = Array.isArray(lineRes) ? lineRes : (lineRes?.result ? lineRes.result : []);
          }
        } catch (_) {}
      }

      let customerPartner: any = null;
      const partnerId = picking.partner_id
        ? Array.isArray(picking.partner_id)
          ? picking.partner_id[0]
          : picking.partner_id
        : undefined;

      if (partnerId) {
        try {
          const cpRes: any = await callOdooRpc(
            'res.partner',
            'read',
            [[Number(partnerId)]],
            { fields: ['id', 'name', 'phone', 'street', 'city', 'zip'] },
          );
          customerPartner = Array.isArray(cpRes) ? cpRes[0] : (cpRes?.result ? cpRes.result[0] : null);
        } catch (_) {}
      }

      // Check live payment status if saleId exists
      let paymentStatus = baseOrder?.paymentStatus || 'pending';
      let isPaid = false;
      if (saleId) {
        try {
          const payRes = await DeliveryApiService.checkPaymentStatus(Number(saleId));
          const pData = payRes?.result !== undefined ? payRes.result : payRes;
          if (pData?.is_paid || pData?.payment_state === 'paid' || pData?.payment_status === 'paid') {
            isPaid = true;
            paymentStatus = 'paid';
          }
        } catch (_) {}
      }

      const totalAmount = Number(
        saleOrder?.amount_total ||
          baseOrder?.totalAmount ||
          orderLines.reduce(
            (sum, l) => sum + Number(l.price_total || l.price_unit * l.product_uom_qty || 0),
            0,
          ) ||
          0,
      );

      const items = orderLines.map((l: any, idx: number) => {
        const pName = Array.isArray(l.product_id) ? l.product_id[1] : (l.name || `Item #${idx + 1}`);
        const pPrice = Number(l.price_unit || 0);
        const pQty = Number(l.product_uom_qty || 1);
        const pUnit = Array.isArray(l.product_uom) ? l.product_uom[1] : 'Units';
        return {
          id: l.id || idx,
          productName: pName,
          quantity: pQty,
          price: pPrice,
          product: {
            id: Array.isArray(l.product_id) ? l.product_id[0] : idx,
            name: pName,
            price: pPrice,
            unit: pUnit,
          },
        };
      });

      const mappedOrder = mapDeliveryPickingToOrder({
        ...baseOrder,
        ...picking,
        picking_id: pickingId,
        sale_order_id: saleId,
        amount_total: totalAmount,
        customer_name:
          customerPartner?.name ||
          (Array.isArray(picking.partner_id) ? picking.partner_id[1] : undefined) ||
          baseOrder?.customerName,
        customer_phone: customerPartner?.phone || baseOrder?.customerPhone,
        customer_address:
          [customerPartner?.street, customerPartner?.city, customerPartner?.zip]
            .filter(Boolean)
            .join(', ') || baseOrder?.deliveryAddress,
      });

      return {
        ...mappedOrder,
        saleOrderId: saleId ? Number(saleId) : baseOrder?.saleOrderId,
        totalAmount: totalAmount || mappedOrder.totalAmount,
        items: items.length > 0 ? items : (baseOrder?.items || mappedOrder.items),
        itemCount: items.length > 0 ? items.length : (baseOrder?.itemCount || mappedOrder.itemCount),
        paymentStatus,
        isCod: baseOrder?.isCod ?? !isPaid,
      };
    } catch (err) {
      console.warn('Error fetching live order details:', err);
      return baseOrder || mapDeliveryPickingToOrder({ id: pickingId });
    }
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
