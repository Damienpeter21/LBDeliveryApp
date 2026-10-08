// src/modules/products/services/cartService.ts
import { callOdooRpc, callOdooCustomApi, ODOO_CONFIG } from '../../../app/config';

export interface CreateSaleOrderPayload {
  partnerId: number;
  partnerShippingId?: number;
  partnerInvoiceId?: number;
  carrierId?: number;
  clientOrderRef?: string;
  items: Array<{
    productId: number;
    templateId?: number;
    name?: string;
    quantity: number;
    priceUnit?: number;
  }>;
}

import { PaymentService, CreatePaymentPayload, RetryPaymentPayload, RefundPaymentPayload } from './paymentService';

export class CartService {
  // ── Cart Operations ──────────────────────────────────────────────────

  /**
   * Fetches all active draft/sent carts for user.
   * Postman: "All my carts" (Cart item 1)
   */
  static async fetchAllCarts(partnerId?: number | string): Promise<any> {
    if (!partnerId) {
      return { result: [] };
    }
    const pid = Number(partnerId);
    if (!pid || isNaN(pid)) {
      return { result: [] };
    }

    const domain: any[] = [
      ['partner_id', '=', pid],
      ['state', 'in', ['draft', 'sent']],
    ];

    return callOdooRpc(
      'sale.order',
      'search_read',
      [domain],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'date_order',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'order_line',
        ],
        order: 'date_order desc',
      },
    );
  }

  /**
   * Fetches specific cart order details and line items.
   * Postman: "To Fetch Cart product details:" (Cart item 2) & "GET Cart" (Cart item 4)
   */
  static async fetchCartDetails(orderId: number | string): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'search_read',
      [[['id', '=', Number(orderId)], ['state', '=', 'draft']]],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'order_line',
        ],
      },
    );
  }

  /**
   * Fetches specific order lines by IDs from Odoo.
   */
  static async getOrderLines(lineIds: number[]): Promise<any> {
    if (!lineIds || lineIds.length === 0) return { result: [] };
    return callOdooRpc(
      'sale.order.line',
      'search_read',
      [[['id', 'in', lineIds]]],
      {
        fields: ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'name'],
      },
    );
  }

  /**
   * Resolves any product.template IDs to product.product variant IDs.
   * In Odoo ERP, sale.order.line requires product.product (variant) IDs.
   */
  static async resolveVariantIds(
    items: Array<{ productId: number; templateId?: number; name?: string; quantity: number; priceUnit?: number }>,
  ): Promise<Array<{ productId: number; quantity: number; priceUnit?: number }>> {
    if (!items || items.length === 0) return [];

    const candidateTmplIds = items
      .map(it => Number(it.templateId || it.productId))
      .filter(id => !isNaN(id) && id > 0);

    if (candidateTmplIds.length === 0) {
      return items.map(({ templateId, name, ...rest }) => rest);
    }

    try {
      // Query product.template directly to get the genuine product_variant_id
      const tmplRes = await callOdooRpc(
        'product.template',
        'search_read',
        [[['id', 'in', candidateTmplIds]]],
        { fields: ['id', 'name', 'product_variant_id', 'product_variant_ids', 'list_price'], limit: candidateTmplIds.length * 2 },
      );

      const tmplMap: Record<number, number> = {};
      const foundTemplates = Array.isArray(tmplRes?.result) ? tmplRes.result : [];
      foundTemplates.forEach((t: any) => {
        const vid = Array.isArray(t.product_variant_id)
          ? t.product_variant_id[0]
          : Array.isArray(t.product_variant_ids) && t.product_variant_ids.length > 0
          ? t.product_variant_ids[0]
          : t.product_variant_id;
        if (vid && t.id) {
          tmplMap[Number(t.id)] = Number(vid);
        }
      });

      return items.map(it => {
        const tId = it.templateId ? Number(it.templateId) : undefined;
        const pId = Number(it.productId);

        // If template ID has a mapped variant, use it
        if (tId && tmplMap[tId]) {
          return {
            productId: tmplMap[tId],
            quantity: it.quantity,
            ...(it.priceUnit !== undefined ? { priceUnit: it.priceUnit } : {}),
          };
        }

        // If productId is actually a template ID, replace with genuine variant ID
        if (tmplMap[pId]) {
          return {
            productId: tmplMap[pId],
            quantity: it.quantity,
            ...(it.priceUnit !== undefined ? { priceUnit: it.priceUnit } : {}),
          };
        }

        return {
          productId: pId,
          quantity: it.quantity,
          ...(it.priceUnit !== undefined ? { priceUnit: it.priceUnit } : {}),
        };
      });
    } catch (err) {
      console.warn('resolveVariantIds warning:', err);
      return items.map(({ templateId, name, ...rest }) => rest);
    }
  }

  /**
   * Adds an item to a sale order cart.
   * Postman: "Post Add to Cart" (Cart item 3)
   */
  static async addCartItem(
    orderId: number | string,
    productId: number | string,
    quantity: number,
    templateId?: number | string,
    name?: string,
    priceUnit?: number,
  ): Promise<any> {
    let resolvedId = Number(productId);
    let finalPrice = priceUnit !== undefined && priceUnit > 0 ? Number(priceUnit) : undefined;
    try {
      const resolved = await CartService.resolveVariantIds([
        {
          productId: resolvedId,
          templateId: templateId ? Number(templateId) : undefined,
          name,
          quantity,
          ...(finalPrice !== undefined ? { priceUnit: finalPrice } : {}),
        },
      ]);
      if (resolved.length > 0 && resolved[0].productId) {
        resolvedId = resolved[0].productId;
        if (resolved[0].priceUnit !== undefined) {
          finalPrice = resolved[0].priceUnit;
        }
      }
    } catch {}

    return callOdooRpc(
      'sale.order.line',
      'create',
      [
        {
          order_id: Number(orderId),
          product_id: resolvedId,
          product_uom_qty: quantity,
          ...(finalPrice !== undefined && finalPrice > 0 ? { price_unit: finalPrice } : {}),
        },
      ],
    );
  }

  /**
   * Updates cart item quantity.
   * Postman: "PUT Update Cart Item" (Cart item 5)
   */
  static async updateCartItem(
    lineId: number | string,
    quantity: number,
  ): Promise<any> {
    return callOdooRpc(
      'sale.order.line',
      'write',
      [
        [Number(lineId)],
        {
          product_uom_qty: quantity,
        },
      ],
    );
  }

  /**
   * Removes an item line from cart.
   * Postman: "DELETE Remove Cart Item" (Cart item 6)
   */
  static async removeCartItem(lineId: number | string): Promise<any> {
    return callOdooRpc('sale.order.line', 'unlink', [[Number(lineId)]]);
  }

  /**
   * Clears/deletes the entire cart order.
   * Postman: "DELETE Clear Cart" (Cart item 7)
   */
  static async clearCart(orderId: number | string): Promise<any> {
    CartService.recentOrders.clear();
    CartService.inFlightOrders.clear();
    return callOdooRpc('sale.order', 'unlink', [[Number(orderId)]]);
  }

  /**
   * Clears the in-memory recent orders deduplication cache.
   */
  static clearRecentOrdersCache(): void {
    CartService.recentOrders.clear();
    CartService.inFlightOrders.clear();
  }

  /**
   * Fetches detailed line item records for cart lines.
   */
  static async fetchCartLines(lineIds: (number | string)[]): Promise<any> {
    if (!lineIds || lineIds.length === 0) return { result: [] };
    const numericIds = lineIds.map(id => Number(id));
    return callOdooRpc(
      'sale.order.line',
      'read',
      [numericIds],
      {
        fields: [
          'id',
          'order_id',
          'product_id',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
          'name',
        ],
      },
    );
  }

  /**
   * Delivery confirmed tracking.
   * Postman: "Delivery confirmed" (Cart item 8)
   */
  static async getDeliveryConfirmed(pickingId: number | string): Promise<any> {
    return callOdooRpc(
      'stock.picking',
      'search_read',
      [[['id', '=', Number(pickingId)], ['state', 'in', ['draft', 'waiting']]]],
      {
        fields: ['id', 'name', 'partner_id', 'origin', 'state', 'scheduled_date'],
        order: 'id desc',
      },
    );
  }

  /**
   * Delivery packed tracking.
   * Postman: "Delivery packed" (Cart item 9)
   */
  static async getDeliveryPacked(pickingId: number | string): Promise<any> {
    return callOdooRpc(
      'stock.picking',
      'search_read',
      [[['id', '=', Number(pickingId)], ['state', 'in', ['confirmed']]]],
      {
        fields: ['id', 'name', 'partner_id', 'origin', 'state', 'scheduled_date'],
        order: 'id desc',
      },
    );
  }

  /**
   * Out for delivery tracking.
   * Postman: "Our For delivery" (Cart item 10)
   */
  static async getDeliveryAssigned(pickingId: number | string): Promise<any> {
    return callOdooRpc(
      'stock.picking',
      'search_read',
      [[['id', '=', Number(pickingId)], ['state', 'in', ['assigned']]]],
      {
        fields: ['id', 'name', 'partner_id', 'origin', 'state', 'scheduled_date'],
        order: 'id desc',
      },
    );
  }

  /**
   * Delivery completed tracking.
   * Postman: "Our For delivery Copy" (Cart item 11)
   */
  static async getDeliveryDone(pickingId: number | string): Promise<any> {
    return callOdooRpc(
      'stock.picking',
      'search_read',
      [[['id', '=', Number(pickingId)], ['state', 'in', ['done']]]],
      {
        fields: ['id', 'name', 'partner_id', 'origin', 'state', 'scheduled_date'],
        order: 'id desc',
      },
    );
  }

  // ── Checkout & Sale Order Creation ───────────────────────────────────

  // Concurrency lock and recent order deduplication cache
  private static inFlightOrders: Map<string, Promise<any>> = new Map();
  private static recentOrders: Map<string, { orderId: number; timestamp: number }> = new Map();

  /**
   * Creates a new Sale Order with order lines.
   * Postman: "Create Sale Order" (sale item 3)
   * Enforces API-level idempotency and concurrency locking to prevent duplicate orders.
   */
  static async createSaleOrder(payload: CreateSaleOrderPayload): Promise<any> {
    const partnerId = Number(payload.partnerId || ODOO_CONFIG.UID);
    const shippingId = payload.partnerShippingId ? Number(payload.partnerShippingId) : partnerId;
    const invoiceId = payload.partnerInvoiceId ? Number(payload.partnerInvoiceId) : partnerId;

    const resolvedItems = await CartService.resolveVariantIds(payload.items || []);

    // Create a fingerprint of items (sorted product IDs + quantities)
    const itemsKey = resolvedItems
      .map(it => `${it.productId}:${it.quantity}`)
      .sort()
      .join('|');
    const dedupeKey = `${partnerId}_${itemsKey}`;

    // 1. Idempotency Guard: Check if an identical order was already placed in the last 45 seconds
    const now = Date.now();
    const existingRecent = CartService.recentOrders.get(dedupeKey);
    if (existingRecent && now - existingRecent.timestamp < 45000) {
      console.log(`[CartService] Suppressed duplicate order placement for key ${dedupeKey}. Reusing order ID ${existingRecent.orderId}`);
      return { result: existingRecent.orderId };
    }

    // 2. Concurrency Lock: If an order creation is currently running with the same key, reuse that promise
    if (CartService.inFlightOrders.has(dedupeKey)) {
      console.log(`[CartService] Awaiting in-flight order creation for key ${dedupeKey}`);
      return CartService.inFlightOrders.get(dedupeKey)!;
    }

    const executionPromise = (async () => {
      try {
        const orderLines = resolvedItems.map(item => [
          0,
          0,
          {
            product_id: Number(item.productId),
            product_uom_qty: Number(item.quantity),
            ...(item.priceUnit !== undefined ? { price_unit: Number(item.priceUnit) } : {}),
          },
        ]);

        const res = await callOdooRpc(
          'sale.order',
          'create',
          [
            {
              partner_id: partnerId,
              partner_shipping_id: shippingId,
              partner_invoice_id: invoiceId,
              ...(payload.carrierId ? { carrier_id: Number(payload.carrierId) } : {}),
              ...(payload.clientOrderRef ? { client_order_ref: payload.clientOrderRef } : {}),
              order_line: orderLines,
            },
          ],
        );

        if (res?.result && typeof res.result === 'number') {
          CartService.recentOrders.set(dedupeKey, {
            orderId: res.result,
            timestamp: Date.now(),
          });
          // Clean up stale entries older than 60 seconds
          for (const [k, v] of CartService.recentOrders.entries()) {
            if (Date.now() - v.timestamp > 60000) {
              CartService.recentOrders.delete(k);
            }
          }
        }

        return res;
      } finally {
        CartService.inFlightOrders.delete(dedupeKey);
      }
    })();

    CartService.inFlightOrders.set(dedupeKey, executionPromise);
    return executionPromise;
  }

  /**
   * Fetches checkout summary for draft order.
   * Postman: "GET Checkout Summary" (Checkout item 1)
   */
  static async getCheckoutSummary(orderId: number | string): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'search_read',
      [[['id', '=', Number(orderId)], ['state', '=', 'draft']]],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'partner_shipping_id',
          'partner_invoice_id',
          'order_line',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'carrier_id',
          'pricelist_id',
        ],
      },
    );
  }

  /**
   * Validates that checkout prerequisites (shipping address & order lines) are met.
   * Postman: "POST Validate Checkout" (Checkout item 2)
   */
  static async validateCheckout(orderId: number | string): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'search_read',
      [
        [
          ['id', '=', Number(orderId)],
          ['partner_shipping_id', '!=', false],
          ['order_line', '!=', false],
        ],
      ],
      {
        fields: ['id', 'name', 'state', 'amount_total'],
      },
    );
  }

  /**
   * Fetches available shipping carriers.
   * Postman: "GET Shipping Methods" (Checkout item 3)
   */
  static async getShippingMethods(): Promise<any> {
    return callOdooRpc(
      'delivery.carrier',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: ['id', 'name', 'fixed_price', 'delivery_type', 'free_over'],
      },
    );
  }

  /**
   * Assigns shipping carrier to sale order.
   * Postman: "POST Calculate Shipping" (Checkout item 4)
   */
  static async calculateShipping(
    orderId: number | string,
    carrierId: number | string,
  ): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'write',
      [
        [Number(orderId)],
        {
          carrier_id: Number(carrierId),
        },
      ],
    );
  }

  /**
   * Updates shipping and invoice addresses and carrier on an existing draft sale order.
   */
  static async updateSaleOrderShipping(
    orderId: number | string,
    shippingId?: number,
    carrierId?: number,
    clientOrderRef?: string,
  ): Promise<any> {
    const updateVals: Record<string, any> = {};
    if (shippingId) {
      updateVals.partner_shipping_id = Number(shippingId);
      updateVals.partner_invoice_id = Number(shippingId);
    }
    if (carrierId) {
      updateVals.carrier_id = Number(carrierId);
    }
    if (clientOrderRef) {
      updateVals.client_order_ref = clientOrderRef;
    }
    if (Object.keys(updateVals).length === 0) return { result: true };
    return callOdooRpc('sale.order', 'write', [[Number(orderId)], updateVals]);
  }

  /**
   * Validates minimum order requirement via backend API.
   * Postman: "Sale Minimum Order validation 149 RS"
   * Endpoint: /api/delivery/order/validate_minimum
   */
  static async validateMinimumOrder(orderId: number | string): Promise<{
    valid: boolean;
    minAmount?: number;
    currentAmount?: number;
    message?: string;
    error?: string;
    rawResult?: any;
  }> {
    try {
      const res = await callOdooCustomApi('/api/delivery/order/validate_minimum', {
        order_id: Number(orderId),
      });

      const data = res?.result;
      if (typeof data === 'boolean') {
        return {
          valid: data,
          rawResult: data,
        };
      }

      if (data && typeof data === 'object') {
        const minAmount =
          data.min_amount ??
          data.minimum_amount ??
          data.min_order_amount ??
          data.min_value ??
          data.minimum_order_value;
        const currentAmount = data.current_amount ?? data.total_amount ?? data.subtotal;
        const isValid =
          data.valid ??
          data.is_valid ??
          (data.status === 'success' || data.status === 'valid') ??
          (minAmount !== undefined && currentAmount !== undefined
            ? Number(currentAmount) >= Number(minAmount)
            : true);

        return {
          valid: Boolean(isValid),
          minAmount: minAmount !== undefined ? Number(minAmount) : undefined,
          currentAmount: currentAmount !== undefined ? Number(currentAmount) : undefined,
          message: data.message || data.msg,
          rawResult: data,
        };
      }

      return {
        valid: true,
        rawResult: data,
      };
    } catch (err: any) {
      console.warn('validateMinimumOrder API note:', err);
      return {
        valid: false,
        error: err?.message || 'Failed to validate minimum order on server.',
      };
    }
  }

  /**
   * Removes coupon line from sale order.
   * Postman: "DELETE Remove Coupon" (Checkout item 5)
   */
  static async removeCoupon(couponLineId: number | string): Promise<any> {
    return callOdooRpc('sale.order.line', 'unlink', [[Number(couponLineId)]]);
  }

  // ── Payment Operations ───────────────────────────────────────────────

  /**
   * Creates an account payment.
   * Postman: "POST Create Payment" (Payment item 1)
   */
  static async createPayment(payload: CreatePaymentPayload): Promise<any> {
    return PaymentService.createPayment(payload);
  }

  /**
   * Fetches payment details.
   * Postman: "GET Payment Details" (Payment item 2) & "Create Payment" (sale item 14)
   */
  static async getPaymentDetails(paymentId: number | string): Promise<any> {
    return PaymentService.getPaymentDetails(paymentId);
  }

  /**
   * Fetches payment transaction status.
   * Postman: "GET Payment Status" (Payment item 3)
   */
  static async getPaymentStatus(transactionId: number | string): Promise<any> {
    return PaymentService.getPaymentStatus(transactionId);
  }

  /**
   * Confirms / posts payment.
   * Postman: "POST Verify Payment (Post/Confirm)" (Payment item 4)
   */
  static async verifyPayment(paymentId: number | string): Promise<any> {
    return PaymentService.verifyPayment(paymentId);
  }

  /**
   * Retries payment transaction.
   * Postman: "POST Retry Payment" (Payment item 5)
   */
  static async retryPayment(payload: RetryPaymentPayload): Promise<any> {
    return PaymentService.retryPayment(payload);
  }

  /**
   * Initiates payment refund.
   * Postman: "POST Refund Payment" (Payment item 6)
   */
  static async refundPayment(payload: RefundPaymentPayload): Promise<any> {
    return PaymentService.refundPayment(payload);
  }

  // ── Sale Order Confirmation & Delivery Picking (sale.order & stock.picking) ────

  /**
   * Updates client_order_ref or payment reference on a sale order.
   */
  static async updateSaleOrderRef(orderId: number | string, clientOrderRef: string): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'write',
      [[Number(orderId)], { client_order_ref: clientOrderRef }],
    );
  }

  /**
   * Confirms sale order and automatically generates stock.picking delivery order.
   * Postman: "Confirm Sale order" (sale item)
   */
  static async confirmSaleOrder(orderId: number | string): Promise<any> {
    return callOdooRpc(
      'sale.order',
      'action_confirm',
      [[Number(orderId)]],
    );
  }

  /**
   * Fetches stock.picking delivery order details against a sale order ID.
   * Postman: "Get Delivery details" (sale item)
   */
  static async getDeliveryDetails(saleId: number | string): Promise<any> {
    return callOdooRpc(
      'stock.picking',
      'search_read',
      [[['sale_id', '=', Number(saleId)]]],
      {
        fields: ['id', 'name', 'state'],
      },
    );
  }
}
