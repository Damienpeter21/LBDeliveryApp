import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, useStatusModal } from '../../../components';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
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
  const [isOnlinePaid, setIsOnlinePaid] = useState<boolean>(
    !currentOrder.isCod || currentOrder.paymentStatus === 'paid',
  );

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
  const orderId = Number(currentOrder.id) || pickingId;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCallCustomer = () => {
    const phone = currentOrder.customerPhone || '+919843012345';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Phone Call', `Dial customer at: ${phone}`);
    });
  };

  const handleOpenMap = (latitude?: number, longitude?: number, label?: string) => {
    const lat = latitude ?? 12.5683;
    const lon = longitude ?? 77.8284;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(label || 'Delivery Location')}@${lat},${lon}`,
      android: `geo:0,0?q=${lat},${lon}(${encodeURIComponent(label || 'Delivery Location')})`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
      });
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
      const res = await OrderService.checkPaymentStatus(orderId);
      const data = res?.result !== undefined ? res.result : res;
      const statusText = data?.payment_status || data?.status || 'pending';
      const msg =
        data?.message ||
        `Current payment status for order #${currentOrder.orderNumber}: ${statusText.toUpperCase()}`;

      if (statusText === 'paid' || statusText === 'success') {
        setIsOnlinePaid(true);
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

  const handleProcessRazorpay = async () => {
    setRazorpayError(null);
    const pId = razorpayPaymentId.trim();
    if (!pId) {
      setRazorpayError('Razorpay Payment ID is required (e.g. pay_...)');
      return;
    }
    setActionLoading(true);
    try {
      await OrderService.processRazorpayPayment({
        order_id: orderId,
        journal_id: 6,
        razorpay_payment_id: pId,
        razorpay_order_id: razorpayOrderId.trim() || `order_${Date.now().toString().slice(-8)}`,
        razorpay_signature: razorpaySignature.trim() || 'rzp_verified_signature',
        payment_status: 'success',
      });
      setIsOnlinePaid(true);
      setShowRazorpayModal(false);
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
        order_id: orderId,
        driver_user_id: driverUserId,
        amount_collected: amt,
        journal_id: 7,
        payment_reference: paymentRef,
      });
      setIsCashCollected(true);
      setShowCodModal(false);
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

    setActionLoading(true);
    try {
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

        {/* Customer Information Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Details</Text>
          </View>

          <View style={styles.customerDetailRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.customerNameBig, { color: colors.textPrimary }]}>
                {currentOrder.customerName || 'Customer'}
              </Text>
              <Text style={[styles.customerPhoneBig, { color: colors.textSecondary }]}>
                {currentOrder.customerPhone || 'Phone unavailable'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.primary }]}
              onPress={handleCallCustomer}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.callBtnText, { color: colors.primary }]}>Call</Text>
            </TouchableOpacity>
          </View>

          {/* Delivery Address */}
          <View style={[styles.addressBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>DELIVERY ADDRESS</Text>
              <Text style={[styles.addressValue, { color: colors.textPrimary }]}>
                {currentOrder.deliveryAddress}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.mapBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleOpenMap(currentOrder.customerLatitude, currentOrder.customerLongitude, 'Customer Location')}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate" size={16} color={colors.onPrimary} style={{ marginRight: 4 }} />
              <Text style={[styles.mapBtnText, { color: colors.onPrimary }]}>Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Store Pickup Location Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Store Hub Location</Text>
          </View>

          <View style={styles.storeDetailRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.storeName, { color: colors.textPrimary }]}>
                {currentOrder.storeName || 'LB Delivery Store'}
              </Text>
              <Text style={[styles.storeAddress, { color: colors.textSecondary }]}>
                {currentOrder.storeAddress || 'Mathigiri Main Road, Hosur'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.mapBtnSecondary, { borderColor: colors.primary }]}
              onPress={() => handleOpenMap(currentOrder.storeLatitude, currentOrder.storeLongitude, 'Store Hub')}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.mapBtnTextSecondary, { color: colors.primary }]}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

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
              ₹{currentOrder.totalAmount.toFixed(2)}
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
                      isOnlinePaid || currentOrder.paymentStatus === 'paid' || isCashCollected
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
                        isOnlinePaid || currentOrder.paymentStatus === 'paid' || isCashCollected
                          ? '#15803D'
                          : '#B45309',
                    },
                  ]}
                >
                  {isOnlinePaid || currentOrder.paymentStatus === 'paid'
                    ? 'PAID (ONLINE)'
                    : isCashCollected
                    ? 'PAID (CASH)'
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

      {/* ── Modal 2: Collect COD Cash ──────────────────────────────────── */}
      <Modal visible={showCodModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Collect COD Cash</Text>
              <TouchableOpacity onPress={() => setShowCodModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 3: Online Razorpay / UPI Collection ─────────────────── */}
      <Modal visible={showRazorpayModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record Online Payment</Text>
              <TouchableOpacity onPress={() => setShowRazorpayModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Record Razorpay / UPI payment verification for order #{currentOrder.orderNumber} (₹{currentOrder.totalAmount.toFixed(2)}).
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Razorpay Payment ID *</Text>
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

            <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 12 }]}>Razorpay Order ID</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g. order_9A33XWu170gUtm"
              placeholderTextColor={colors.textSecondary}
              value={razorpayOrderId}
              onChangeText={setRazorpayOrderId}
              autoCapitalize="none"
              maxLength={50}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: '#0284C7', marginTop: 20 }]}
              onPress={handleProcessRazorpay}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Verify & Record Online Payment</Text>
              )}
            </TouchableOpacity>
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
});
