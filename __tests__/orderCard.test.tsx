import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { OrderCard } from '../src/modules/orders/components/OrderCard';
import { Order } from '../src/modules/orders/types';

describe('OrderCard Component Tests', () => {
  const dummyOrder: Order = {
    id: '101',
    pickingId: 101,
    orderNumber: '#WH/OUT/00101',
    origin: 'S00191',
    date: '10/10/2026',
    time: '02:00 PM',
    status: 'assigned',
    items: [
      {
        id: 1,
        productName: 'Organic Milk 1L',
        quantity: 2,
        price: 70,
      },
    ],
    itemCount: 1,
    totalAmount: 140,
    paymentMode: 'Online Paid',
    paymentStatus: 'paid',
    isCod: false,
    deliveryAddress: '42 MG Road, Bangalore',
    customerName: 'Felix Kumar',
    customerPhone: '9876543210',
  };

  it('renders prepaid order with correct origin and prepaid indicator', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <OrderCard
          order={dummyOrder}
          onTrackOrder={jest.fn()}
        />
      );
    });

    const textNodes = renderer.root.findAllByType('Text');
    const allText = textNodes.map((node: any) => node.props.children).flat().join(' ');

    expect(allText).toContain('WH/OUT/00101');
    expect(allText).toContain('S00191');
    expect(allText).toContain('PREPAID');
    expect(allText).toContain('PAID ONLINE');
    expect(allText).toContain('140.00');
  });

  it('renders cash on delivery order with CASH TO COLLECT indicator', () => {
    const codOrder: Order = {
      ...dummyOrder,
      isCod: true,
      paymentMode: 'Cash on Delivery (COD)',
      paymentStatus: 'pending',
    };

    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <OrderCard
          order={codOrder}
          onTrackOrder={jest.fn()}
        />
      );
    });

    const textNodes = renderer.root.findAllByType('Text');
    const allText = textNodes.map((node: any) => node.props.children).flat().join(' ');

    expect(allText).toContain('COD CASH');
    expect(allText).toContain('CASH TO COLLECT');
    expect(allText).toContain('140.00');
  });
});
