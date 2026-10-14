import {
  mapDeliveryPickingToOrder,
  mapOdooStateToOrderStatus,
} from '../src/modules/orders/utils/orderMapper';

describe('orderMapper unit tests', () => {
  const basePicking = {
    id: 101,
    name: 'WH/OUT/00101',
    origin: 'S00250',
    state: 'assigned',
    date: '2026-10-10 14:00:00',
    partner_id: [12, 'Arun Kumar'],
    delivery_status: 'ready',
    amount_total: 650.5,
    is_cod: false,
    phone: '9876543210',
    street: '123 Cross Street',
    city: 'Chennai',
    zip_code: '600001',
    lines: [
      {
        id: 1,
        product_id: [50, 'Fresh Apple 1kg'],
        product_uom_qty: 2,
        price_unit: 150,
      },
    ],
  };

  it('correctly maps online prepaid picking to Order object', () => {
    const order = mapDeliveryPickingToOrder(basePicking);

    expect(order.id).toBe('101');
    expect(order.orderNumber).toBe('WH/OUT/00101');
    expect(order.origin).toBe('S00250');
    expect(order.customerName).toBe('Arun Kumar');
    expect(order.customerPhone).toBe('9876543210');
    expect(order.totalAmount).toBe(650.5);
    expect(order.isCod).toBe(false);
    expect(order.paymentStatus).toBe('paid');
    expect(order.items.length).toBe(1);
    expect(order.items[0]?.product?.name).toBe('Fresh Apple 1kg');
    expect(order.items[0]?.quantity).toBe(2);
  });

  it('correctly maps cash on delivery picking', () => {
    const codPicking = {
      ...basePicking,
      is_cod: true,
      payment_mode: 'Cash on Delivery',
    };
    const order = mapDeliveryPickingToOrder(codPicking);

    expect(order.isCod).toBe(true);
    expect(order.paymentStatus).toBe('pending');
  });

  it('regression: is_cod=true wins even when payment_mode returns "Online" from API', () => {
    // This is the exact bug scenario from the screenshot:
    // Odoo sends is_cod: true but also payment_mode: "Online" (or "Prepaid").
    // Before the fix, payment_mode was evaluated first via ||, making paymentMode="Online",
    // and isCod (via ??) fell back to paymentMode.includes('cash') = false → showed PREPAID.
    const conflictingPicking = {
      ...basePicking,
      is_cod: true,
      payment_mode: 'Online', // Odoo bug: contradicts is_cod
    };
    const order = mapDeliveryPickingToOrder(conflictingPicking);

    expect(order.isCod).toBe(true);                          // must honour is_cod flag
    expect(order.paymentMode).toBe('Cash on Delivery (COD)'); // must resolve to COD
    expect(order.paymentStatus).toBe('pending');
  });

  it('regression: is_cod=false correctly stays prepaid even when payment_mode is absent', () => {
    const prepaidPicking = {
      ...basePicking,
      is_cod: false,
      payment_mode: undefined,
    };
    const order = mapDeliveryPickingToOrder(prepaidPicking);

    expect(order.isCod).toBe(false);
    expect(order.paymentMode).toBe('Online Paid');
    expect(order.paymentStatus).toBe('paid');
  });

  it('handles fallback defaults when optional fields are missing', () => {
    const minimalPicking = {
      id: 202,
      name: 'WH/OUT/00202',
    };
    const order = mapDeliveryPickingToOrder(minimalPicking);

    expect(order.id).toBe('202');
    expect(order.orderNumber).toBe('WH/OUT/00202');
    expect(order.customerName).toBe('Customer');
    expect(order.totalAmount).toBe(0);
    expect(order.items).toEqual([]);
  });

  describe('mapOdooStateToOrderStatus', () => {
    it('maps cancelled states', () => {
      expect(mapOdooStateToOrderStatus('cancel', undefined, undefined)).toBe('cancelled');
      expect(mapOdooStateToOrderStatus(undefined, 'cancelled', undefined)).toBe('cancelled');
    });

    it('maps delivered states', () => {
      expect(mapOdooStateToOrderStatus('done', undefined, undefined)).toBe('delivered');
      expect(mapOdooStateToOrderStatus(undefined, 'delivered', undefined)).toBe('delivered');
    });

    it('maps in_transit states', () => {
      expect(mapOdooStateToOrderStatus(undefined, 'picked_up', 2)).toBe('in_transit');
      expect(mapOdooStateToOrderStatus(undefined, 'in_transit', 2)).toBe('in_transit');
    });

    it('maps unassigned states', () => {
      expect(mapOdooStateToOrderStatus('assigned', 'unassigned', null)).toBe('unassigned');
      expect(mapOdooStateToOrderStatus('draft', undefined, null)).toBe('unassigned');
    });

    it('maps active accepted deliveries and completed done pickings', () => {
      expect(mapOdooStateToOrderStatus('confirmed', 'accepted', 2)).toBe('assigned');
      expect(mapOdooStateToOrderStatus('done', 'arrived_customer', 2)).toBe('arrived_customer');
    });

    it('maps live Odoo all_my_delivery picking object correctly', () => {
      const liveDeliveredPicking = {
        picking_id: 73,
        picking_reference: 'WH/OUT/00073',
        origin: 'S00195',
        delivery_app_status: 'delivered',
        picking_state: 'done',
        customer_name: 'Felix Kumar Z',
        customer_phone: '8870809004',
        customer_address: '76/A2, Kembathapalli, 635107',
        scheduled_date: '2026-10-10 10:00:00',
      };
      const order = mapDeliveryPickingToOrder(liveDeliveredPicking);
      expect(order.orderNumber).toBe('WH/OUT/00073');
      expect(order.status).toBe('delivered');
      expect(order.deliveryAddress).toBe('76/A2, Kembathapalli, 635107');

      const liveActivePicking = {
        picking_id: 76,
        picking_reference: 'WH/OUT/00076',
        delivery_app_status: 'accepted',
        picking_state: 'confirmed',
        customer_address: '76/A2, Kembathapalli, 635107',
      };
      const activeOrder = mapDeliveryPickingToOrder(liveActivePicking);
      expect(activeOrder.status).toBe('assigned');
    });

    it('correctly maps user exact COD picking payload with is_cod:true and payment_mode', () => {
      const userPicking = {
        id: 101,
        name: 'WH/OUT/00101',
        origin: 'S00042',
        state: 'assigned',
        scheduled_date: '2026-10-13 10:30:00',
        delivery_app_status: 'unassigned',
        delivery_driver_id: false,
        partner_id: [55, 'Ravi Kumar'],
        delivery_otp: '4821',
        items: [],
        amount_total: 850.0,
        is_cod: true,
        payment_mode: 'Cash on Delivery (COD)',
        customer_name: 'Ravi Kumar',
        customer_phone: '+91 98430 XXXXX',
        delivery_address: '12 Gandhi St, Hosur',
        latitude: 12.5683,
        longitude: 77.8284,
      };

      const order = mapDeliveryPickingToOrder(userPicking);
      expect(order.isCod).toBe(true);
      expect(order.paymentMode).toBe('Cash on Delivery (COD)');
      expect(order.paymentStatus).toBe('pending');
      expect(order.totalAmount).toBe(850.0);
      expect(order.customerName).toBe('Ravi Kumar');
      expect(order.deliveryAddress).toBe('12 Gandhi St, Hosur');
    });

    it('correctly detects COD when is_cod is string "true" or numeric 1', () => {
      const stringCod = mapDeliveryPickingToOrder({ id: 102, is_cod: 'true' as any });
      expect(stringCod.isCod).toBe(true);
      expect(stringCod.paymentStatus).toBe('pending');

      const numericCod = mapDeliveryPickingToOrder({ id: 103, is_cod: 1 as any });
      expect(numericCod.isCod).toBe(true);
      expect(numericCod.paymentStatus).toBe('pending');
    });

    it('correctly detects COD from payment_mode string when is_cod is omitted', () => {
      const codByMode = mapDeliveryPickingToOrder({
        id: 104,
        payment_mode: 'Cash on Delivery (COD)',
      });
      expect(codByMode.isCod).toBe(true);
      expect(codByMode.paymentMode).toBe('Cash on Delivery (COD)');
      expect(codByMode.paymentStatus).toBe('pending');
    });
  });
});

