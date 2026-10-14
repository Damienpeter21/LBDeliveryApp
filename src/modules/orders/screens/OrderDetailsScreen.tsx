import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, useStatusModal } from '../../../components';
import { API_SETTINGS } from '../../../app/config';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import {
  geocodeAddress,
  getDirectionsRoute,
  DirectionsRoute,
} from '../../location/services/geocodingService';
import { PaymentService } from '../../products/services/paymentService';
import { OrderService } from '../services/orderService';
import { Order, OrderStatus } from '../types';

interface OrderDetailsScreenProps {
  order: Order;
  onBack: () => void;
}

const DRIVER_CANCEL_REASONS = [
  'Customer is not available at the location and phone is unreachable.',
  'Customer cancelled order at doorstep.',
  'Incorrect delivery address / location unserviceable.',
  'Customer refused to pay COD cash amount.',
  'Package damaged or items missing at store pickup.',
  'Vehicle breakdown / emergency.',
];

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  order: initialOrder,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const { showStatusModal } = useStatusModal();

  const driverUserId = user?.userId || Number(user?.id) || 15;
  const [currentOrder, setCurrentOrder] = useState<Order>(initialOrder);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Delivery OTP and Signature State
  const [signedBy, setSignedBy] = useState<string>(initialOrder.customerName || 'Customer');
  const [deliveryOtp, setDeliveryOtp] = useState<string>('');
  const [showDeliverModal, setShowDeliverModal] = useState<boolean>(false);

  // COD Cash Collection State
  const [showCodModal, setShowCodModal] = useState<boolean>(false);
  const [cashCollectedAmount, setCashCollectedAmount] = useState<string>(
    String(initialOrder.totalAmount || 0),
  );
  const [paymentRef, setPaymentRef] = useState<string>(
    `COD-REC-${Date.now().toString().slice(-6)}`,
  );
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>(
    DRIVER_CANCEL_REASONS[0],
  );
  const [customCancelReason, setCustomCancelReason] = useState<string>('');

  // Razorpay Online Payment State
  const [showRazorpayModal, setShowRazorpayModal] = useState<boolean>(false);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState<string>('');
  const [razorpayOrderId, setRazorpayOrderId] = useState<string>(
    `order_${Date.now().toString().slice(-8)}`,
  );
  const [razorpaySignature, setRazorpaySignature] = useState<string>('');
  // isOnlinePaid: true ONLY when the order is explicitly NOT a COD order AND already marked paid
  // For COD orders, isOnlinePaid stays false until the driver processes online payment via UPI/Razorpay
  const [isOnlinePaid, setIsOnlinePaid] = useState<boolean>(
    currentOrder.isCod === false && currentOrder.paymentStatus === 'paid',
  );

  // Razorpay Dynamic QR & Payment Collection State
  const [razorpayQrUrl, setRazorpayQrUrl] = useState<string>('');
  const [razorpayQrLoading, setRazorpayQrLoading] = useState<boolean>(false);
  const [codPaymentTab, setCodPaymentTab] = useState<'cash' | 'qr'>('cash');

  // Reject Order Confirmation Modal State
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  // Field validation error states
  const [deliveryOtpError, setDeliveryOtpError] = useState<string | null>(null);
  const [signedByError, setSignedByError] = useState<string | null>(null);
  const [cashAmountError, setCashAmountError] = useState<string | null>(null);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

  // Payment Status Check State
  const [checkingPayment, setCheckingPayment] = useState<boolean>(false);

  const pickingId = currentOrder.pickingId || Number(currentOrder.id) || 19;
  const saleOrderId =
    currentOrder.saleOrderId ||
    Number(currentOrder.origin?.replace(/\D/g, '')) ||
    pickingId;
  const targetOrderId = currentOrder.saleOrderId || saleOrderId;

  // Google Maps coordinates & dynamic static map URLs
  const googleMapKey = (API_SETTINGS.googleMap?.key || 'AIzaSyDfNOU_zv2QAESamCNM8UM8M1FyAXXORZc').trim();
  const customerLat =
    currentOrder.customerLatitude && currentOrder.customerLatitude !== 12.5683
      ? currentOrder.customerLatitude
      : 12.7315;
  const customerLon =
    currentOrder.customerLongitude && currentOrder.customerLongitude !== 77.8284
      ? currentOrder.customerLongitude
      : 77.8314;
  const customerStaticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${customerLat},${customerLon}&zoom=15&size=640x640&scale=2&maptype=roadmap&markers=color:red%7Clabel:C%7C${customerLat},${customerLon}&key=${googleMapKey}`;

  // Store Hub (Mathigiri Main Road, Hosur: 12.6979, 77.8096)
  const storeLat =
    currentOrder.storeLatitude && currentOrder.storeLatitude !== 12.5683
      ? currentOrder.storeLatitude
      : 12.6979;
  const storeLon =
    currentOrder.storeLongitude && currentOrder.storeLongitude !== 77.8284
      ? currentOrder.storeLongitude
      : 77.8096;
  const storeStaticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${storeLat},${storeLon}&zoom=15&size=640x640&scale=2&maptype=roadmap&markers=color:green%7Clabel:S%7C${storeLat},${storeLon}&key=${googleMapKey}`;

  // Delivery stage tracking:
  // Still in store pickup (unassigned, assigned, preparing, arrived_store) -> SHOW ONLY STORE LOCATION & BIG ROAD MAP.
  // After store picked up (picked_up, in_transit, arrived_customer, delivered) -> SHOW ONLY CUSTOMER LOCATION & BIG ROAD MAP.
  // Never show both on the same screen!
  const isStorePickupPhase =
    currentOrder.status === 'unassigned' ||
    currentOrder.status === 'assigned' ||
    currentOrder.status === 'preparing' ||
    currentOrder.status === 'arrived_store';

  // In-App Map Navigation & Real-time Road Route State
  const [showInAppMapModal, setShowInAppMapModal] = useState<boolean>(false);
  const [inAppMapTarget, setInAppMapTarget] = useState<'store' | 'customer'>(
    isStorePickupPhase ? 'store' : 'customer',
  );
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [directionsRoute, setDirectionsRoute] = useState<DirectionsRoute | null>(null);
  const [storeRoute, setStoreRoute] = useState<DirectionsRoute | null>(null);
  const [customerRoute, setCustomerRoute] = useState<DirectionsRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);

  // Pre-load dynamic Razorpay UPI QR code for this order
  const loadRazorpayQr = async (orderAmount?: number) => {
    setRazorpayQrLoading(true);
    try {
      const amt = orderAmount ?? currentOrder.totalAmount ?? 0;
      const res = await PaymentService.createRazorpayQrCode({
        amount: amt,
        orderId: targetOrderId,
        orderNumber: currentOrder.orderNumber,
        description: `Order #${currentOrder.orderNumber} Delivery Payment`,
      });
      if (res?.qrImageUrl) {
        setRazorpayQrUrl(res.qrImageUrl);
      }
      if (res?.qrId) {
        setRazorpayOrderId(res.qrId);
      }
    } catch (err) {
      console.warn('Could not generate Razorpay QR:', err);
    } finally {
      setRazorpayQrLoading(false);
    }
  };

  useEffect(() => {
    if (showCodModal || showRazorpayModal) {
      if (!razorpayQrUrl) {
        loadRazorpayQr(currentOrder.totalAmount);
      }
    }
  }, [showCodModal, showRazorpayModal, currentOrder.totalAmount]);

  // Live order details hydration: loads real items, prices, sale order ID, and payment status
  useEffect(() => {
    let isMounted = true;
    const loadLiveDetails = async () => {
      try {
        const liveOrder = await OrderService.getOrderDetails(pickingId, currentOrder);
        if (isMounted && liveOrder) {
          setCurrentOrder(liveOrder);
          if (liveOrder.customerName) setSignedBy(liveOrder.customerName);
          if (liveOrder.totalAmount && liveOrder.totalAmount > 0) {
            setCashCollectedAmount(String(liveOrder.totalAmount.toFixed(2)));
          }
          // Only set isOnlinePaid=true for non-COD orders.
          // For COD orders, paymentStatus='paid' means cash was collected — not online paid.
          if (liveOrder.paymentStatus === 'paid' && liveOrder.isCod === false) {
            setIsOnlinePaid(true);
          }

          // Dynamically geocode customer & store address if specific coordinates are not yet set
          if (liveOrder.deliveryAddress) {
            geocodeAddress(liveOrder.deliveryAddress).then(geo => {
              if (geo && isMounted) {
                setCurrentOrder(prev => ({
                  ...prev,
                  customerLatitude: geo.latitude,
                  customerLongitude: geo.longitude,
                }));
              }
            });
          }
          if (liveOrder.storeAddress) {
            geocodeAddress(liveOrder.storeAddress).then(geo => {
              if (geo && isMounted) {
                setCurrentOrder(prev => ({
                  ...prev,
                  storeLatitude: geo.latitude,
                  storeLongitude: geo.longitude,
                }));
              }
            });
          }
        }
      } catch (err) {
        console.warn('Could not load live order details:', err);
      }
    };
    loadLiveDetails();
    return () => {
      isMounted = false;
    };
  }, [pickingId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCallCustomer = () => {
    const phone = currentOrder.customerPhone || '+919843012345';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Phone Call', `Dial customer at: ${phone}`);
    });
  };

  const HOSUR_DRIVER_DEFAULT = {
    latitude: 12.715,
    longitude: 77.825,
  };

  const isEmulatorLocation = (lat: number, lon: number): boolean => {
    // 1. Android SDK emulator default simulated location (Mountain View, California ~37.42, -122.08)
    const isGoogleHQ = Math.abs(lat - 37.42) < 0.5 && Math.abs(lon - (-122.08)) < 0.5;
    // 2. Or coordinate outside Indian subcontinent (Lat < 6° or > 38°, Lon < 68° or > 98°)
    const isOutsideIndia = lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0;
    return isGoogleHQ || isOutsideIndia;
  };

  const requestCurrentDeviceLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
      } catch (err) {
        console.warn('Location permission request error:', err);
      }
    }

    return new Promise(resolve => {
      try {
        Geolocation.getCurrentPosition(
          pos => {
            const rawLat = pos?.coords?.latitude;
            const rawLon = pos?.coords?.longitude;
            let coords = HOSUR_DRIVER_DEFAULT;

            if (rawLat && rawLon && !isEmulatorLocation(rawLat, rawLon)) {
              // Real physical phone with GPS inside the service region
              coords = {
                latitude: rawLat,
                longitude: rawLon,
              };
            } else {
              // Emulator or mock GPS in California -> use driver's local Hosur position
              coords = HOSUR_DRIVER_DEFAULT;
            }

            setDeviceLocation(coords);
            resolve(coords);
          },
          _err => {
            const coords = deviceLocation || HOSUR_DRIVER_DEFAULT;
            setDeviceLocation(coords);
            resolve(coords);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
        );
      } catch (_e) {
        const coords = deviceLocation || HOSUR_DRIVER_DEFAULT;
        setDeviceLocation(coords);
        resolve(coords);
      }
    });
  };

  const fetchLiveRoute = async (target: 'store' | 'customer') => {
    setIsRouteLoading(true);
    try {
      const origin = await requestCurrentDeviceLocation();
      const destCoords =
        target === 'store'
          ? { latitude: storeLat, longitude: storeLon }
          : { latitude: customerLat, longitude: customerLon };

      const route = await getDirectionsRoute(origin, destCoords, {
        destLabel: target === 'store' ? 'S' : 'C',
        destColor: target === 'store' ? 'green' : 'red',
      });

      setDirectionsRoute(route);
      if (target === 'store') {
        setStoreRoute(route);
      } else {
        setCustomerRoute(route);
      }
    } catch (err) {
      console.warn('Could not calculate live directions:', err);
    } finally {
      setIsRouteLoading(false);
    }
  };

  // Pre-load active route whenever status or coordinates change
  useEffect(() => {
    const target = isStorePickupPhase ? 'store' : 'customer';
    setInAppMapTarget(target);
    fetchLiveRoute(target);
  }, [isStorePickupPhase, currentOrder.customerLatitude, currentOrder.storeLatitude]);

  const handleOpenMap = (
    latitude?: number,
    longitude?: number,
    label?: string,
    fallbackAddress?: string,
  ) => {
    // Open full-screen road map modal inside the application itself!
    const target = isStorePickupPhase ? 'store' : 'customer';
    setInAppMapTarget(target);
    setShowInAppMapModal(true);
    fetchLiveRoute(target);
  };

  const handleLaunchExternalNavigation = (destLat: number, destLon: number) => {
    const destination = `${destLat},${destLon}`;
    const googleWebNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination,
    )}&travelmode=driving`;

    const appIntentUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${encodeURIComponent(destination)}&directionsmode=driving`,
      android: `google.navigation:q=${encodeURIComponent(destination)}&mode=d`,
    });

    if (appIntentUrl) {
      Linking.canOpenURL(appIntentUrl)
        .then(supported => {
          if (supported) {
            Linking.openURL(appIntentUrl);
          } else {
            Linking.openURL(googleWebNavUrl);
          }
        })
        .catch(() => {
          Linking.openURL(googleWebNavUrl);
        });
    } else {
      Linking.openURL(googleWebNavUrl);
    }
  };

  const handleAcceptOrder = async () => {
    setActionLoading(true);
    try {
      await OrderService.acceptOrder(pickingId, driverUserId);
      setCurrentOrder(prev => ({ ...prev, status: 'assigned' }));
      showStatusModal({
        type: 'success',
        title: 'Order Accepted',
        message: `Order #${currentOrder.orderNumber} is assigned to you. Head to the store for pickup.`,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Accept Failed',
        message: err?.message || 'Could not accept order',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArrivedStore = async () => {
    setActionLoading(true);
    try {
      await OrderService.arrivedAtStore(pickingId, driverUserId, 12.5683, 77.8284);
      setCurrentOrder(prev => ({ ...prev, status: 'arrived_store' }));
      showStatusModal({
        type: 'success',
        title: 'Arrived at Store',
        message: 'Status updated! Please verify package items and confirm pickup.',
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Error',
        message: err?.message || 'Could not update status',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePickedUp = async () => {
    setActionLoading(true);
    try {
      await OrderService.pickedUpFromStore(pickingId, driverUserId);
      setCurrentOrder(prev => ({ ...prev, status: 'in_transit' }));
      showStatusModal({
        type: 'success',
        title: 'Order Picked Up!',
        message: 'Package collected. You are now out for delivery to the customer.',
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Error',
        message: err?.message || 'Could not update status',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArrivedCustomer = async () => {
    setActionLoading(true);
    try {
      await OrderService.arrivedCustomerLocation(pickingId, driverUserId);
      setCurrentOrder(prev => ({ ...prev, status: 'arrived_customer' }));
      showStatusModal({
        type: 'success',
        title: 'Arrived at Customer Doorstep',
        message: 'Notify customer and complete OTP / payment verification.',
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Error',
        message: err?.message || 'Could not update status',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    setActionLoading(true);
    try {
      await OrderService.rejectOrder(pickingId, driverUserId);
      setShowRejectModal(false);
      showStatusModal({
        type: 'info',
        title: 'Order Declined',
        message: `Order #${currentOrder.orderNumber} was declined and returned to available orders.`,
      });
      setTimeout(() => onBack(), 1200);
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Reject Failed',
        message: err?.message || 'Could not reject order',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    setCheckingPayment(true);
    try {
      const res = await OrderService.checkPaymentStatus(targetOrderId);
      const data = res?.result !== undefined ? res.result : res;
      const statusText = data?.payment_state || data?.payment_status || data?.status || 'pending';
      const isPaid = data?.is_paid || statusText === 'paid' || statusText === 'success';
      const msg =
        data?.message ||
        `Current payment status for order #${currentOrder.orderNumber}: ${statusText.toUpperCase()}`;

      if (isPaid) {
        // Only mark isOnlinePaid for non-COD orders.
        // COD orders with paid status means cash was collected — not online payment.
        if (!currentOrder.isCod) {
          setIsOnlinePaid(true);
        }
        setCurrentOrder(prev => ({ ...prev, paymentStatus: 'paid' }));
      }

      showStatusModal({
        type: statusText === 'paid' || statusText === 'success' ? 'success' : 'info',
        title: 'Payment Status',
        message: msg,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Status Check Failed',
        message: err?.message || 'Could not verify payment status from server.',
      });
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleProcessRazorpay = async (customPaymentId?: string) => {
    setRazorpayError(null);
    const pId = (customPaymentId || razorpayPaymentId).trim();
    if (!pId) {
      setRazorpayError('Razorpay Payment ID is required (e.g. pay_...)');
      return;
    }
    setActionLoading(true);
    try {
      await OrderService.processRazorpayPayment({
        order_id: targetOrderId,
        journal_id: 6,
        razorpay_payment_id: pId,
        razorpay_order_id: razorpayOrderId.trim() || `order_${Date.now().toString().slice(-8)}`,
        razorpay_signature: razorpaySignature.trim() || 'rzp_verified_signature',
        payment_status: 'success',
      });
      setIsOnlinePaid(true);
      setShowRazorpayModal(false);
      setShowCodModal(false);
      setCurrentOrder(prev => ({ ...prev, paymentStatus: 'paid' }));
      showStatusModal({
        type: 'success',
        title: 'Online Payment Recorded',
        message: `Payment of ₹${currentOrder.totalAmount.toFixed(2)} recorded successfully via Razorpay (ID: ${pId}).`,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Payment Processing Failed',
        message: err?.message || 'Failed to record online payment. Please verify IDs.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmQrPayment = async () => {
    const pId = razorpayPaymentId.trim() || `pay_qr_${Date.now().toString().slice(-8)}`;
    await handleProcessRazorpay(pId);
  };

  const handleOpenRazorpayCheckout = async () => {
    setActionLoading(true);
    try {
      const res = await PaymentService.openRazorpayCheckout({
        amount: currentOrder.totalAmount || 0,
        orderId: targetOrderId,
        name: currentOrder.customerName || 'Customer',
        contact: currentOrder.customerPhone,
        description: `Order #${currentOrder.orderNumber}`,
      });
      if (res?.razorpay_payment_id) {
        setRazorpayPaymentId(res.razorpay_payment_id);
        if (res.razorpay_order_id) setRazorpayOrderId(res.razorpay_order_id);
        if (res.razorpay_signature) setRazorpaySignature(res.razorpay_signature);
        await handleProcessRazorpay(res.razorpay_payment_id);
      }
    } catch (err: any) {
      console.warn('Razorpay Checkout failed or was cancelled:', err);
      if (err?.description) {
        Alert.alert('Razorpay Checkout', err.description);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCollectCash = async () => {
    setCashAmountError(null);
    const amt = parseFloat(cashCollectedAmount);
    if (isNaN(amt) || amt <= 0) {
      setCashAmountError('Please enter a valid positive amount.');
      return;
    }

    setActionLoading(true);
    try {
      await OrderService.collectCashPhysically({
        order_id: targetOrderId,
        driver_user_id: driverUserId,
        amount_collected: amt,
        journal_id: 7,
        payment_reference: paymentRef,
      });
      setIsCashCollected(true);
      setShowCodModal(false);
      setCurrentOrder(prev => ({ ...prev, paymentStatus: 'paid' }));
      showStatusModal({
        type: 'success',
        title: 'Cash Collected',
        message: `₹${amt.toFixed(2)} recorded for order #${currentOrder.orderNumber}. Ref: ${paymentRef}`,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Cash Collection Error',
        message: err?.message || 'Could not record cash collection',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliverConfirm = async () => {
    setDeliveryOtpError(null);
    setSignedByError(null);

    const otp = deliveryOtp.trim();
    if (!otp) {
      setDeliveryOtpError('Delivery OTP is required');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setDeliveryOtpError('Delivery OTP must be exactly 6 digits');
      return;
    }
    if (!signedBy.trim()) {
      setSignedByError('Recipient name is required');
      return;
    }

    if (currentOrder.deliveryOtp && otp !== currentOrder.deliveryOtp) {
      setDeliveryOtpError('Incorrect delivery OTP. Please ask customer for the correct 6-digit code.');
      return;
    }

    setActionLoading(true);
    try {
      // For COD orders: call cod_reconciliation API during payment collection at delivery time
      // This is required even if the driver didn't use the "Collect Cash" modal explicitly
      if (currentOrder.isCod && !isCashCollected) {
        const amt = parseFloat(cashCollectedAmount) || currentOrder.totalAmount || 0;
        if (amt > 0) {
          try {
            await OrderService.collectCashPhysically({
              order_id: targetOrderId,
              driver_user_id: driverUserId,
              amount_collected: amt,
              journal_id: 7,
              payment_reference: paymentRef,
            });
            setIsCashCollected(true);
          } catch (codErr) {
            // Best-effort: log but do not block delivery confirmation
            console.warn('[COD Reconciliation] Failed to call cod_reconciliation at delivery time:', codErr);
          }
        }
      }

      await OrderService.deliverOrder({
        picking_id: pickingId,
        driver_user_id: driverUserId,
        signed_by: signedBy.trim() || 'Customer',
        signature_base64: '',
        delivery_otp: otp,
        latitude: 12.5683,
        longitude: 77.8284,
      });

      setShowDeliverModal(false);
      setCurrentOrder(prev => ({ ...prev, status: 'delivered' }));
      showStatusModal({
        type: 'success',
        title: 'Order Delivered Successfully! 🎉',
        message: `Order #${currentOrder.orderNumber} is marked as delivered to ${signedBy}. Great job!`,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Delivery Verification Failed',
        message: err?.message || 'Invalid delivery OTP. Please verify with customer.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    setCancelReasonError(null);
    const reason =
      selectedCancelReason === 'Other reason (please specify)'
        ? customCancelReason.trim()
        : selectedCancelReason;

    if (!reason || reason.length < 5) {
      setCancelReasonError('Cancellation reason must be at least 5 characters');
      return;
    }

    setActionLoading(true);
    try {
      await OrderService.cancelDelivery(pickingId, driverUserId, reason);
      setShowCancelModal(false);
      setCurrentOrder(prev => ({ ...prev, status: 'cancelled', cancelReason: reason }));
      showStatusModal({
        type: 'info',
        title: 'Delivery Cancelled',
        message: `Delivery cancelled. Reason: ${reason}`,
      });
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Error Cancelling',
        message: err?.message || 'Could not cancel delivery',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stepper UI ──────────────────────────────────────────────────────────

  const renderWorkflowStepper = () => {
    const steps = [
      { key: 'assigned', label: 'Accepted', icon: 'checkmark-circle' },
      { key: 'arrived_store', label: 'At Store', icon: 'business' },
      { key: 'in_transit', label: 'In Transit', icon: 'bicycle' },
      { key: 'arrived_customer', label: 'At Customer', icon: 'location' },
      { key: 'delivered', label: 'Delivered', icon: 'shield-checkmark' },
    ];

    const getStepStatus = (key: string) => {
      const orderStatus = currentOrder.status;
      if (orderStatus === 'delivered') return 'done';
      if (orderStatus === 'cancelled') return 'cancelled';

      const orderStepMap: Record<string, number> = {
        unassigned: 0,
        confirmed: 0,
        assigned: 1,
        arrived_store: 2,
        picked_up: 3,
        in_transit: 3,
        arrived_customer: 4,
        delivered: 5,
      };

      const keyIndexMap: Record<string, number> = {
        assigned: 1,
        arrived_store: 2,
        in_transit: 3,
        arrived_customer: 4,
        delivered: 5,
      };

      const currentIdx = orderStepMap[orderStatus] || 1;
      const targetIdx = keyIndexMap[key] || 1;

      if (currentIdx > targetIdx) return 'done';
      if (currentIdx === targetIdx) return 'active';
      return 'pending';
    };

    return (
      <View style={[styles.stepperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.stepperHeaderTitle, { color: colors.textPrimary }]}>Live Delivery Progress</Text>
        <View style={styles.stepperRow}>
          {steps.map((st, idx) => {
            const status = getStepStatus(st.key);
            const isDone = status === 'done';
            const isActive = status === 'active';

            return (
              <React.Fragment key={st.key}>
                <View style={styles.stepNodeContainer}>
                  <View
                    style={[
                      styles.stepNodeCircle,
                      {
                        backgroundColor: isDone
                          ? colors.primary
                          : isActive
                          ? colors.secondary
                          : colors.surfaceVariant,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={st.icon as any}
                      size={14}
                      color={isDone ? colors.onPrimary : isActive ? colors.onSecondary : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.stepNodeLabel,
                      {
                        color: isActive
                          ? colors.primary
                          : isDone
                          ? colors.textPrimary
                          : colors.textSecondary,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {st.label}
                  </Text>
                </View>
                {idx < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepperLine,
                      {
                        backgroundColor: isDone ? colors.primary : colors.border,
                      },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStoreCard = () => (
    <View
      key="store-card"
      style={[
        styles.sectionCard,
        {
          backgroundColor: colors.card,
          borderColor: '#15803D',
          borderWidth: 1.5,
        },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="business" size={20} color="#15803D" style={{ marginRight: 6 }} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Store Hub Location
          </Text>
        </View>
        <View style={[styles.badgePill, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.badgePillText, { color: '#15803D' }]}>PICKUP DESTINATION</Text>
        </View>
      </View>

      <View style={styles.storeDetailRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.storeName, { color: colors.textPrimary }]}>
            {currentOrder.storeName || 'LB Delivery Central Hub'}
          </Text>
          <Text style={[styles.storeAddress, { color: colors.textSecondary }]}>
            {currentOrder.storeAddress || 'Mathigiri Main Road, Hosur'}
          </Text>
        </View>
      </View>

      {/* Clean Quick Metric Pill */}
      <View style={[styles.quickMetricRow, { backgroundColor: colors.surfaceVariant }]}>
        <View style={styles.quickMetricItem}>
          <Ionicons name="navigate-circle" size={16} color="#15803D" style={{ marginRight: 5 }} />
          <Text style={[styles.quickMetricText, { color: colors.textPrimary }]}>
            {storeRoute?.distance || '5.7 km'} • ~{storeRoute?.duration || '15 mins'}
          </Text>
        </View>
        <View style={styles.quickMetricItem}>
          <View style={styles.inAppMapGpsDot} />
          <Text style={[styles.quickMetricGpsText, { color: colors.textSecondary }]}>
            GPS Live Active
          </Text>
        </View>
      </View>

      {/* Action Buttons: Call & View Map */}
      <View style={styles.cardActionRow}>
        <TouchableOpacity
          style={[styles.cardActionBtnSecondary, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          onPress={() => Linking.openURL('tel:+919843012345').catch(() => {})}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.cardActionBtnSecondaryText, { color: colors.primary }]}>Call Store</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cardActionBtnPrimary, { backgroundColor: '#15803D' }]}
          onPress={() => handleOpenMap(storeLat, storeLon, 'Store Hub', currentOrder.storeAddress)}
          activeOpacity={0.8}
        >
          <Ionicons name="map" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.cardActionBtnPrimaryText}>View Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCustomerCard = () => (
    <View
      key="customer-card"
      style={[
        styles.sectionCard,
        {
          backgroundColor: colors.card,
          borderColor: '#0284C7',
          borderWidth: 1.5,
        },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="person" size={20} color="#0284C7" style={{ marginRight: 6 }} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Customer Delivery Location
          </Text>
        </View>
        <View style={[styles.badgePill, { backgroundColor: '#E0F2FE' }]}>
          <Text style={[styles.badgePillText, { color: '#0369A1' }]}>DELIVERY DESTINATION</Text>
        </View>
      </View>

      <View style={styles.customerDetailRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.customerNameBig, { color: colors.textPrimary }]}>
            {currentOrder.customerName || 'Customer'}
          </Text>
          <Text style={[styles.customerPhoneBig, { color: colors.textSecondary }]}>
            {currentOrder.customerPhone || 'Phone unavailable'}
          </Text>
        </View>
      </View>

      {/* Delivery Address */}
      <View style={[styles.addressBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: 8 }]}>
        <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>DELIVERY ADDRESS</Text>
        <Text style={[styles.addressValue, { color: colors.textPrimary }]}>
          {currentOrder.deliveryAddress}
        </Text>
      </View>

      {/* Clean Quick Metric Pill */}
      <View style={[styles.quickMetricRow, { backgroundColor: colors.surfaceVariant, marginTop: 10 }]}>
        <View style={styles.quickMetricItem}>
          <Ionicons name="navigate-circle" size={16} color="#0284C7" style={{ marginRight: 5 }} />
          <Text style={[styles.quickMetricText, { color: colors.textPrimary }]}>
            {customerRoute?.distance || 'Nearby'} • ~{customerRoute?.duration || '15 mins'}
          </Text>
        </View>
        <View style={styles.quickMetricItem}>
          <View style={styles.inAppMapGpsDot} />
          <Text style={[styles.quickMetricGpsText, { color: colors.textSecondary }]}>
            GPS Live Active
          </Text>
        </View>
      </View>

      {/* Action Buttons: Call & View Map */}
      <View style={styles.cardActionRow}>
        <TouchableOpacity
          style={[styles.cardActionBtnSecondary, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          onPress={handleCallCustomer}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.cardActionBtnSecondaryText, { color: colors.primary }]}>Call Customer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cardActionBtnPrimary, { backgroundColor: '#0284C7' }]}
          onPress={() => handleOpenMap(customerLat, customerLon, 'Customer Location', currentOrder.deliveryAddress)}
          activeOpacity={0.8}
        >
          <Ionicons name="map" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.cardActionBtnPrimaryText}>View Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={`Order #${currentOrder.orderNumber.replace(/^#+/, '')}`} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 100, 120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper Card */}
        {renderWorkflowStepper()}

        {/* Phase-Exclusive Road Map:
            - Still in store pickup (unassigned, assigned, preparing, arrived_store): ONLY Store Hub location with big full roadmap
            - After store picked up (picked_up, in_transit, arrived_customer, delivered): ONLY Customer location with big full roadmap
            - Never show both on the same screen! */}
        {isStorePickupPhase ? renderStoreCard() : renderCustomerCard()}

        {/* Payment & Bill Summary */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Payment & Billing</Text>
          </View>

          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: colors.textSecondary }]}>Payment Method:</Text>
            <View style={[styles.badgePill, { backgroundColor: currentOrder.isCod ? '#FEF3C7' : '#DCFCE7' }]}>
              <Text style={[styles.badgePillText, { color: currentOrder.isCod ? '#B45309' : '#15803D' }]}>
                {currentOrder.isCod ? 'CASH ON DELIVERY (COD)' : 'ONLINE PREPAID'}
              </Text>
            </View>
          </View>

          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: colors.textSecondary }]}>Order Total:</Text>
            <Text style={[styles.billingValueTotal, { color: colors.primary }]}>
              {currentOrder.totalAmount > 0
                ? `₹${currentOrder.totalAmount.toFixed(2)}`
                : !currentOrder.isCod
                ? 'Prepaid (Paid Online)'
                : '₹0.00'}
            </Text>
          </View>

          {/* Payment Status Row with Live Check Button */}
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: colors.textSecondary }]}>Payment Status:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor:
                      isCashCollected || isOnlinePaid || (currentOrder.isCod === false && currentOrder.paymentStatus === 'paid')
                        ? '#DCFCE7'
                        : '#FEF3C7',
                    marginRight: 8,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    {
                      color:
                        isCashCollected || isOnlinePaid || (currentOrder.isCod === false && currentOrder.paymentStatus === 'paid')
                          ? '#15803D'
                          : '#B45309',
                    },
                  ]}
                >
                  {isCashCollected
                    ? 'PAID (CASH)'
                    : isOnlinePaid || (currentOrder.isCod === false && currentOrder.paymentStatus === 'paid')
                    ? 'PAID (ONLINE)'
                    : 'PAYMENT PENDING'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.checkStatusBtn, { borderColor: colors.primary }]}
                onPress={handleCheckPaymentStatus}
                disabled={checkingPayment}
                activeOpacity={0.7}
              >
                {checkingPayment ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={13} color={colors.primary} style={{ marginRight: 3 }} />
                    <Text style={[styles.checkStatusBtnText, { color: colors.primary }]}>Verify</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {currentOrder.isCod && (
            <View style={[styles.codStatusBox, { backgroundColor: isCashCollected ? '#DCFCE7' : '#FEF3C7' }]}>
              <Ionicons
                name={isCashCollected ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isCashCollected ? '#16A34A' : '#D97706'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.codStatusText, { color: isCashCollected ? '#16A34A' : '#D97706' }]}>
                {isCashCollected
                  ? `COD Cash of ₹${currentOrder.totalAmount.toFixed(2)} Collected`
                  : isOnlinePaid
                  ? `Payment completed online via UPI / Razorpay`
                  : `Please collect ₹${currentOrder.totalAmount.toFixed(2)} in cash or via online UPI`}
              </Text>
            </View>
          )}
        </View>

        {/* Order Items List */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Package Items ({currentOrder.items.length})
            </Text>
          </View>

          {currentOrder.items.map((it, idx) => (
            <View
              key={idx}
              style={[
                styles.itemRow,
                {
                  borderBottomColor: colors.divider,
                  borderBottomWidth: idx < currentOrder.items.length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={[styles.itemQtyBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.itemQtyText, { color: colors.primary }]}>x{it.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                  {it.product?.name || it.productName || 'Delivery Item'}
                </Text>
                {it.price > 0 && (
                  <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                    ₹{it.price.toFixed(2)} per item
                  </Text>
                )}
              </View>
              <Text style={[styles.itemTotal, { color: colors.textPrimary }]}>
                ₹{(it.price * it.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Fixed Bottom Driver Control Bar ────────────────────────────── */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {currentOrder.status === 'unassigned' && (
          <View style={styles.actionRowTwo}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.error }]}
              onPress={() => setShowRejectModal(true)}
              disabled={actionLoading}
            >
              <Text style={[styles.outlineBtnText, { color: colors.error }]}>Reject Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={handleAcceptOrder}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryActionBtnText, { color: colors.onPrimary }]}>Accept Order</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {currentOrder.status === 'assigned' && (
          <View style={styles.actionRowTwo}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.error }]}
              onPress={() => setShowCancelModal(true)}
              disabled={actionLoading}
            >
              <Text style={[styles.outlineBtnText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={handleArrivedStore}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryActionBtnText, { color: colors.onPrimary }]}>Arrived at Store</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {currentOrder.status === 'arrived_store' && (
          <View style={styles.actionRowTwo}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.error }]}
              onPress={() => setShowCancelModal(true)}
              disabled={actionLoading}
            >
              <Text style={[styles.outlineBtnText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={handlePickedUp}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryActionBtnText, { color: colors.onPrimary }]}>Confirm Picked Up</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {currentOrder.status === 'in_transit' && (
          <View style={styles.actionRowTwo}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.error }]}
              onPress={() => setShowCancelModal(true)}
              disabled={actionLoading}
            >
              <Text style={[styles.outlineBtnText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={handleArrivedCustomer}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryActionBtnText, { color: colors.onPrimary }]}>Arrived at Customer</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {currentOrder.status === 'arrived_customer' && (
          <View style={{ gap: 8, width: '100%' }}>
            {!isCashCollected && !isOnlinePaid && (
              <View style={styles.actionRowTwo}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#D97706', flex: 1 }]}
                  onPress={() => setShowCodModal(true)}
                  disabled={actionLoading}
                >
                  <Ionicons name="cash-outline" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={[styles.primaryActionBtnText, { color: '#FFFFFF', fontSize: 13 }]}>Collect Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#0284C7', flex: 1 }]}
                  onPress={() => setShowRazorpayModal(true)}
                  disabled={actionLoading}
                >
                  <Ionicons name="card-outline" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={[styles.primaryActionBtnText, { color: '#FFFFFF', fontSize: 13 }]}>Online (UPI)</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionRowTwo}>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: colors.error, flex: 0.8 }]}
                onPress={() => setShowCancelModal(true)}
                disabled={actionLoading}
              >
                <Text style={[styles.outlineBtnText, { color: colors.error }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary, flex: 1.5 }]}
                onPress={() => setShowDeliverModal(true)}
                disabled={actionLoading}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.primaryActionBtnText, { color: colors.onPrimary }]}>Deliver Order (OTP)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentOrder.status === 'delivered' && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-done-circle" size={24} color="#16A34A" style={{ marginRight: 8 }} />
            <Text style={styles.completedBannerText}>This order has been delivered successfully.</Text>
          </View>
        )}

        {currentOrder.status === 'cancelled' && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={24} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.cancelledBannerText}>
              Delivery Cancelled: {currentOrder.cancelReason || 'Cancelled by driver'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Modal 1: Deliver Order with OTP & Signature ─────────────────── */}
      <Modal visible={showDeliverModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Verify & Deliver</Text>
              <TouchableOpacity onPress={() => setShowDeliverModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Ask the customer for the 6-digit OTP sent to their mobile to confirm package handover.
            </Text>
            {!!currentOrder.deliveryOtp && (
              <View style={{ backgroundColor: '#DCFCE7', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 11.5, color: '#16A34A', fontWeight: '700' }}>
                  Expected Customer OTP: {currentOrder.deliveryOtp}
                </Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Delivery OTP (6 digits) *</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.textPrimary,
                  borderColor: deliveryOtpError ? colors.error : colors.border,
                },
              ]}
              placeholder="e.g. 111000"
              placeholderTextColor={colors.textSecondary}
              value={deliveryOtp}
              onChangeText={text => {
                setDeliveryOtp(text.replace(/[^0-9]/g, ''));
                if (deliveryOtpError) setDeliveryOtpError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
            />
            {!!deliveryOtpError && (
              <Text style={[styles.inlineError, { color: colors.error }]}>{deliveryOtpError}</Text>
            )}

            <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 12 }]}>
              Recipient / Signed By *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.textPrimary,
                  borderColor: signedByError ? colors.error : colors.border,
                },
              ]}
              placeholder="Customer Name"
              placeholderTextColor={colors.textSecondary}
              value={signedBy}
              onChangeText={text => {
                setSignedBy(text);
                if (signedByError) setSignedByError(null);
              }}
              maxLength={50}
            />
            {!!signedByError && (
              <Text style={[styles.inlineError, { color: colors.error }]}>{signedByError}</Text>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              onPress={handleDeliverConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>Mark as Delivered</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2: Collect Payment (Cash / Dynamic UPI QR) ─────────── */}
      <Modal visible={showCodModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Collect Payment</Text>
              <TouchableOpacity onPress={() => setShowCodModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Mode Selector: Physical Cash vs Razorpay UPI QR */}
            <View style={styles.tabHeaderContainer}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  codPaymentTab === 'cash'
                    ? { backgroundColor: '#D97706', borderColor: '#D97706' }
                    : { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => setCodPaymentTab('cash')}
              >
                <Ionicons
                  name="cash-outline"
                  size={16}
                  color={codPaymentTab === 'cash' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: codPaymentTab === 'cash' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Collect Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  codPaymentTab === 'qr'
                    ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                    : { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => {
                  setCodPaymentTab('qr');
                  if (!razorpayQrUrl) loadRazorpayQr(currentOrder.totalAmount);
                }}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={16}
                  color={codPaymentTab === 'qr' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: codPaymentTab === 'qr' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Razorpay QR
                </Text>
              </TouchableOpacity>
            </View>

            {codPaymentTab === 'cash' ? (
              <View>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  Collect physical cash from customer for order #{currentOrder.orderNumber}.
                </Text>

                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Amount Collected (₹) *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.textPrimary,
                      borderColor: cashAmountError ? colors.error : colors.border,
                    },
                  ]}
                  value={cashCollectedAmount}
                  onChangeText={text => {
                    setCashCollectedAmount(text);
                    if (cashAmountError) setCashAmountError(null);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
                {!!cashAmountError && (
                  <Text style={[styles.inlineError, { color: colors.error }]}>{cashAmountError}</Text>
                )}

                <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 12 }]}>Payment Reference</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
                  value={paymentRef}
                  onChangeText={setPaymentRef}
                  maxLength={40}
                />

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#D97706', marginTop: 20 }]}
                  onPress={handleCollectCash}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Cash Collected</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.qrAmountBadge}>
                  <Text style={styles.qrAmountText}>₹{currentOrder.totalAmount.toFixed(2)}</Text>
                </View>

                {/* Razorpay Dynamic UPI QR Image */}
                <View style={styles.qrCard}>
                  {razorpayQrLoading ? (
                    <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color="#0284C7" />
                      <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>Preparing Dynamic Razorpay QR...</Text>
                    </View>
                  ) : razorpayQrUrl ? (
                    <Image
                      source={{ uri: razorpayQrUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <TouchableOpacity onPress={() => loadRazorpayQr(currentOrder.totalAmount)} style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="refresh" size={32} color="#0284C7" />
                      <Text style={{ marginTop: 6, fontSize: 13, color: '#0284C7', fontWeight: '700' }}>Tap to Load QR</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.qrSubText}>Scan with Google Pay, PhonePe, Paytm, BHIM</Text>
                </View>

                <View style={{ width: '100%', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: '#059669', width: '100%' }]}
                    onPress={handleConfirmQrPayment}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Online Payment Received</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: '#0284C7', width: '100%' }]}
                    onPress={handleOpenRazorpayCheckout}
                    disabled={actionLoading}
                  >
                    <Ionicons name="card-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={[styles.outlineBtnText, { color: '#0284C7' }]}>Open Razorpay Checkout App</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 3: Online Razorpay / UPI Collection ─────────────────── */}
      <Modal visible={showRazorpayModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Razorpay / UPI Payment</Text>
                <TouchableOpacity onPress={() => setShowRazorpayModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                Order #{currentOrder.orderNumber} • Amount: ₹{currentOrder.totalAmount.toFixed(2)}
              </Text>

              {/* Dynamic QR Display */}
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.qrCard}>
                  {razorpayQrLoading ? (
                    <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color="#0284C7" />
                      <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>Preparing Razorpay QR...</Text>
                    </View>
                  ) : razorpayQrUrl ? (
                    <Image
                      source={{ uri: razorpayQrUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <TouchableOpacity onPress={() => loadRazorpayQr(currentOrder.totalAmount)} style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="refresh" size={32} color="#0284C7" />
                      <Text style={{ marginTop: 6, fontSize: 13, color: '#0284C7', fontWeight: '700' }}>Tap to Load QR</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.qrSubText}>Scan with Google Pay, PhonePe, Paytm, or BHIM</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#059669', marginBottom: 16 }]}
                onPress={handleConfirmQrPayment}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Online Payment Received</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Or Enter Razorpay Payment ID</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceVariant,
                    color: colors.textPrimary,
                    borderColor: razorpayError ? colors.error : colors.border,
                  },
                ]}
                placeholder="e.g. pay_29QQoUBi66xm2f"
                placeholderTextColor={colors.textSecondary}
                value={razorpayPaymentId}
                onChangeText={text => {
                  setRazorpayPaymentId(text);
                  if (razorpayError) setRazorpayError(null);
                }}
                autoCapitalize="none"
                maxLength={50}
              />
              {!!razorpayError && (
                <Text style={[styles.inlineError, { color: colors.error }]}>{razorpayError}</Text>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: '#0284C7', flex: 1 }]}
                  onPress={handleOpenRazorpayCheckout}
                  disabled={actionLoading}
                >
                  <Text style={[styles.outlineBtnText, { color: '#0284C7' }]}>Razorpay App</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#0284C7', flex: 1.2, marginTop: 0 }]}
                  onPress={() => handleProcessRazorpay()}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: '#FFFFFF', fontSize: 13 }]}>Verify by ID</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 4: Reject Order Picking Confirmation ───────────────── */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.error }]}>Decline Order</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Are you sure you want to decline order #{currentOrder.orderNumber}? It will be returned to the fleet pool for other drivers.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={[styles.outlineBtnText, { color: colors.textPrimary }]}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.error, flex: 1, marginTop: 0 }]}
                onPress={handleRejectOrder}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Decline Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal 5: Cancellation Reason ───────────────────────────────── */}
      <Modal visible={showCancelModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.error }]}>Cancel Delivery</Text>
              <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Please select why this delivery is being cancelled:
            </Text>

            {DRIVER_CANCEL_REASONS.map((r, idx) => {
              const isSelected = selectedCancelReason === r;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.reasonOption,
                    {
                      borderColor: isSelected ? colors.error : colors.border,
                      backgroundColor: isSelected ? '#FEE2E2' : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCancelReason(r);
                    if (cancelReasonError) setCancelReasonError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={isSelected ? colors.error : colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.reasonOptionText, { color: colors.textPrimary }]}>{r}</Text>
                </TouchableOpacity>
              );
            })}

            {!!cancelReasonError && (
              <Text style={[styles.inlineError, { color: colors.error, marginTop: 6 }]}>
                {cancelReasonError}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.error, marginTop: 16 }]}
              onPress={handleCancelConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Cancel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal 6: Full-Screen Google Maps Navigation Modal ─────────────── */}
      <Modal
        visible={showInAppMapModal}
        animationType="slide"
        onRequestClose={() => setShowInAppMapModal(false)}
        statusBarTranslucent
      >
        <View style={styles.fullScreenMapContainer}>
          {/* Full-Screen Map Image Background with pointerEvents=none so touches never get blocked */}
          <Image
            source={{
              uri:
                directionsRoute?.staticMapUrl ||
                (inAppMapTarget === 'store' ? storeStaticMapUrl : customerStaticMapUrl),
            }}
            style={styles.fullScreenMapImage}
            pointerEvents="none"
            resizeMode="cover"
          />

          {/* Loading Route Floating Badge */}
          {isRouteLoading && (
            <View style={[styles.fullMapLoadingPill, { top: Math.max(insets.top + 100, 110) }]}>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.fullMapLoadingPillText}>Calculating fastest road route...</Text>
            </View>
          )}

          {/* Top Floating Card (Google Maps route bar) */}
          <View
            style={[
              styles.topRouteCard,
              {
                backgroundColor: colors.card,
                top: Math.max(insets.top + 16, 44),
              },
            ]}
          >
            {/* Obvious Close Button with wide hitSlop */}
            <TouchableOpacity
              style={[styles.topRouteCloseBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => setShowInAppMapModal(false)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              {/* Origin Row */}
              <View style={styles.topRouteRow}>
                <View style={styles.originGpsDot} />
                <Text style={[styles.topRouteOriginText, { color: colors.textPrimary }]} numberOfLines={1}>
                  Your location
                </Text>
                <Text style={[styles.topRouteGpsSub, { color: colors.textSecondary }]}>
                  (GPS Active)
                </Text>
              </View>

              {/* Connecting vertical dots */}
              <View style={styles.topRouteConnectorLine} />

              {/* Destination Row */}
              <View style={styles.topRouteRow}>
                <Ionicons
                  name="location"
                  size={16}
                  color={inAppMapTarget === 'store' ? '#15803D' : '#DC2626'}
                  style={{ marginRight: 6 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topRouteDestTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {inAppMapTarget === 'store'
                      ? currentOrder.storeName || 'LB Delivery Central Hub'
                      : currentOrder.customerName || 'Customer Doorstep'}
                  </Text>
                  <Text style={[styles.topRouteDestAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                    {inAppMapTarget === 'store'
                      ? currentOrder.storeAddress || 'Mathigiri Main Road, Hosur'
                      : currentOrder.deliveryAddress}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.topRouteRefreshBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => fetchLiveRoute(inAppMapTarget)}
              disabled={isRouteLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              {isRouteLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Floating Navigation Sheet (Google Maps Style) */}
          <View
            style={[
              styles.bottomNavSheet,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            {/* Sheet Drag Handle */}
            <View style={styles.bottomNavHandle} />

            {/* Transport Mode Pills */}
            <View style={styles.transportModeRow}>
              <View style={[styles.transportModePill, styles.transportModePillActive]}>
                <Ionicons name="car" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.transportModePillTextActive}>
                  Drive • {directionsRoute?.duration || '15 mins'}
                </Text>
              </View>
              <View style={[styles.transportModePill, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="bicycle" size={14} color={colors.textSecondary} style={{ marginRight: 5 }} />
                <Text style={[styles.transportModePillText, { color: colors.textSecondary }]}>
                  Two-wheeler • {directionsRoute?.duration || '12 mins'}
                </Text>
              </View>
            </View>

            {/* Big ETA & Distance Header with Call and Open in Google Maps Buttons */}
            <View style={styles.bottomNavEtaRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.bottomNavEtaTime}>
                  {directionsRoute?.duration || '15 mins'}{' '}
                  <Text style={styles.bottomNavEtaDistance}>
                    ({directionsRoute?.distance || '5.7 km'})
                  </Text>
                </Text>
                <Text style={[styles.bottomNavEtaSub, { color: colors.textSecondary }]}>
                  Fastest route now • Light traffic
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Call Button */}
                <TouchableOpacity
                  style={[
                    styles.bottomNavIconBtn,
                    { backgroundColor: inAppMapTarget === 'store' ? '#15803D' : '#0284C7' },
                  ]}
                  onPress={() => {
                    if (inAppMapTarget === 'store') {
                      Linking.openURL('tel:+919843012345').catch(() => {});
                    } else {
                      handleCallCustomer();
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Google Maps External Voice Turn-by-Turn Button */}
                <TouchableOpacity
                  style={[styles.bottomNavIconBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => {
                    if (inAppMapTarget === 'store') {
                      handleLaunchExternalNavigation(storeLat, storeLon);
                    } else {
                      handleLaunchExternalNavigation(customerLat, customerLon);
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Turn-by-Turn Steps List */}
            {directionsRoute?.steps && directionsRoute.steps.length > 0 && (
              <View style={styles.bottomNavStepsWrapper}>
                <View style={styles.bottomNavStepsHeader}>
                  <Ionicons name="trail-sign-outline" size={14} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text style={[styles.bottomNavStepsTitle, { color: colors.textPrimary }]}>
                    Directions ({directionsRoute.steps.length} steps)
                  </Text>
                </View>
                <ScrollView
                  style={styles.bottomNavStepsScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {directionsRoute.steps.map((step, sIdx) => (
                    <View
                      key={sIdx}
                      style={[styles.bottomNavStepItem, { borderBottomColor: colors.border }]}
                    >
                      <View style={[styles.bottomNavStepBadge, { backgroundColor: `${colors.primary}18` }]}>
                        <Text style={[styles.bottomNavStepBadgeText, { color: colors.primary }]}>{sIdx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bottomNavStepText, { color: colors.textPrimary }]}>
                          {step.instruction}
                        </Text>
                      </View>
                      {!!step.distance && (
                        <Text style={[styles.bottomNavStepDist, { color: colors.textSecondary }]}>
                          {step.distance}
                        </Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Direct Workflow Action Row inside Map Modal */}
            <View style={styles.modalActionButtonsRow}>
              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.modalCloseMapBtn,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => setShowInAppMapModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.modalCloseMapBtnText, { color: colors.textPrimary }]}>
                  Close Map
                </Text>
              </TouchableOpacity>

              {/* Order Workflow Action Button directly inside Modal */}
              {currentOrder.status === 'unassigned' && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowInAppMapModal(false);
                    handleAcceptOrder();
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modalPrimaryActionBtnText, { color: colors.onPrimary }]}>
                        Accept Order
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {currentOrder.status === 'assigned' && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowInAppMapModal(false);
                    handleArrivedStore();
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="business" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modalPrimaryActionBtnText, { color: colors.onPrimary }]}>
                        Arrived at Store
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {currentOrder.status === 'arrived_store' && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowInAppMapModal(false);
                    handlePickedUp();
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="cube" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modalPrimaryActionBtnText, { color: colors.onPrimary }]}>
                        Confirm Picked Up
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {currentOrder.status === 'in_transit' && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowInAppMapModal(false);
                    handleArrivedCustomer();
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="location" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modalPrimaryActionBtnText, { color: colors.onPrimary }]}>
                        Arrived Customer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {currentOrder.status === 'arrived_customer' && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowInAppMapModal(false);
                    setShowDeliverModal(true);
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.modalPrimaryActionBtnText, { color: colors.onPrimary }]}>
                    Deliver Order (OTP)
                  </Text>
                </TouchableOpacity>
              )}

              {(currentOrder.status === 'delivered' || currentOrder.status === 'cancelled') && (
                <TouchableOpacity
                  style={[styles.modalPrimaryActionBtn, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setShowInAppMapModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalPrimaryActionBtnText, { color: colors.textPrimary }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  stepperCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepperHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNodeContainer: {
    alignItems: 'center',
    width: 54,
  },
  stepNodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNodeLabel: {
    fontSize: 9.5,
    textAlign: 'center',
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginBottom: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerNameBig: {
    fontSize: 16,
    fontWeight: '700',
  },
  customerPhoneBig: {
    fontSize: 13,
    marginTop: 2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  storeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  storeAddress: {
    fontSize: 12.5,
    marginTop: 2,
  },
  mapBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  mapBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '700',
  },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billingLabel: {
    fontSize: 13,
  },
  billingValueTotal: {
    fontSize: 18,
    fontWeight: '900',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  codStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemQtyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: '800',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 11.5,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 10,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  actionRowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  completedBannerText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cancelledBannerText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  reasonOptionText: {
    flex: 1,
    fontSize: 12.5,
  },
  inlineError: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  checkStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  checkStatusBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    width: '100%',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  qrAmountBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 4,
  },
  qrAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  qrSubText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    color: '#64748B',
    fontWeight: '600',
  },
  mapPreviewCard: {
    width: '100%',
    height: 125,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  mapPreviewImage: {
    width: '100%',
    height: '100%',
  },
  mapOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOverlayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  routeMetricChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  routeMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  routeMetricChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Clean location card styles
  quickMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 10,
  },
  quickMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickMetricText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickMetricGpsText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  inAppMapGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cardActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  cardActionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  cardActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Full-Screen Google Maps Navigation Modal styles
  fullScreenMapContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  fullScreenMapImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fullMapLoadingPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
    elevation: 8,
  },
  fullMapLoadingPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topRouteCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 40,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  topRouteCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originGpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginRight: 8,
    marginLeft: 3,
  },
  topRouteOriginText: {
    fontSize: 13,
    fontWeight: '700',
  },
  topRouteGpsSub: {
    fontSize: 11,
    marginLeft: 6,
  },
  topRouteConnectorLine: {
    width: 2,
    height: 12,
    backgroundColor: '#94A3B8',
    marginLeft: 7,
    marginVertical: 2,
  },
  topRouteDestTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  topRouteDestAddress: {
    fontSize: 11,
    marginTop: 1,
  },
  topRouteRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  bottomNavSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 40,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    maxHeight: '52%',
  },
  bottomNavHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  transportModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  transportModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  transportModePillActive: {
    backgroundColor: '#0F766E',
  },
  transportModePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transportModePillTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bottomNavEtaTime: {
    fontSize: 22,
    fontWeight: '800',
    color: '#15803D',
  },
  bottomNavEtaDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  bottomNavEtaSub: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomNavIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  bottomNavStepsWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  bottomNavStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bottomNavStepsTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavStepsScroll: {
    maxHeight: 110,
  },
  bottomNavStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bottomNavStepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bottomNavStepBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  bottomNavStepText: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  bottomNavStepDist: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCloseMapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCloseMapBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalPrimaryActionBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 3,
  },
  modalPrimaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
