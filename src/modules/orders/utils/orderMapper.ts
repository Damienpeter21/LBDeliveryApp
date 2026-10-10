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

  if (normalizedState === 'cancel' || normalizedDelivery === 'cancel' || normalizedDelivery === 'cancelled') {
    return 'cancelled';
  }

  if (normalizedDelivery === 'delivered' || normalizedDelivery === 'full' || normalizedState === 'done') {
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

  if (driverId && (normalizedDelivery === 'assigned' || normalizedDelivery === 'accepted')) {
    return 'assigned';
  }

  if (!driverId || normalizedDelivery === 'unassigned' || normalizedState === 'draft' || normalizedState === 'waiting' || normalizedState === 'assigned') {
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
  const orderNumber = raw.name || raw.picking_name || (raw.origin ? `#${raw.origin}` : `#ORD-${id}`);

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
  const driverId = raw.driver_user_id || raw.driver_id;
  const status = resolvedDefaultStatus || mapOdooStateToOrderStatus(
    raw.state,
    raw.delivery_state || raw.delivery_status || raw.stage,
    driverId,
  );

  // Parse items
  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.order_line)
    ? raw.order_line
    : Array.isArray(raw.move_lines)
    ? raw.move_lines
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
    raw.street ||
    [raw.street, raw.city, raw.zip_code].filter(Boolean).join(', ') ||
    'Hosur, Tamil Nadu';

  const paymentMode =
    raw.payment_mode ||
    (raw.is_cod || raw.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Online Paid');

  return {
    id,
    pickingId,
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
    paymentStatus: raw.payment_status || (raw.is_cod ? 'pending' : 'paid'),
    isCod: raw.is_cod ?? (paymentMode.toLowerCase().includes('cash') || paymentMode.toLowerCase().includes('cod')),
    deliveryAddress,
    customerName,
    customerPhone,
    storeName: raw.store_name || 'LB Delivery Central Hub',
    storeAddress: raw.store_address || 'Mathigiri Main Road, Hosur',
    eta: raw.eta || '15-20 mins',
    cancelReason: raw.cancel_reason,
    latitude: raw.latitude,
    longitude: raw.longitude,
    customerLatitude: raw.customer_latitude || raw.latitude,
    customerLongitude: raw.customer_longitude || raw.longitude,
    storeLatitude: raw.store_latitude,
    storeLongitude: raw.store_longitude,
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
