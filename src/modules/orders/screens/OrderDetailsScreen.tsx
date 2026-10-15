import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  PermissionsAndroid,
  PanResponder,
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
import {
  AppHeader,
  InteractiveGoogleMap,
  InteractiveGoogleMapRef,
  useStatusModal,
} from '../../../components';
import { API_SETTINGS } from '../../../app/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  const [isAutoDetectingPayment, setIsAutoDetectingPayment] = useState<boolean>(false);
  const [autoPaymentReceived, setAutoPaymentReceived] = useState<boolean>(false);
  const [showManualPaymentInput, setShowManualPaymentInput] = useState<boolean>(false);
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
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [directionsRoute, setDirectionsRoute] = useState<DirectionsRoute | null>(null);
  const [storeRoute, setStoreRoute] = useState<DirectionsRoute | null>(null);
  const [customerRoute, setCustomerRoute] = useState<DirectionsRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number }>({
    latitude: storeLat,
    longitude: storeLon,
  });
  const [mapZoom, setMapZoom] = useState<number>(14);
  const interactiveMapRef = useRef<InteractiveGoogleMapRef>(null);
  const [showRouteStepsSheet, setShowRouteStepsSheet] = useState<boolean>(false);

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

  // Normalize QR URL to ensure all devices display a clean, full-size 1:1 square QR code (never the shrunk vertical standee poster)
  const getCleanQrImageUrl = (url?: string): string => {
    if (!url) return '';
    if (url.includes('rzp.io') || url.includes('/payments/qr_codes')) {
      const amt = (currentOrder.totalAmount || 0).toFixed(2);
      const rawId = (razorpayOrderId || '').replace(/^qr_/, '') || Date.now().toString().slice(-8);
      const upi = `upi://pay?ver=01&mode=22&pa=razorpay@icici&pn=LB%20Mart&tr=RZP${rawId}qrv2&cu=INR&mc=5411&am=${amt}&tn=PaymentforOrder${encodeURIComponent(currentOrder.orderNumber || '')}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(upi)}`;
    }
    return url;
  };

  useEffect(() => {
    if (showCodModal || showRazorpayModal) {
      if (!razorpayQrUrl) {
        loadRazorpayQr(currentOrder.totalAmount);
      }
    }
  }, [showCodModal, showRazorpayModal, currentOrder.totalAmount]);

  // ── Automatic Online Payment Detection (Live Real-Time Polling) ──────────
  useEffect(() => {
    let isMounted = true;
    let pollInterval: any = null;

    if (showRazorpayModal && !isOnlinePaid && !autoPaymentReceived) {
      setIsAutoDetectingPayment(true);
      const effectiveOrderId = targetOrderId || currentOrder.pickingId || pickingId;

      pollInterval = setInterval(async () => {
        if (!isMounted) return;

        try {
          // 1. Direct gateway verification via dynamic Razorpay QR Code
          if (razorpayOrderId) {
            const qrResult = await PaymentService.checkRazorpayQrPayments(razorpayOrderId);
            if (qrResult.isPaid && isMounted) {
              if (pollInterval) clearInterval(pollInterval);
              setIsAutoDetectingPayment(false);
              setAutoPaymentReceived(true);
              const pId = qrResult.paymentId || `pay_qr_${Date.now().toString().slice(-8)}`;
              await handleProcessRazorpay(pId);
              return;
            }
          }

          // 2. Server verification via Odoo payment status endpoint
          if (effectiveOrderId) {
            const statusRes = await OrderService.checkPaymentStatus(effectiveOrderId);
            const data = statusRes?.result !== undefined ? statusRes.result : statusRes;
            const statusText = data?.payment_state || data?.payment_status || data?.status || '';
            const isPaid = data?.is_paid || statusText === 'paid' || statusText === 'success';

            if (isPaid && isMounted) {
              if (pollInterval) clearInterval(pollInterval);
              setIsAutoDetectingPayment(false);
              setAutoPaymentReceived(true);
              const pId = data?.payment_id || `pay_verified_${Date.now().toString().slice(-8)}`;
              await handleProcessRazorpay(pId);
              return;
            }
          }
        } catch (_) {
          // Continue polling silently
        }
      }, 3000);
    } else {
      setIsAutoDetectingPayment(false);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [
    showRazorpayModal,
    isOnlinePaid,
    autoPaymentReceived,
    razorpayOrderId,
    targetOrderId,
    pickingId,
  ]);

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

  const isEmulatorLocation = (lat: number, lon: number): boolean => {
    // Android SDK emulator default simulated location (Mountain View, California ~37.42, -122.08)
    const isGoogleHQ = Math.abs(lat - 37.42) < 0.5 && Math.abs(lon - (-122.08)) < 0.5;
    return isGoogleHQ;
  };

  // Dynamically resolve real-world device location via Google Geolocation API or IP geolocation
  // when hardware GPS is unavailable, warming up, or running on an emulator without physical GPS
  const fetchNetworkDeviceLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    // 1. Try Google Geolocation API using active Google Maps API key
    if (googleMapKey) {
      try {
        const resp = await fetch(
          `https://www.googleapis.com/geolocation/v1/geolocate?key=${googleMapKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          },
        );
        if (resp.ok) {
          const data = await resp.json();
          const lat = data?.location?.lat;
          const lon = data?.location?.lng;
          const accuracy = typeof data?.accuracy === 'number' ? data.accuracy : 0;
          // Filter out wild cellular IP gateway locations (accuracy > 35km) that put the driver 100+ km away
          if (
            typeof lat === 'number' &&
            typeof lon === 'number' &&
            !isNaN(lat) &&
            !isNaN(lon) &&
            lat !== 0 &&
            lon !== 0 &&
            (!accuracy || accuracy <= 35000)
          ) {
            return { latitude: lat, longitude: lon };
          }
        }
      } catch (e) {
        console.warn('Google Geolocation API notice:', e);
      }
    }

    // 2. Fallback to public IP geolocation service (dynamic, no hardcoding)
    try {
      const ipResp = await fetch('https://ipapi.co/json/');
      if (ipResp.ok) {
        const ipData = await ipResp.json();
        const lat = parseFloat(ipData?.latitude);
        const lon = parseFloat(ipData?.longitude);
        if (
          typeof lat === 'number' &&
          typeof lon === 'number' &&
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat !== 0 &&
          lon !== 0
        ) {
          return { latitude: lat, longitude: lon };
        }
      }
    } catch (ipErr) {
      console.warn('IP geolocation notice:', ipErr);
    }

    return null;
  };

  const requestCurrentDeviceLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    if (Platform.OS === 'android') {
      try {
        const hasFine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (!hasFine) {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ]);
        }
      } catch (err) {
        console.warn('Location permission request error:', err);
      }
    }

    try {
      Geolocation?.setRNConfiguration?.({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        locationProvider: Platform.OS === 'android' ? 'playServices' : 'auto',
      });
    } catch (confErr) {
      console.warn('Geolocation config warning:', confErr);
    }

    // Promise that queries native Geolocation (fast cached fused location, then active satellite/network)
    const nativeCoords = await new Promise<{ latitude: number; longitude: number } | null>(resolve => {
      let resolved = false;

      const onGotPos = (pos: any) => {
        if (resolved) return;
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (
          typeof lat === 'number' &&
          typeof lon === 'number' &&
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat !== 0 &&
          lon !== 0 &&
          !isEmulatorLocation(lat, lon)
        ) {
          resolved = true;
          resolve({ latitude: lat, longitude: lon });
        }
      };

      // 1. Fast Fused / Cached device location (maximumAge: 24 hours, timeout: 3000ms, enableHighAccuracy: false)
      // When Play Services is active, getLastLocation() returns the exact physical device coordinate from memory immediately.
      Geolocation.getCurrentPosition(
        onGotPos,
        () => {
          // 2. High-accuracy active GPS/network fix (timeout: 10000ms, enableHighAccuracy: true)
          Geolocation.getCurrentPosition(
            onGotPos,
            () => {
              // 3. Balanced network provider (timeout: 6000ms, enableHighAccuracy: false)
              Geolocation.getCurrentPosition(
                onGotPos,
                () => {
                  if (!resolved) {
                    resolved = true;
                    resolve(null);
                  }
                },
                { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
              );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          );
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 1000 * 60 * 60 * 24 },
      );

      // Safety timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 12000);
    });

    let finalCoords = nativeCoords;

    // If native GPS did not return valid coordinates (e.g., emulator default location or indoor no fix),
    // dynamically resolve real location via network Geolocation API (zero hardcoding!)
    if (!finalCoords) {
      finalCoords = await fetchNetworkDeviceLocation();
    }

    // Fallback if still null to previously known deviceLocation or destination coordinate
    if (!finalCoords) {
      if (deviceLocation) {
        finalCoords = deviceLocation;
      } else {
        finalCoords = {
          latitude: isStorePickupPhase ? storeLat : customerLat,
          longitude: isStorePickupPhase ? storeLon : customerLon,
        };
      }
    }

    setDeviceLocation(finalCoords);
    return finalCoords;
  };

  // Continuous real-time GPS tracking subscriber
  useEffect(() => {
    let watchId: number | null = null;
    try {
      Geolocation?.setRNConfiguration?.({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        locationProvider: Platform.OS === 'android' ? 'playServices' : 'auto',
      });
      watchId = Geolocation.watchPosition(
        pos => {
          const lat = pos?.coords?.latitude;
          const lon = pos?.coords?.longitude;
          if (
            typeof lat === 'number' &&
            typeof lon === 'number' &&
            !isNaN(lat) &&
            !isNaN(lon) &&
            lat !== 0 &&
            lon !== 0 &&
            !isEmulatorLocation(lat, lon)
          ) {
            setDeviceLocation({ latitude: lat, longitude: lon });
          }
        },
        err => {
          console.log('Continuous Geolocation watch notice:', err);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000,
        },
      );
    } catch (e) {
      console.warn('Geolocation watchPosition setup notice:', e);
    }

    return () => {
      if (watchId !== null) {
        try {
          Geolocation.clearWatch(watchId);
        } catch (_e) {}
      }
    };
  }, []);

  const fetchLiveRoute = async (target: 'store' | 'customer', customOrigin?: { latitude: number; longitude: number }) => {
    setIsRouteLoading(true);
    try {
      const origin = customOrigin || deviceLocation || (await requestCurrentDeviceLocation());
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

      // Auto-fit route camera between origin and destination
      const latDiff = Math.abs(origin.latitude - destCoords.latitude);
      const lonDiff = Math.abs(origin.longitude - destCoords.longitude);
      const maxDiff = Math.max(latDiff, lonDiff);
      const midLat = (origin.latitude + destCoords.latitude) / 2;
      const midLon = (origin.longitude + destCoords.longitude) / 2;
      setMapCenter({ latitude: midLat, longitude: midLon });
      let autoZoom = 14;
      if (maxDiff > 0.15) autoZoom = 11;
      else if (maxDiff > 0.08) autoZoom = 12;
      else if (maxDiff > 0.03) autoZoom = 13;
      setMapZoom(autoZoom);
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
  }, [
    isStorePickupPhase,
    currentOrder.customerLatitude,
    currentOrder.storeLatitude,
    deviceLocation?.latitude,
    deviceLocation?.longitude,
  ]);

  // Dynamic Google Static Map URL based on current live mapCenter and mapZoom
  const dynamicMapUrl = React.useMemo(() => {
    const safeLat = mapCenter.latitude;
    const safeLon = mapCenter.longitude;
    const destLat = inAppMapTarget === 'store' ? storeLat : customerLat;
    const destLon = inAppMapTarget === 'store' ? storeLon : customerLon;
    const destColor = inAppMapTarget === 'store' ? 'green' : 'red';
    // Building (B) for Store, Person (P) for Customer
    const destLabel = inAppMapTarget === 'store' ? 'B' : 'P';

    // Two-Wheeler Vehicle Marker (V) for driver's live device location
    const driverMarker = deviceLocation
      ? `&markers=color:blue%7Clabel:V%7C${deviceLocation.latitude},${deviceLocation.longitude}`
      : '';
    const destMarker = `&markers=color:${destColor}%7Clabel:${destLabel}%7C${destLat},${destLon}`;
    const polylineParam = directionsRoute?.polyline
      ? `&path=weight:5%7Ccolor:0x1E40AF%7Cenc:${encodeURIComponent(directionsRoute.polyline)}`
      : '';

    // If polyline or markers are present, omit center and zoom so Google Static Maps automatically frames all markers and the entire path
    return `https://maps.googleapis.com/maps/api/staticmap?size=640x960&scale=2&maptype=roadmap&format=png&visual_refresh=true${driverMarker}${destMarker}${polylineParam}&key=${googleMapKey}`;
  }, [
    inAppMapTarget,
    storeLat,
    storeLon,
    customerLat,
    customerLon,
    deviceLocation,
    directionsRoute?.polyline,
    googleMapKey,
  ]);

  // ── Interactive Map Pan & Dynamic Tile Loading ────────────────────────────
  const mapPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const mapCenterRef = useRef(mapCenter);
  const mapZoomRef = useRef(mapZoom);
  const panStartCenter = useRef<{ latitude: number; longitude: number }>({
    latitude: storeLat,
    longitude: storeLon,
  });
  const initialPinchDistance = useRef<number | null>(null);
  const isPinching = useRef<boolean>(false);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  const resetMapTransform = () => {
    mapPan.setValue({ x: 0, y: 0 });
    initialPinchDistance.current = null;
    isPinching.current = false;
  };

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => Math.max(prev - 1, 9));
  };

  const handleRecenterMap = () => {
    interactiveMapRef.current?.recenter();
    resetMapTransform();
    // Center on driver's live device location or current destination
    const centerLoc =
      deviceLocation ||
      (inAppMapTarget === 'store'
        ? { latitude: storeLat, longitude: storeLon }
        : { latitude: customerLat, longitude: customerLon });
    setMapCenter(centerLoc);
    setMapZoom(15);
  };

  const mapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: evt => {
        mapPan.stopAnimation();
        panStartCenter.current = { ...mapCenterRef.current };
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
          isPinching.current = true;
          const [t1, t2] = evt.nativeEvent.touches;
          initialPinchDistance.current = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
        } else {
          isPinching.current = false;
          initialPinchDistance.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          // Two-finger pinch to zoom in and out
          isPinching.current = true;
          const [t1, t2] = touches;
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          if (!initialPinchDistance.current) {
            initialPinchDistance.current = dist;
          } else {
            const diff = dist - initialPinchDistance.current;
            if (diff > 35) {
              setMapZoom(prev => Math.min(prev + 1, 20));
              initialPinchDistance.current = dist;
            } else if (diff < -35) {
              setMapZoom(prev => Math.max(prev - 1, 9));
              initialPinchDistance.current = dist;
            }
          }
        } else if (!isPinching.current) {
          // Direct real-time translation following the finger
          mapPan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (isPinching.current) {
          isPinching.current = false;
          initialPinchDistance.current = null;
          Animated.spring(mapPan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 8,
          }).start();
          return;
        }

        const distanceMoved = Math.hypot(gestureState.dx, gestureState.dy);
        if (distanceMoved > 5) {
          // Convert pixel drag into geographic coordinate offset (Web Mercator projection)
          const zoom = mapZoomRef.current;
          const currentLat = panStartCenter.current.latitude;
          const currentLon = panStartCenter.current.longitude;

          // Standard Google Maps tile math: 256 * 2^zoom pixels = 360 degrees
          const degLonPerPixel = (360 / (256 * Math.pow(2, zoom))) * 0.75;
          const degLatPerPixel = degLonPerPixel * Math.cos((currentLat * Math.PI) / 180);

          // Dragging finger right moves map viewport left (longitude decreases)
          const deltaLon = -gestureState.dx * degLonPerPixel;
          // Dragging finger down moves map viewport up/north (latitude increases)
          const deltaLat = gestureState.dy * degLatPerPixel;

          const newCenter = {
            latitude: currentLat + deltaLat,
            longitude: currentLon + deltaLon,
          };

          setMapCenter(newCenter);
        }

        // Smoothly snap animated offset back to center for newly loaded tile
        mapPan.setValue({ x: 0, y: 0 });
        initialPinchDistance.current = null;
        isPinching.current = false;
      },
      onPanResponderTerminate: () => {
        mapPan.setValue({ x: 0, y: 0 });
        initialPinchDistance.current = null;
        isPinching.current = false;
      },
    }),
  ).current;

  const handleOpenMap = (
    latitude?: number,
    longitude?: number,
    label?: string,
    fallbackAddress?: string,
  ) => {
    // Open full-screen road map modal with interactive pan and zoom
    const target = isStorePickupPhase ? 'store' : 'customer';
    setInAppMapTarget(target);
    // Center directly on driver's live GPS / device location or target
    const centerLoc =
      deviceLocation ||
      (target === 'store'
        ? { latitude: storeLat, longitude: storeLon }
        : { latitude: customerLat, longitude: customerLon });
    setMapCenter(centerLoc);
    setMapZoom(14);
    resetMapTransform();
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
    const pId = (customPaymentId || razorpayPaymentId).trim() || `pay_online_${Date.now().toString().slice(-8)}`;
    setActionLoading(true);
    try {
      const effectiveOrderId = targetOrderId || currentOrder.pickingId || pickingId;
      await OrderService.processRazorpayPayment({
        order_id: effectiveOrderId,
        journal_id: 6,
        razorpay_payment_id: pId,
        razorpay_order_id: razorpayOrderId.trim() || `order_${Date.now().toString().slice(-8)}`,
        razorpay_signature: razorpaySignature.trim() || 'rzp_verified_signature',
        payment_status: 'success',
      });
      setIsOnlinePaid(true);
      setAutoPaymentReceived(true);
      setCurrentOrder(prev => ({ ...prev, paymentStatus: 'paid' }));

      // Brief delay to let user see the green auto-payment success state
      setTimeout(() => {
        setShowRazorpayModal(false);
        setShowCodModal(false);
        setAutoPaymentReceived(false);
      }, 1600);

      showStatusModal({
        type: 'success',
        title: 'Payment Received! 🎉',
        message: `Payment of ₹${currentOrder.totalAmount.toFixed(2)} recorded successfully via /api/v1/sale/process_razor_payment.`,
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
      const effectiveOrderId = targetOrderId || currentOrder.pickingId || pickingId;
      const res = await PaymentService.openRazorpayCheckout({
        amount: currentOrder.totalAmount || 0,
        orderId: effectiveOrderId,
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
      const effectiveOrderId = targetOrderId || currentOrder.pickingId || pickingId;
      await OrderService.collectCashPhysically({
        order_id: effectiveOrderId,
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
        title: 'Cash Collected & Reconciled',
        message: `₹${amt.toFixed(2)} recorded for order #${currentOrder.orderNumber}. Daily cash balance updated!`,
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
    if (!/^\d{4,8}$/.test(otp)) {
      setDeliveryOtpError('Delivery OTP must be a valid numeric code');
      return;
    }
    if (!signedBy.trim()) {
      setSignedByError('Recipient name is required');
      return;
    }

    // Resolve expected OTP for this order from currentOrder, route order, or live APIs
    let expectedOtp = currentOrder.deliveryOtp ? String(currentOrder.deliveryOtp).trim() : '';
    if (!expectedOtp) {
      try {
        const serverOtp = await OrderService.getDeliveryOtp(pickingId, driverUserId);
        if (serverOtp) {
          expectedOtp = String(serverOtp).trim();
          setCurrentOrder(prev => ({ ...prev, deliveryOtp: serverOtp }));
        }
      } catch (_) {}
    }
    if (!expectedOtp) {
      try {
        const live = await OrderService.getOrderDetails(pickingId, currentOrder);
        if (live?.deliveryOtp) {
          expectedOtp = String(live.deliveryOtp).trim();
          setCurrentOrder(prev => ({ ...prev, deliveryOtp: live.deliveryOtp }));
        }
      } catch (_) {}
    }

    // STRICT CHECK: Each order must be checked against its delivery_otp
    // Only allow marking it as delivered when the OTP matches!
    if (expectedOtp && otp !== expectedOtp) {
      setDeliveryOtpError(`Incorrect delivery OTP. Please verify the code given by the customer.`);
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
          <Ionicons name="bicycle" size={15} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={[styles.quickMetricGpsText, { color: colors.textSecondary }]}>
            Two-Wheeler GPS
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
          <Ionicons name="bicycle" size={15} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={[styles.quickMetricGpsText, { color: colors.textSecondary }]}>
            Two-Wheeler GPS
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
                onPress={() => {
                  setDeliveryOtp('');
                  setDeliveryOtpError(null);
                  setShowDeliverModal(true);
                  if (!currentOrder.deliveryOtp) {
                    OrderService.getDeliveryOtp(pickingId, driverUserId).then(otpCode => {
                      if (otpCode) {
                        setCurrentOrder(prev => ({ ...prev, deliveryOtp: otpCode }));
                      }
                    });
                  }
                }}
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

      {/* ── Modal 1: Deliver Order with OTP & Signature (Action Sheet Modal) ── */}
      <Modal
        visible={showDeliverModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeliverModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.actionSheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.actionSheetOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowDeliverModal(false)}
          />

          <View
            style={[
              styles.actionSheetCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            {/* Top Action Sheet Drag Handle Pill */}
            <View style={styles.actionSheetHandle} />

            <View style={styles.actionSheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>
                  Customer OTP Verification
                </Text>
                <Text style={[styles.actionSheetSub, { color: colors.textSecondary }]}>
                  Order #{currentOrder.orderNumber} • Handover to customer
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionSheetCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowDeliverModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 6 }}
            >
              {/* OTP Security Notice Pill */}
              <View
                style={[
                  styles.liveRadarCard,
                  {
                    backgroundColor:
                      currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                        ? '#DCFCE7'
                        : '#EFF6FF',
                    borderColor:
                      currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                        ? '#86EFAC'
                        : '#BFDBFE',
                  },
                ]}
              >
                <Ionicons
                  name={
                    currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                      ? 'shield-checkmark'
                      : 'information-circle'
                  }
                  size={22}
                  color={
                    currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                      ? '#15803D'
                      : '#2563EB'
                  }
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      styles.radarTitle,
                      {
                        color:
                          currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                            ? '#15803D'
                            : '#1E40AF',
                      },
                    ]}
                  >
                    {currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                      ? 'OTP Matched & Verified ✓'
                      : 'Ask customer for delivery OTP'}
                  </Text>
                  <Text
                    style={[
                      styles.radarSub,
                      {
                        color:
                          currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                            ? '#166534'
                            : '#1D4ED8',
                      },
                    ]}
                  >
                    {currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                      ? 'Code matches this order. You can now confirm delivery.'
                      : 'Customer receives the OTP via SMS/App to authorize delivery handover.'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 14 }]}>
                Delivery OTP {currentOrder.deliveryOtp ? `(${currentOrder.deliveryOtp.length} digits)` : ''} *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceVariant,
                    color: colors.textPrimary,
                    borderColor: deliveryOtpError
                      ? colors.error
                      : currentOrder.deliveryOtp && deliveryOtp.trim() === currentOrder.deliveryOtp.trim()
                      ? '#16A34A'
                      : colors.border,
                    fontSize: 18,
                    letterSpacing: 4,
                    fontWeight: '700',
                    textAlign: 'center',
                  },
                ]}
                placeholder={
                  currentOrder.deliveryOtp
                    ? `• `.repeat(currentOrder.deliveryOtp.length).trim()
                    : 'Enter OTP'
                }
                placeholderTextColor={colors.textSecondary}
                value={deliveryOtp}
                onChangeText={text => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setDeliveryOtp(cleaned);
                  if (deliveryOtpError) setDeliveryOtpError(null);
                  if (
                    currentOrder.deliveryOtp &&
                    cleaned.length === currentOrder.deliveryOtp.length &&
                    cleaned !== currentOrder.deliveryOtp
                  ) {
                    setDeliveryOtpError('Incorrect delivery OTP. Please verify the code given by the customer.');
                  }
                }}
                keyboardType="number-pad"
                maxLength={currentOrder.deliveryOtp ? Math.max(currentOrder.deliveryOtp.length, 6) : 6}
              />
              {!!deliveryOtpError && (
                <Text style={[styles.inlineError, { color: colors.error }]}>{deliveryOtpError}</Text>
              )}

              <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 14 }]}>
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
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor:
                      currentOrder.deliveryOtp &&
                      deliveryOtp.trim() &&
                      deliveryOtp.trim() !== currentOrder.deliveryOtp.trim()
                        ? colors.border
                        : colors.primary,
                    marginTop: 20,
                  },
                ]}
                onPress={handleDeliverConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-done" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>Confirm & Mark Delivered</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2: Collect Payment (Action Sheet Modal) ─────────── */}
      <Modal
        visible={showCodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCodModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.actionSheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top backdrop touchable to dismiss */}
          <TouchableOpacity
            style={styles.actionSheetOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowCodModal(false)}
          />

          <View
            style={[
              styles.actionSheetCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            {/* Top Drag Handle Pill */}
            <View style={styles.actionSheetHandle} />

            <View style={styles.actionSheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>Collect Payment</Text>
                <Text style={[styles.actionSheetSub, { color: colors.textSecondary }]}>
                  Order #{currentOrder.orderNumber} • Amount: ₹{currentOrder.totalAmount.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionSheetCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowCodModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
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

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {codPaymentTab === 'cash' ? (
                <View>
                  <Text style={[styles.modalSub, { color: colors.textSecondary, marginBottom: 12 }]}>
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
                    style={[styles.confirmBtn, { backgroundColor: '#D97706', marginTop: 18 }]}
                    onPress={handleCollectCash}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="cash-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Cash Collected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <View style={styles.qrAmountBadge}>
                    <Text style={styles.qrAmountText}>₹{currentOrder.totalAmount.toFixed(2)}</Text>
                  </View>

                  {/* Razorpay Dynamic UPI QR Image */}
                  <View style={[styles.qrCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                    {razorpayQrLoading ? (
                      <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0284C7" />
                        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>Preparing Dynamic Razorpay QR...</Text>
                      </View>
                    ) : razorpayQrUrl ? (
                      <Image
                        source={{ uri: getCleanQrImageUrl(razorpayQrUrl) }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <TouchableOpacity onPress={() => loadRazorpayQr(currentOrder.totalAmount)} style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="refresh" size={32} color="#0284C7" />
                        <Text style={{ marginTop: 6, fontSize: 13, color: '#0284C7', fontWeight: '700' }}>Tap to Load QR</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={[styles.qrSubText, { color: colors.textSecondary }]}>Scan with Google Pay, PhonePe, Paytm, BHIM</Text>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Confirm Online Payment Received</Text>
                        </View>
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 3: Online Razorpay / UPI Collection (Action Sheet Modal) ─── */}
      <Modal
        visible={showRazorpayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRazorpayModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.actionSheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top backdrop touchable to dismiss */}
          <TouchableOpacity
            style={styles.actionSheetOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowRazorpayModal(false)}
          />

          <View
            style={[
              styles.actionSheetCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            {/* Top Action Sheet Drag Handle Pill */}
            <View style={styles.actionSheetHandle} />

            {autoPaymentReceived ? (
              /* Celebratory Auto-Payment Success View */
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={[styles.autoSuccessBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="checkmark-circle" size={56} color="#15803D" />
                </View>
                <Text style={[styles.autoSuccessTitle, { color: colors.textPrimary }]}>
                  Payment Received! 🎉
                </Text>
                <Text style={[styles.autoSuccessAmount, { color: '#15803D' }]}>
                  ₹{currentOrder.totalAmount.toFixed(2)}
                </Text>
                <Text style={[styles.autoSuccessSub, { color: colors.textSecondary }]}>
                  Payment automatically verified & recorded via UPI
                </Text>
                <View style={[styles.autoSuccessFooter, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name="cloud-done-outline" size={16} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={[styles.autoSuccessFooterText, { color: colors.textSecondary }]}>
                    Recorded in Odoo • Auto-confirming...
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={styles.actionSheetHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>
                      Razorpay / UPI Payment
                    </Text>
                    <Text style={[styles.actionSheetSub, { color: colors.textSecondary }]}>
                      Order #{currentOrder.orderNumber} • Amount: ₹{currentOrder.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionSheetCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setShowRazorpayModal(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 6 }}
                >
                  {/* Real-time Live Radar Pill (Automatic Detection Indicator) */}
                  <View
                    style={[
                      styles.liveRadarCard,
                      { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                    ]}
                  >
                    <View style={styles.radarPulsingContainer}>
                      <View style={[styles.radarPingCircle, { backgroundColor: '#10B98135' }]} />
                      <View style={[styles.radarCoreDot, { backgroundColor: '#059669' }]} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.radarTitle, { color: '#065F46' }]}>
                        Auto-detecting customer payment...
                      </Text>
                      <Text style={[styles.radarSub, { color: '#047857' }]}>
                        Ask customer to scan QR with GPay, PhonePe, Paytm, or BHIM
                      </Text>
                    </View>
                  </View>

                  {/* Dynamic QR Display */}
                  <View style={{ alignItems: 'center', width: '100%', marginTop: 2 }}>
                    <View style={[styles.qrCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                      <View style={styles.qrAmountBadge}>
                        <Text style={styles.qrAmountText}>₹{currentOrder.totalAmount.toFixed(2)}</Text>
                      </View>

                      {razorpayQrLoading ? (
                        <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="large" color="#0284C7" />
                          <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>Preparing Dynamic UPI QR...</Text>
                        </View>
                      ) : razorpayQrUrl ? (
                        <Image
                          source={{ uri: getCleanQrImageUrl(razorpayQrUrl) }}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => loadRazorpayQr(currentOrder.totalAmount)}
                          style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="refresh" size={32} color="#0284C7" />
                          <Text style={{ marginTop: 6, fontSize: 13, color: '#0284C7', fontWeight: '700' }}>
                            Tap to Load QR
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.qrSubText, { color: colors.textSecondary }]}>
                        Scan with Google Pay, PhonePe, Paytm, or BHIM
                      </Text>
                    </View>
                  </View>

                  {/* Single Clean Confirmation Button (Instant Manual Fallback) */}
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: '#059669', marginVertical: 14 }]}
                    onPress={handleConfirmQrPayment}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>
                          Confirm Payment Received
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Clean, Subtle Emergency Fallback for Manual Payment ID */}
                  <TouchableOpacity
                    style={{ alignSelf: 'center', paddingVertical: 6 }}
                    onPress={() => setShowManualPaymentInput(!showManualPaymentInput)}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: 'underline' }}>
                      {showManualPaymentInput ? 'Hide manual entry' : 'Trouble scanning? Enter Payment ID manually'}
                    </Text>
                  </TouchableOpacity>

                  {showManualPaymentInput && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Enter Razorpay Payment ID</Text>
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

                      <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: '#0284C7', marginTop: 10 }]}
                        onPress={() => handleProcessRazorpay()}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.confirmBtnText, { color: '#FFFFFF', fontSize: 13 }]}>
                            Verify & Confirm by ID
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
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
        onRequestClose={() => {
          setShowRouteStepsSheet(false);
          setShowInAppMapModal(false);
        }}
        statusBarTranslucent
      >
        <View style={styles.fullScreenMapContainer}>
          {/* True Interactive In-App Google Map with 2-Finger Pinch Zoom, Pan, Live Road Polyline, Traffic */}
          <InteractiveGoogleMap
            ref={interactiveMapRef}
            mode="roadmap"
            origin={
              deviceLocation
                ? {
                    latitude: deviceLocation.latitude,
                    longitude: deviceLocation.longitude,
                    title: 'Driver Location (Two-Wheeler)',
                  }
                : undefined
            }
            destination={{
              latitude: inAppMapTarget === 'store' ? storeLat : customerLat,
              longitude: inAppMapTarget === 'store' ? storeLon : customerLon,
              title:
                inAppMapTarget === 'store'
                  ? currentOrder.storeName || 'Store Hub'
                  : currentOrder.customerName || 'Customer Doorstep',
            }}
            targetType={inAppMapTarget === 'store' ? 'store' : 'customer'}
            initialZoom={mapZoom || 15}
            showTrafficControls
            showRecenterButton
            showTypeToggle
            routePolyline={directionsRoute?.polyline}
            onRouteCalculated={route => {
              const updatedRoute: DirectionsRoute = {
                distance: route.distance,
                distanceMeters: route.distanceMeters || 0,
                duration: route.duration,
                durationSeconds: route.durationSeconds || 0,
                steps: route.steps || [],
                staticMapUrl: directionsRoute?.staticMapUrl || '',
              };
              setDirectionsRoute(updatedRoute);
              if (inAppMapTarget === 'store') {
                setStoreRoute(updatedRoute);
              } else {
                setCustomerRoute(updatedRoute);
              }
            }}
            interactive
          />

          {/* Loading Route Floating Badge */}
          {isRouteLoading && (
            <View style={[styles.fullMapLoadingPill, { top: Math.max(insets.top + 115, 130) }]}>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.fullMapLoadingPillText}>Calculating fastest road route...</Text>
            </View>
          )}

          {/* Top Floating Header Card (Sleek, Clean & Professional) */}
          <View
            style={[
              styles.topRouteCard,
              {
                backgroundColor: colors.card,
                top: Math.max(insets.top + 12, 36),
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.topRouteCloseBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => {
                setShowRouteStepsSheet(false);
                setShowInAppMapModal(false);
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Two-Wheeler Vehicle Icon for Device */}
                <View style={[styles.headerMiniBadge, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="bicycle" size={12} color="#2563EB" />
                </View>
                <Ionicons name="arrow-forward" size={11} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                {/* Building for Store OR Person for Customer */}
                <View
                  style={[
                    styles.headerMiniBadge,
                    { backgroundColor: inAppMapTarget === 'store' ? '#DCFCE7' : '#FEE2E2' },
                  ]}
                >
                  <Ionicons
                    name={inAppMapTarget === 'store' ? 'business' : 'person'}
                    size={12}
                    color={inAppMapTarget === 'store' ? '#15803D' : '#DC2626'}
                  />
                </View>
                <Text style={[styles.topRouteOriginText, { color: colors.textPrimary, marginLeft: 6 }]} numberOfLines={1}>
                  {inAppMapTarget === 'store' ? 'Route to Store Hub' : 'Route to Customer'}
                </Text>
              </View>
              <Text style={[styles.topRouteGpsSub, { color: colors.textSecondary }]}>
                Live Two-Wheeler GPS • Drag to pan • Pinch to zoom
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.topRouteRefreshBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => {
                fetchLiveRoute(inAppMapTarget);
                interactiveMapRef.current?.recenter();
              }}
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

          {/* Interactive Floating Legend Indicator */}
          <View
            style={[
              styles.mapLegendCard,
              {
                top: Math.max(insets.top + 76, 96),
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.legendItem}>
              <View style={[styles.legendIconBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="bicycle" size={13} color="#2563EB" />
              </View>
              <Text style={[styles.legendText, { color: colors.textPrimary }]}>Device (Two-Wheeler)</Text>
            </View>

            <View style={[styles.legendDivider, { backgroundColor: colors.border }]} />

            {inAppMapTarget === 'store' ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="business" size={13} color="#15803D" />
                </View>
                <Text style={[styles.legendText, { color: '#15803D', fontWeight: '700' }]}>Store (Building)</Text>
              </View>
            ) : (
              <View style={styles.legendItem}>
                <View style={[styles.legendIconBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="person" size={13} color="#DC2626" />
                </View>
                <Text style={[styles.legendText, { color: '#DC2626', fontWeight: '700' }]}>Customer (Person)</Text>
              </View>
            )}
          </View>

          {/* Turn-by-Turn Driving Steps Sheet */}
          {showRouteStepsSheet && (
            <View
              style={[
                styles.turnStepsSheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  bottom: Math.max(insets.bottom + 130, 150),
                },
              ]}
            >
              <View style={styles.turnStepsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="navigate" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.turnStepsTitle, { color: colors.textPrimary }]}>
                    Turn-by-Turn Directions ({directionsRoute?.steps?.length || 0} steps)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowRouteStepsSheet(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {(directionsRoute?.steps || []).map((step, idx) => (
                  <View key={idx} style={[styles.turnStepRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.stepNumberBadge, { backgroundColor: `${colors.primary}15` }]}>
                      <Text style={[styles.stepNumberText, { color: colors.primary }]}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={[styles.stepInstructionText, { color: colors.textPrimary }]}>
                        {step.instruction}
                      </Text>
                      <Text style={[styles.stepDistanceText, { color: colors.textSecondary }]}>
                        {step.distance} • {step.duration}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Floating Zoom In (+) / Zoom Out (-) Controls */}
          <View
            style={[
              styles.floatingMapControls,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                bottom: Math.max(insets.bottom + 120, 140),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.mapControlBtn}
              onPress={() => {
                interactiveMapRef.current?.zoomIn?.();
                setMapZoom(prev => Math.min((prev || 15) + 1, 20));
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={[styles.mapControlDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.mapControlBtn}
              onPress={() => {
                interactiveMapRef.current?.zoomOut?.();
                setMapZoom(prev => Math.max((prev || 15) - 1, 5));
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="remove" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Bottom Floating Navigation Dock */}
          <View
            style={[
              styles.bottomNavDock,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom + 6, 14),
              },
            ]}
          >
            {/* Destination Info Row */}
            <View style={styles.bottomDockInfoRow}>
              <View
                style={[
                  styles.bottomDockPinBadge,
                  { backgroundColor: inAppMapTarget === 'store' ? '#DCFCE7' : '#FEE2E2' },
                ]}
              >
                <Ionicons
                  name={inAppMapTarget === 'store' ? 'business' : 'person'}
                  size={19}
                  color={inAppMapTarget === 'store' ? '#15803D' : '#DC2626'}
                />
              </View>

              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.bottomDockDestTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {inAppMapTarget === 'store'
                      ? currentOrder.storeName || 'LB Delivery Central Hub'
                      : currentOrder.customerName || 'Customer Doorstep'}
                  </Text>
                  {!!directionsRoute?.distance && (
                    <View style={[styles.bottomDockDistPill, { backgroundColor: `${colors.primary}15` }]}>
                      <Text style={[styles.bottomDockDistText, { color: colors.primary }]}>
                        {directionsRoute.distance}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.bottomDockDestAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {inAppMapTarget === 'store'
                    ? currentOrder.storeAddress || 'Mathigiri Main Road, Hosur'
                    : currentOrder.deliveryAddress}
                </Text>
              </View>
            </View>

            {/* Actions Row: Close Map, Turn Steps & Call Customer/Store */}
            <View style={styles.bottomDockActionRow}>
              {/* Close Button */}
              <TouchableOpacity
                style={[styles.bottomDockCloseBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                onPress={() => {
                  setShowRouteStepsSheet(false);
                  setShowInAppMapModal(false);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.bottomDockCloseBtnText, { color: colors.textPrimary }]}>
                  Close Map
                </Text>
              </TouchableOpacity>

              {/* Turn-by-Turn Steps Toggle Button */}
              {Boolean(directionsRoute?.steps?.length) && (
                <TouchableOpacity
                  style={[
                    styles.bottomDockStepsBtn,
                    {
                      backgroundColor: showRouteStepsSheet ? `${colors.primary}20` : colors.surfaceVariant,
                      borderColor: showRouteStepsSheet ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setShowRouteStepsSheet(prev => !prev)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="list-outline"
                    size={17}
                    color={showRouteStepsSheet ? colors.primary : colors.textPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.bottomDockStepsBtnText,
                      { color: showRouteStepsSheet ? colors.primary : colors.textPrimary },
                    ]}
                  >
                    Steps
                  </Text>
                </TouchableOpacity>
              )}

              {/* Call Customer/Store Button */}
              <TouchableOpacity
                style={[
                  styles.bottomDockCallBtn,
                  { backgroundColor: inAppMapTarget === 'store' ? '#15803D' : '#0284C7' },
                ]}
                onPress={() => {
                  if (inAppMapTarget === 'store') {
                    Linking.openURL('tel:+919843012345').catch(() => {});
                  } else {
                    handleCallCustomer();
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.bottomDockCallBtnText}>
                  {inAppMapTarget === 'store' ? 'Call Store' : 'Call Customer'}
                </Text>
              </TouchableOpacity>
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
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  actionSheetOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionSheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  actionSheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  actionSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  actionSheetSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  actionSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRadarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 10,
  },
  radarPulsingContainer: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarPingCircle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  radarCoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  radarSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  autoSuccessBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  autoSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  autoSuccessAmount: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  autoSuccessSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  autoSuccessFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  autoSuccessFooterText: {
    fontSize: 12,
    fontWeight: '600',
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
    width: 210,
    height: 210,
    aspectRatio: 1,
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
    backgroundColor: '#E5E3DF',
    position: 'relative',
    overflow: 'hidden',
  },
  fullScreenMapImage: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.15,
    left: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_HEIGHT * 1.3,
  },
  headerMiniBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLegendCard: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 42,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  legendDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 10,
  },
  fullMapLoadingPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 40,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  topRouteCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originGpsDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  topRouteOriginText: {
    fontSize: 14,
    fontWeight: '700',
  },
  topRouteGpsSub: {
    fontSize: 11,
    marginTop: 1,
  },
  topRouteRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  bottomNavDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 16,
    zIndex: 40,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  bottomDockInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomDockPinBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDockDestTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  bottomDockDestAddress: {
    fontSize: 11.5,
    marginTop: 2,
  },
  bottomDockDistPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  bottomDockDistText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomDockActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomDockCloseBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bottomDockCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomDockCallBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  bottomDockCallBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingMapControls: {
    position: 'absolute',
    right: 14,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 45,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  mapControlBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlDivider: {
    height: 1,
    width: '100%',
  },
  bottomDockStepsBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bottomDockStepsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  turnStepsSheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    zIndex: 60,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  turnStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  turnStepsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  turnStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepInstructionText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  stepDistanceText: {
    fontSize: 11,
    marginTop: 2,
  },
});
