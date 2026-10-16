// src/modules/orders/utils/orderMapper.ts
import { DeliveryPartner, Order, OrderItem, OrderStatus } from '../types';
import { API_SETTINGS } from '../../../app/config';

/**
 * Normalizes Odoo `state` and `delivery_status` to our standard `OrderStatus`.
 */
export const mapOdooStateToOrderStatus = (
  state?: any,
  deliveryStatus?: any,
  driverId?: any,
): OrderStatus => {
  const normalizedState = typeof state === 'string' ? state.toLowerCase() : '';
  const normalizedDelivery =
    typeof deliveryStatus === 'string' ? deliveryStatus.toLowerCase() : '';

  if (normalizedState === 'cancel' || normalizedDelivery === 'cancel' || normalizedDelivery === 'cancelled' || normalizedDelivery === 'failed') {
    return 'cancelled';
  }

  // 1. Explicit delivery partner app stages have highest priority
  if (normalizedDelivery === 'delivered' || normalizedDelivery === 'full') {
    return 'delivered';
  }

  if (normalizedDelivery === 'arrived_customer' || normalizedDelivery === 'customer_arrived') {
    return 'arrived_customer';
  }

  if (normalizedDelivery === 'picked_up' || normalizedDelivery === 'in_transit' || normalizedDelivery === 'partial') {
    return 'in_transit';
  }

  if (normalizedDelivery === 'arrived_store' || normalizedDelivery === 'store_arrived') {
    return 'arrived_store';
  }

  if (normalizedDelivery === 'assigned' || normalizedDelivery === 'accepted') {
    return 'assigned';
  }

  if (normalizedDelivery === 'unassigned') {
    return 'unassigned';
  }

  // 2. Fallbacks based on Odoo stock.picking state if delivery_app_status is absent
  if (normalizedState === 'done') {
    return 'delivered';
  }

  if (normalizedState === 'draft' || normalizedState === 'waiting') {
    return 'unassigned';
  }

  if (!driverId && normalizedState === 'assigned') {
    return 'unassigned';
  }

  return 'assigned';
};

