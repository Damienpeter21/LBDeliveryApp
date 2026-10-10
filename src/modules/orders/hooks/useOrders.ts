import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { OrderService } from '../services/orderService';
import { Order, OrderStatus } from '../types';
import {
  CodReconciliationPayload,
  DeliverOrderPayload,
  RazorpayPaymentPayload,
} from '../../delivery/types';

export type DeliveryTabFilter = 'available' | 'active' | 'delivered' | 'cancelled';

export const useOrders = () => {
  const { user, isAuthenticated } = useAuth();
  const driverUserId = user?.userId || Number(user?.id) || 15;

  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<DeliveryTabFilter>('available');
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [unassigned, myDels, todayDels, cancelled] = await Promise.all([
        OrderService.getUnassignedOrders(),
        OrderService.getMyDeliveries(driverUserId),
        OrderService.getTodayDeliveries(driverUserId),
        OrderService.getMyCancelledOrders(driverUserId),
      ]);

      setAvailableOrders(unassigned);
      setMyDeliveries(myDels);
      setTodayDeliveries(todayDels);
      setCancelledOrders(cancelled);
    } catch (err: any) {
      console.warn('useOrders fetch error:', err);
      setError(err?.message || 'Could not refresh orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [driverUserId]);

  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  const activeDeliveries = useMemo(() => {
    return myDeliveries.filter(
      o => o.status !== 'delivered' && o.status !== 'cancelled',
    );
  }, [myDeliveries]);

  const deliveredOrders = useMemo(() => {
    return myDeliveries.filter(o => o.status === 'delivered');
  }, [myDeliveries]);

  const displayedOrders = useMemo(() => {
    switch (selectedTab) {
      case 'available':
        return availableOrders;
      case 'active':
        return activeDeliveries;
      case 'delivered':
        return deliveredOrders.length > 0 ? deliveredOrders : todayDeliveries;
      case 'cancelled':
        return cancelledOrders;
      default:
        return availableOrders;
    }
  }, [selectedTab, availableOrders, activeDeliveries, deliveredOrders, todayDeliveries, cancelledOrders]);

  // Actions
  const acceptOrder = async (pickingId: number): Promise<boolean> => {
    try {
      await OrderService.acceptOrder(pickingId, driverUserId);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to accept order');
      return false;
    }
  };

  const rejectOrder = async (pickingId: number): Promise<boolean> => {
    try {
      await OrderService.rejectOrder(pickingId, driverUserId);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to reject order');
      return false;
    }
  };

  const arrivedAtStore = async (pickingId: number, lat?: number, lon?: number): Promise<boolean> => {
    try {
      await OrderService.arrivedAtStore(pickingId, driverUserId, lat, lon);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to update store arrival');
      return false;
    }
  };

  const pickedUpFromStore = async (pickingId: number): Promise<boolean> => {
    try {
      await OrderService.pickedUpFromStore(pickingId, driverUserId);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to update pickup status');
      return false;
    }
  };

  const arrivedCustomer = async (pickingId: number): Promise<boolean> => {
    try {
      await OrderService.arrivedCustomerLocation(pickingId, driverUserId);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to update customer arrival');
      return false;
    }
  };

  const deliverOrder = async (payload: Omit<DeliverOrderPayload, 'driver_user_id'>): Promise<boolean> => {
    try {
      await OrderService.deliverOrder({
        ...payload,
        driver_user_id: driverUserId,
      });
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to deliver order');
      return false;
    }
  };

  const cancelDelivery = async (pickingId: number, reason: string): Promise<boolean> => {
    try {
      await OrderService.cancelDelivery(pickingId, driverUserId, reason);
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel delivery');
      return false;
    }
  };

  const collectCash = async (orderId: number, amount: number, reference?: string): Promise<boolean> => {
    try {
      await OrderService.collectCashPhysically({
        order_id: orderId,
        driver_user_id: driverUserId,
        amount_collected: amount,
        payment_reference: reference,
      });
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to record cash collection');
      return false;
    }
  };

  const processRazorpay = async (payload: Omit<RazorpayPaymentPayload, 'payment_status'> & { payment_status?: string }): Promise<boolean> => {
    try {
      await OrderService.processRazorpayPayment({
        ...payload,
        payment_status: payload.payment_status || 'success',
      });
      await fetchOrders(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to process Razorpay payment');
      return false;
    }
  };

  const refreshOrders = useCallback(() => fetchOrders(true), [fetchOrders]);

  return {
    orders: displayedOrders,
    availableOrders,
    activeDeliveries,
    deliveredOrders,
    todayDeliveries,
    cancelledOrders,
    selectedTab,
    setSelectedTab,
    loading,
    refreshing,
    error,
    refreshOrders,
    acceptOrder,
    rejectOrder,
    arrivedAtStore,
    pickedUpFromStore,
    arrivedCustomer,
    deliverOrder,
    cancelDelivery,
    collectCash,
    processRazorpay,
  };
};

export default useOrders;