export const mapDeliveryPickingToOrder = (
  raw: any,
  defaultStatus?: OrderStatus | any,
): Order => {
  const resolvedDefaultStatus: OrderStatus | undefined =
    typeof defaultStatus === 'string' ? (defaultStatus as OrderStatus) : undefined;

  if (!raw) {
    return {
      id: '0',
      pickingId: 0,
      orderNumber: '#WH/OUT/0000',
      date: 'Today',
      time: '12:00 PM',
      status: resolvedDefaultStatus || 'unassigned',
      items: [],
      itemCount: 0,
      totalAmount: 0,
      paymentMode: 'Cash on Delivery',
      deliveryAddress: 'Hosur, Tamil Nadu',
    };
  }

  const pickingId = Number(raw.picking_id || raw.id || 0);
  const id = String(pickingId || raw.order_id || '0');
  const orderNumber =
    raw.name ||
    raw.picking_name ||
    raw.picking_reference ||
    (raw.origin ? `#${raw.origin}` : `#ORD-${id}`);

  // Format date/time
  let date = 'Today';
  let time = 'Now';
  const rawDate = raw.date || raw.scheduled_date || raw.date_order;
  if (typeof rawDate === 'string' && rawDate) {
    try {
      const isoStr = rawDate.includes('Z') || rawDate.includes('+')
        ? rawDate.replace(' ', 'T')
        : `${rawDate.replace(' ', 'T')}Z`;
      const parsed = new Date(isoStr);
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        let hours = parsed.getHours();
        const minutes = parsed.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;

        const now = new Date();
        const isToday =
          now.getDate() === parsed.getDate() &&
          now.getMonth() === parsed.getMonth() &&
          now.getFullYear() === parsed.getFullYear();
        const isYesterday =
          now.getDate() - 1 === parsed.getDate() &&
          now.getMonth() === parsed.getMonth() &&
          now.getFullYear() === parsed.getFullYear();

        if (isToday) {
          date = 'Today';
        } else if (isYesterday) {
          date = 'Yesterday';
        } else {
          date = `${day}/${month}/${year}`;
        }
        time = `${hours}:${minutesStr} ${ampm}`;
      }
    } catch (_) {}
  }

  // Determine stage / status
  const driverId =
    raw.driver_user_id ||
    raw.driver_id ||
    raw.delivery_driver_id ||
    (raw.picking_reference ? 1 : undefined);

  const status = resolvedDefaultStatus || mapOdooStateToOrderStatus(
    raw.state || raw.picking_state,
    raw.delivery_app_status || raw.delivery_state || raw.delivery_status || raw.stage,
    driverId,
  );

  // Parse items
  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.order_line)
    ? raw.order_line
    : Array.isArray(raw.move_lines)
    ? raw.move_lines
    : Array.isArray(raw.lines)
    ? raw.lines
    : [];

  const items: OrderItem[] = rawItems.map((it: any, index: number) => {
    const pName = it.product_name || (Array.isArray(it.product_id) ? it.product_id[1] : it.name) || `Item #${index + 1}`;
    const qty = Number(
      it.quantity ||
      it.product_uic_qty ||
      it.product_uom_qty ||
      it.qty_done ||
      1,
    );
    const price = Number(it.price_unit || it.price || 0);

    return {
      id: it.id || index,
      productName: pName,
      quantity: qty,
      price,
      product: {
        id: it.product_id ? (Array.isArray(it.product_id) ? it.product_id[0] : it.product_id) : index,
        name: pName,
        price,
        unit: it.unit || it.uom || 'unit',
      },
    };
  });

  const totalAmount = Number(
    raw.amount_total ||
    raw.amount ||
    raw.total_amount ||
    raw.amount_collected ||
    items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  const customerName =
    raw.customer_name ||
    (Array.isArray(raw.partner_id) ? raw.partner_id[1] : raw.partner_id) ||
    'Customer';

  const customerPhone = raw.customer_phone || raw.phone || '+91 98430 12345';

  const deliveryAddress =
    raw.delivery_address ||
    raw.customer_address ||
    raw.street ||
    [raw.street, raw.city, raw.zip_code].filter(Boolean).join(', ') ||
    'Hosur, Tamil Nadu';

  const rawCodFlag =
    raw.is_cod !== undefined
      ? raw.is_cod
      : raw.cod !== undefined
      ? raw.cod
      : undefined;

  const rawPaymentModeStr =
    typeof raw.payment_mode === 'string'
      ? raw.payment_mode
      : typeof raw.payment_method === 'string'
      ? raw.payment_method
      : '';

  const rawClientRefStr =
    typeof raw.client_order_ref === 'string'
      ? raw.client_order_ref
      : typeof raw.clientOrderRef === 'string'
      ? raw.clientOrderRef
      : '';

  // Determine isCod authoritatively: handles boolean true/false, numeric 1/0,
  // string "true"/"false", payment mode string, client_order_ref, and defaults to COD (true)
  // so delivery drivers are never misdirected into skipping cash collection.
  let isCod: boolean;
  if (
    rawCodFlag === true ||
    rawCodFlag === 1 ||
    rawCodFlag === 'true' ||
    rawCodFlag === 'True' ||
    rawCodFlag === 't' ||
    rawCodFlag === '1'
  ) {
    isCod = true;
  } else if (
    rawCodFlag === false ||
    rawCodFlag === 0 ||
    rawCodFlag === 'false' ||
    rawCodFlag === 'False' ||
    rawCodFlag === 'f' ||
    rawCodFlag === '0'
  ) {
    isCod = false;
  } else if (rawPaymentModeStr) {
    const lower = rawPaymentModeStr.toLowerCase();
    if (lower.includes('cash') || lower.includes('cod')) {
      isCod = true;
    } else if (
      lower.includes('online') ||
      lower.includes('prepaid') ||
      lower.includes('upi') ||
      lower.includes('card') ||
      lower.includes('razorpay') ||
      lower.includes('netbanking')
    ) {
      isCod = false;
    } else {
      isCod = true;
    }
  } else if (rawClientRefStr) {
    const lowerRef = rawClientRefStr.toLowerCase();
    if (lowerRef.includes('cash') || lowerRef.includes('cod')) {
      isCod = true;
    } else if (
      lowerRef.includes('online') ||
      lowerRef.includes('prepaid') ||
      lowerRef.includes('upi') ||
      lowerRef.includes('card') ||
      lowerRef.includes('rzp')
    ) {
      isCod = false;
    } else {
      isCod = true;
    }
  } else if (Number(raw.amount_paid || 0) > 0) {
    isCod = false;
  } else {
    // Default to Cash on Delivery for delivery partner orders when payment is not explicitly online
    isCod = true;
  }

  // Authoritative paymentMode string matching isCod
  const paymentMode = isCod
    ? (rawPaymentModeStr &&
      (rawPaymentModeStr.toLowerCase().includes('cash') ||
        rawPaymentModeStr.toLowerCase().includes('cod'))
        ? rawPaymentModeStr
        : rawClientRefStr &&
          (rawClientRefStr.toLowerCase().includes('cash') ||
            rawClientRefStr.toLowerCase().includes('cod'))
        ? rawClientRefStr
        : 'Cash on Delivery (COD)')
    : (rawPaymentModeStr || rawClientRefStr || 'Online Paid');

  // Authoritative paymentStatus
  const paymentStatus =
    raw.payment_status ||
    (isCod ? 'pending' : 'paid');

  return {
    id,
    pickingId,
    saleOrderId: raw.sale_order_id
      ? Number(raw.sale_order_id)
      : Array.isArray(raw.sale_id)
      ? Number(raw.sale_id[0])
      : raw.sale_id
      ? Number(raw.sale_id)
      : undefined,
    orderNumber,
    origin: raw.origin || undefined,
    date,
    time,
    status,
    items,
    itemCount: items.length || Number(raw.items_count || 1),
    totalAmount,
    savings: 0,
    paymentMode,
    paymentStatus,
    isCod,
    deliveryAddress,
    customerName,
    customerPhone,
    storeName:
      raw.store_name ||
      raw.warehouse_name ||
      raw.hub_name ||
      (Array.isArray(raw.warehouse_address_id) ? raw.warehouse_address_id[1] : undefined) ||
      (Array.isArray(raw.company_id) ? raw.company_id[1] : undefined) ||
      'LB Mart',
    storeAddress:
      raw.store_address ||
      raw.warehouse_address ||
      raw.hub_address ||
      '456 New Avenue, Therper Road, Denkanikottai, Tamil Nadu 600002',
    storePhone:
      raw.store_phone ||
      raw.warehouse_phone ||
      raw.hub_phone ||
      '7603918199',
    deliveryOtp:
      raw.delivery_otp && raw.delivery_otp !== false
        ? String(raw.delivery_otp).trim()
        : raw.otp && raw.otp !== false
        ? String(raw.otp).trim()
        : raw.deliveryOtp
        ? String(raw.deliveryOtp).trim()
        : undefined,
    latitude: raw.latitude,
    longitude: raw.longitude,
    customerLatitude:
      (typeof raw.customer_latitude === 'number' && raw.customer_latitude !== 0 && raw.customer_latitude !== 12.5683)
        ? raw.customer_latitude
        : (typeof raw.partner_latitude === 'number' && raw.partner_latitude !== 0 && raw.partner_latitude !== 12.5683)
        ? raw.partner_latitude
        : (typeof raw.latitude === 'number' && raw.latitude !== 0 && raw.latitude !== 12.5683)
        ? raw.latitude
        : undefined,
    customerLongitude:
      (typeof raw.customer_longitude === 'number' && raw.customer_longitude !== 0 && raw.customer_longitude !== 77.8284)
        ? raw.customer_longitude
        : (typeof raw.partner_longitude === 'number' && raw.partner_longitude !== 0 && raw.partner_longitude !== 77.8284)
        ? raw.partner_longitude
        : (typeof raw.longitude === 'number' && raw.longitude !== 0 && raw.longitude !== 77.8284)
        ? raw.longitude
        : undefined,
    storeLatitude:
      (typeof raw.store_latitude === 'number' && raw.store_latitude !== 0 && raw.store_latitude !== 12.5683)
        ? raw.store_latitude
        : (typeof raw.warehouse_latitude === 'number' && raw.warehouse_latitude !== 0)
        ? raw.warehouse_latitude
        : (typeof raw.hub_latitude === 'number' && raw.hub_latitude !== 0)
        ? raw.hub_latitude
        : 12.519887,
    storeLongitude:
      (typeof raw.store_longitude === 'number' && raw.store_longitude !== 0 && raw.store_longitude !== 77.8284)
        ? raw.store_longitude
        : (typeof raw.warehouse_longitude === 'number' && raw.warehouse_longitude !== 0)
        ? raw.warehouse_longitude
        : (typeof raw.hub_longitude === 'number' && raw.hub_longitude !== 0)
        ? raw.hub_longitude
        : 77.792987,
  };
};

/**
 * Legacy compatibility mapper
 */
export const mapOdooSaleOrderToOrder = (rawOrder: any, deliveryPartner?: DeliveryPartner): Order => {
  const mapped = mapDeliveryPickingToOrder(rawOrder);
  if (deliveryPartner) {
    mapped.deliveryPartner = deliveryPartner;
  }
  return mapped;
};
