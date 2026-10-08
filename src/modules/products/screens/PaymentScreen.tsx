import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, useStatusModal } from '../../../components';
import { API_SETTINGS } from '../../../app/config';
import { storage } from '../../../storage/AsyncStorage';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useAddress, CustomerService } from '../../profile';
import { useCart } from '../context/CartContext';
import { CartService } from '../services/cartService';
import { PaymentService } from '../services/paymentService';
import { Order } from '../../orders/types';

export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'cod';

interface PaymentScreenProps {
  orderId?: number | string;
  totalAmount: number;
  subtotal: number;
  shippingFee?: number;
  carrierId?: number;
  discount?: number;
  couponCode?: string;
  onBack: () => void;
  onOrderSuccess: (order: Order) => void;
  onNavigateToShop: () => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  orderId: propOrderId,
  totalAmount,
  subtotal,
  shippingFee = 0,
  carrierId,
  discount = 0,
  couponCode,
  onBack,
  onOrderSuccess,
  onNavigateToShop,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedAddress } = useAddress();
  const { clearCart, items, cartOrderId } = useCart();
  const { showStatusModal } = useStatusModal();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('upi');
  const [processing, setProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | number>('');
  const [confirmedOrderName, setConfirmedOrderName] = useState<string>('');
  const [confirmedPaymentRef, setConfirmedPaymentRef] = useState<string>('');
  const [deliveryOrder, setDeliveryOrder] = useState<{ id: number; name: string; state: string } | null>(null);
  const [confirmedOrderState, setConfirmedOrderState] = useState<Order | null>(null);

  const paymentOptions: {
    id: PaymentMethodType;
    title: string;
    subtitle: string;
    icon: string;
    badge?: string;
  }[] = [
      {
        id: 'upi',
        title: 'UPI & Instant Pay',
        subtitle: 'Google Pay, PhonePe, Paytm, BHIM',
        icon: 'flash-outline',
        badge: 'Recommended',
      },
      // {
      //   id: 'card',
      //   title: 'Credit / Debit Card',
      //   subtitle: 'Visa, MasterCard, Rupay',
      //   icon: 'card-outline',
      // },
      // {
      //   id: 'netbanking',
      //   title: 'Net Banking',
      //   subtitle: 'All Major Indian Banks',
      //   icon: 'business-outline',
      // },
      {
        id: 'cod',
        title: 'Cash on Delivery (COD)',
        subtitle: 'Pay cash or UPI at delivery doorstep',
        icon: 'cash-outline',
      },
    ];

  const isSubmittingRef = useRef<boolean>(false);

  const handlePayAndConfirmOrder = async () => {
    // Concurrency guard against rapid double-taps
    if (isSubmittingRef.current || processing) {
      return;
    }

    if (!items || items.length === 0) {
      showStatusModal({
        type: 'warning',
        title: 'Cart is Empty',
        message: 'Please add items before confirming your order.',
      });
      return;
    }

    if (!selectedAddress) {
      showStatusModal({
        type: 'warning',
        title: 'Delivery Address Required',
        message: 'Please provide or select a confirmed delivery address before making payment.',
        confirmText: 'Select Address',
        cancelText: 'Cancel',
        onConfirm: onBack,
      });
      return;
    }

    isSubmittingRef.current = true;
    setProcessing(true);

    const partnerId = Number(user?.partnerId || user?.id || 2);
    const shippingId = selectedAddress?.id ? Number(selectedAddress.id) : undefined;
    let orderId: number | string | null = propOrderId ? Number(propOrderId) : (cartOrderId ? Number(cartOrderId) : null);
    if (!orderId && partnerId) {
      try {
        const storedUserKey = await storage.getString(`@lb_delivery_cart_order_id_${partnerId}`);
        if (storedUserKey && !isNaN(Number(storedUserKey))) {
          orderId = Number(storedUserKey);
        }
      } catch (_) {}
    }
    if (!orderId) {
      try {
        const storedId = await storage.getString('@lb_delivery_cart_order_id');
        if (storedId && !isNaN(Number(storedId))) {
          orderId = Number(storedId);
        }
      } catch (_) {}
    }
    if (!orderId && partnerId) {
      try {
        const cartsRes = await CartService.fetchAllCarts(partnerId);
        const draftCarts = Array.isArray(cartsRes?.result) ? cartsRes.result : [];
        if (draftCarts.length > 0 && draftCarts[0]?.id) {
          orderId = Number(draftCarts[0].id);
        }
      } catch (_) {}
    }

    try {
      // 1. Check if existing cart order is a valid draft order with matching lines on Odoo
      let validExistingOrder = false;
      if (orderId && typeof orderId === 'number' && !isNaN(orderId)) {
        try {
          const detailRes = await CartService.fetchCartDetails(orderId);
          const activeOrder = Array.isArray(detailRes?.result) ? detailRes.result[0] : null;
          if (
            activeOrder &&
            activeOrder.state === 'draft' &&
            Array.isArray(activeOrder.order_line) &&
            activeOrder.order_line.length > 0 &&
            activeOrder.order_line.length === items.length
          ) {
            // Verify that draft order lines match current cart items
            try {
              const linesRes = await CartService.getOrderLines(activeOrder.order_line);
              const rawLines = Array.isArray(linesRes?.result) ? linesRes.result : [];
              const resolvedCart = await CartService.resolveVariantIds(
                items.map(it => ({
                  productId: Number(it.product.id),
                  templateId: it.product.templateId ? Number(it.product.templateId) : undefined,
                  name: it.product.name,
                  quantity: it.quantity,
                  priceUnit: it.product.price,
                })),
              );
              const cartProductMap = new Map(resolvedCart.map(it => [it.productId, it.quantity]));
              const allMatch =
                rawLines.length === resolvedCart.length &&
                rawLines.every((l: any) => {
                  const pId = Array.isArray(l.product_id) ? l.product_id[0] : l.product_id;
                  return cartProductMap.get(Number(pId)) === Number(l.product_uom_qty);
                });

              if (allMatch) {
                validExistingOrder = true;
                try {
                  await CartService.updateSaleOrderShipping(
                    orderId,
                    shippingId,
                    carrierId,
                    selectedMethod === 'cod' ? 'COD' : 'UPI',
                  );
                  if (carrierId) {
                    try {
                      await CartService.calculateShipping(orderId, carrierId);
                    } catch (carrierErr) {
                      console.warn('Odoo calculateShipping note:', carrierErr);
                    }
                  }
                } catch (updateErr) {
                  console.warn('Odoo updateSaleOrderShipping note:', updateErr);
                }
              }
            } catch (vLineErr) {
              console.warn('Draft order line verification note:', vLineErr);
            }
          }
        } catch (chkErr) {
          console.warn('Odoo cart verification note:', chkErr);
        }
      }

      // If no valid draft order with matching lines exists, clean up old draft and create a fresh Sale Order
      if (!validExistingOrder) {
        if (orderId && typeof orderId === 'number') {
          try {
            await CartService.clearCart(orderId);
          } catch (_) {}
        }

        const orderPayload = {
          partnerId,
          partnerShippingId: shippingId,
          partnerInvoiceId: shippingId,
          carrierId,
          clientOrderRef: selectedMethod === 'cod' ? 'COD' : 'UPI',
          items: items.map(item => ({
            productId: Number(item.product.id) || 1,
            templateId: item.product.templateId ? Number(item.product.templateId) : undefined,
            name: item.product.name,
            quantity: item.quantity,
            priceUnit: item.product.price,
          })),
        };

        const saleRes = await CartService.createSaleOrder(orderPayload);
        if (saleRes?.result && typeof saleRes.result === 'number') {
          orderId = Number(saleRes.result);
          if (carrierId) {
            try {
              await CartService.calculateShipping(orderId, carrierId);
            } catch (carrierErr) {
              console.warn('Odoo calculateShipping note:', carrierErr);
            }
          }
        } else {
          const errMsg =
            saleRes?.error?.data?.message ||
            saleRes?.error?.message ||
            'Unable to create order on the server. Please check your connection and try again.';
          throw new Error(errMsg);
        }
      }

      if (!orderId || typeof orderId !== 'number' || isNaN(orderId)) {
        throw new Error('Valid order ID could not be established on the server.');
      }

      // Select and verify delivery address on sale order (Postman: /api/delivery/address/select_and_verify)
      if (shippingId && !isNaN(Number(shippingId))) {
        try {
          await CustomerService.selectAndVerifyDeliveryAddress(orderId, shippingId);
        } catch (selErr) {
          console.warn('CustomerService.selectAndVerifyDeliveryAddress note:', selErr);
        }
      }

      // Validate minimum order requirement against Odoo backend API (Postman: /api/delivery/order/validate_minimum)
      try {
        const minValRes = await CartService.validateMinimumOrder(orderId);
        if (minValRes.valid === false) {
          isSubmittingRef.current = false;
          setProcessing(false);
          const serverMin = minValRes.minAmount;
          showStatusModal({
            type: 'warning',
            title: serverMin ? `Minimum Order ₹${serverMin} Required` : 'Minimum Order Amount Required',
            message:
              minValRes.message ||
              (serverMin
                ? `Your order subtotal of ₹${subtotal} is below the minimum order amount of ₹${serverMin}. Please add more items to proceed.`
                : 'Your order subtotal does not meet the minimum order requirement.'),
            confirmText: 'Shop More',
            cancelText: 'Cancel',
            onConfirm: onNavigateToShop,
          });
          return;
        }
      } catch (valErr) {
        console.warn('Backend validateMinimumOrder note:', valErr);
      }

      // 2. Razorpay & Online Payment Integration (Bypassed completely for COD)r COD)
      let razorpayPaymentId: string | null = null;
      let razorpayOrderId: string | null = null;
      let razorpaySignature: string | null = null;
      if (selectedMethod !== 'cod') {
        try {
          // Open Razorpay Checkout for UPI / Card / Netbanking (Postman: "Razor pay")
          const razorpayRes = await PaymentService.openRazorpayCheckout({
            amount: totalAmount,
            orderId,
            name: user?.name || selectedAddress?.name || 'Customer',
            email: user?.email || '',
            contact: user?.phone || selectedAddress?.phone || '',
            description: `Order #${orderId} - Groceries & Essentials`,
            method: selectedMethod,
            key: API_SETTINGS.razorPay.key,
            secret: API_SETTINGS.razorPay.secret,
          });

          if (razorpayRes?.razorpay_payment_id) {
            razorpayPaymentId = razorpayRes.razorpay_payment_id;
            razorpayOrderId = razorpayRes.razorpay_order_id || null;
            razorpaySignature = razorpayRes.razorpay_signature || null;
            setConfirmedPaymentRef(razorpayPaymentId);

            // Deep payment verification: Query Razorpay server to confirm payment is captured/authorized
            const verification = await PaymentService.verifyRazorpayPayment(
              razorpayPaymentId,
              API_SETTINGS.razorPay.key,
              API_SETTINGS.razorPay.secret,
            );

            if (!verification.success) {
              setProcessing(false);
              showStatusModal({
                type: 'error',
                title: 'Payment Incomplete',
                message:
                  verification.error ||
                  'The transaction was not completed or captured by the bank. Order was not placed.',
                confirmText: 'Try Again',
                cancelText: 'Cancel',
                onConfirm: () => handlePayAndConfirmOrder(),
              });
              return;
            }
          } else {
            // No payment ID received from gateway - do NOT place order
            setProcessing(false);
            showStatusModal({
              type: 'error',
              title: 'Payment Required',
              message:
                'Online transaction was not completed. Please complete payment or select Cash on Delivery.',
              confirmText: 'Try Again',
              cancelText: 'Cancel',
              onConfirm: () => handlePayAndConfirmOrder(),
            });
            return;
          }
        } catch (rpErr: any) {
          console.warn('Razorpay checkout error caught:', rpErr);

          // Deep inspection of Razorpay error payload across all SDK shapes
          let parsedErrorObj: any = null;
          let rawErrorStr = '';

          try {
            if (typeof rpErr === 'string') {
              rawErrorStr = rpErr;
              if (rpErr.trim().startsWith('{')) {
                parsedErrorObj = JSON.parse(rpErr);
              }
            } else if (rpErr && typeof rpErr === 'object') {
              rawErrorStr = JSON.stringify(rpErr);
              if (typeof rpErr.description === 'string' && rpErr.description.trim().startsWith('{')) {
                try {
                  parsedErrorObj = JSON.parse(rpErr.description);
                } catch (_) {}
              }
              if (!parsedErrorObj && rpErr.error && typeof rpErr.error === 'object') {
                parsedErrorObj = rpErr.error;
              } else if (!parsedErrorObj && typeof rpErr.error === 'string' && rpErr.error.trim().startsWith('{')) {
                try {
                  parsedErrorObj = JSON.parse(rpErr.error);
                } catch (_) {}
              }
            }
          } catch (_) {}

          const lowerRaw = (rawErrorStr + ' ' + (rpErr?.description || '') + ' ' + (rpErr?.message || '')).toLowerCase();
          const errSource = String(parsedErrorObj?.error?.source || parsedErrorObj?.source || rpErr?.source || '');
          const errStep = String(parsedErrorObj?.error?.step || parsedErrorObj?.step || rpErr?.step || '');
          const errReason = String(parsedErrorObj?.error?.reason || parsedErrorObj?.reason || rpErr?.reason || '');
          const errCode = parsedErrorObj?.error?.code || parsedErrorObj?.code || rpErr?.code;

          // Detect user cancellation / abort:
          // 1. Explicit cancellation code or description
          // 2. Razorpay source="customer" (e.g. user dismissed or backed out during payment authentication)
          // 3. Step="payment_authentication" with customer abort
          const isUserCancelled =
            rpErr?.code === 0 ||
            errCode === 0 ||
            lowerRaw.includes('cancel') ||
            lowerRaw.includes('dismiss') ||
            lowerRaw.includes('back press') ||
            lowerRaw.includes('user_cancelled') ||
            lowerRaw.includes('payment cancelled') ||
            errSource.toLowerCase() === 'customer' ||
            (errStep === 'payment_authentication' && (errReason === 'payment_error' || errSource.toLowerCase() === 'customer')) ||
            (lowerRaw.includes('"source":"customer"') && lowerRaw.includes('payment_authentication'));

          setProcessing(false);

          if (isUserCancelled) {
            showStatusModal({
              type: 'info',
              title: 'Payment Cancelled',
              message:
                'You have cancelled the UPI payment. Your order has not been placed yet. You can retry paying via UPI or choose Cash on Delivery (COD) to complete your order.',
              confirmText: 'Retry Payment',
              cancelText: 'Cancel',
              onConfirm: () => handlePayAndConfirmOrder(),
            });
            return;
          }

          // If not user-cancelled, provide a clean human-readable message without exposing raw JSON
          let userFriendlyMessage = 'Payment could not be completed. Please check your connection or select Cash on Delivery.';
          const innerDesc = parsedErrorObj?.error?.description || parsedErrorObj?.description || rpErr?.description;
          if (innerDesc && typeof innerDesc === 'string' && !innerDesc.trim().startsWith('{')) {
            userFriendlyMessage = innerDesc;
          } else if (rpErr?.message && typeof rpErr.message === 'string' && !rpErr.message.trim().startsWith('{')) {
            userFriendlyMessage = rpErr.message;
          }

          showStatusModal({
            type: 'error',
            title: 'Payment Notice',
            message: userFriendlyMessage,
            confirmText: 'Retry Payment',
            cancelText: 'Cancel',
            onConfirm: () => handlePayAndConfirmOrder(),
          });
          return;
        }

        // 3. Register Payment in Odoo (account.payment create & action_post)
        try {
          const memo = razorpayPaymentId
            ? `UPI: ${razorpayPaymentId} | SO: ${orderId}${razorpayOrderId ? ` | RZP: ${razorpayOrderId}` : ''}`
            : `Order: ${orderId}`;

          const payRes = await PaymentService.createPayment({
            partnerId,
            amount: totalAmount,
            journalId: 6, // Bank Journal for online/UPI payments
            paymentMethodLineId: 1,
            memo,
          });

          if (payRes?.result) {
            // 4. Confirm / Post Payment (Postman: "POST Verify Payment (Post/Confirm)")
            await PaymentService.verifyPayment(payRes.result);

            // Fetch payment details verification (Postman: "GET Payment Details")
            try {
              await PaymentService.getPaymentDetails(payRes.result);
            } catch (dErr) {
              console.warn('Odoo getPaymentDetails note:', dErr);
            }
          }
        } catch (payErr) {
          console.warn('Odoo createPayment/verifyPayment note:', payErr);
        }

        // 4B. Record Payment Transaction in Odoo (payment.transaction create)
        try {
          if (razorpayPaymentId) {
            await PaymentService.recordPaymentTransaction({
              orderId,
              partnerId,
              amount: totalAmount,
              providerReference: razorpayPaymentId,
              reference: `SO-${orderId}-UPI-${razorpayPaymentId}`,
            });
          }
        } catch (txErr) {
          console.warn('Odoo recordPaymentTransaction note:', txErr);
        }

        // 4C. Confirm Razorpay Payment to Odoo custom controller
        // Sends { order_id, journal_id: 6, razorpay_payment_id, razorpay_order_id,
        //         razorpay_signature, payment_status: "success" } to the server.
        // Server creates/finds invoice, registers payment, marks it paid.
        // already_processed = true means the order was already paid — treated as success.
        try {
          if (razorpayPaymentId) {
            const confirmResult = await PaymentService.confirmRazorpayPaymentToOdoo({
              orderId,
              razorpayPaymentId,
              razorpayOrderId: razorpayOrderId || null,
              razorpaySignature: razorpaySignature || null,
            });
            if (__DEV__ && confirmResult) {
              console.log(
                '[PaymentScreen] Odoo confirm result:',
                confirmResult.status,
                '| invoice:', confirmResult.invoice_number,
                '| payment_state:', confirmResult.payment_state,
                confirmResult.already_processed ? '(already processed)' : '',
              );
            }
          }
        } catch (confirmErr) {
          console.warn('Odoo confirmRazorpayPaymentToOdoo note:', confirmErr);
        }

        // 4D. Update Sale Order Reference with verified UPI Payment ID
        try {
          if (razorpayPaymentId) {
            await CartService.updateSaleOrderRef(orderId, `UPI: ${razorpayPaymentId}`);
          }
        } catch (refErr) {
          console.warn('Odoo updateSaleOrderRef note:', refErr);
        }
      }

      // Assign shipping carrier if selected (Postman: "POST Calculate Shipping")
      if (carrierId && orderId && typeof orderId === 'number') {
        try {
          await CartService.calculateShipping(orderId, carrierId);
        } catch (cErr) {
          console.warn('Carrier assign note:', cErr);
        }
      }

      // 5. Confirm Sale Order in Odoo (action_confirm) & Create Delivery Order (stock.picking)
      if (orderId && typeof orderId === 'number') {
        try {
          await CartService.confirmSaleOrder(orderId);
          console.log(`[Odoo] Sale Order ${orderId} confirmed.`);
        } catch (confirmErr: any) {
          const msg = confirmErr?.message || '';
          // If already confirmed, action_confirm in Odoo raises UserError: "Some orders are not in a state requiring confirmation."
          if (!msg.toLowerCase().includes('not in a state requiring confirmation')) {
            console.warn('Odoo confirmSaleOrder note:', confirmErr);
            throw new Error(msg || 'Order could not be confirmed on the server. Please retry.');
          }
        }

        // Fetch official order name (e.g. S00068)
        try {
          const summaryRes = await CartService.getCheckoutSummary(orderId);
          const soSummary = Array.isArray(summaryRes?.result) ? summaryRes.result[0] : null;
          if (soSummary?.name) {
            setConfirmedOrderName(soSummary.name);
          }
        } catch (nameErr) {
          console.warn('Order name fetch note:', nameErr);
        }

        // Query created delivery order from stock.picking (Postman: "Get Delivery details")
        try {
          const pickRes = await CartService.getDeliveryDetails(orderId);
          const pickings = Array.isArray(pickRes?.result) ? pickRes.result : [];
          if (pickings.length > 0) {
            setDeliveryOrder(pickings[0]);
            console.log(`[Odoo] Delivery Order created:`, pickings[0]);
          }
        } catch (pickErr) {
          console.warn('Odoo getDeliveryDetails note:', pickErr);
        }
      } else {
        throw new Error('Valid order reference could not be confirmed.');
      }

      // 6. Clear Cart and Show Success (preserve placed order so it is not deleted in Odoo)
      await clearCart({ preserveServerOrder: true });
      setConfirmedOrderId(orderId);

      const confirmedOrderObj: Order = {
        id: String(orderId),
        orderNumber: confirmedOrderName ? `#${confirmedOrderName}` : `#LB-${orderId}`,
        date: 'Today',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'confirmed',
        items: items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          price: item.product.price,
        })),
        itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
        totalAmount,
        savings: discount || 0,
        paymentMode: selectedMethod === 'cod' ? 'Cash on Delivery' : 'Paid online',
        deliveryAddress: selectedAddress
          ? [selectedAddress.flatNo, selectedAddress.streetArea, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', ')
          : 'Doorstep Delivery',
        eta: '15 mins',
        deliveryFee: shippingFee || 0,
      };
      setConfirmedOrderState(confirmedOrderObj);
      setIsSuccess(true);

      // Automatically navigate to OrderDetailsScreen after 1.5s celebration
      setTimeout(() => {
        onOrderSuccess(confirmedOrderObj);
      }, 1500);
    } catch (error: any) {
      console.error('Payment checkout error:', error);
      const errorMessage =
        error?.description ||
        error?.message ||
        'We encountered an issue finalizing payment. Would you like to retry?';

      showStatusModal({
        type: 'error',
        title: 'Transaction Notice',
        message: errorMessage,
        confirmText: 'Retry Payment',
        cancelText: 'Cancel',
        onConfirm: async () => {
          // Trigger Odoo Retry Payment (Postman: "POST Retry Payment")
          try {
            await PaymentService.retryPayment({
              orderId: typeof orderId === 'number' ? orderId : 1,
              partnerId,
              amount: totalAmount,
              reference: `SO-${orderId}-RETRY-${Date.now()}`,
            });
          } catch (retryErr) {
            console.warn('Odoo retryPayment note:', retryErr);
          }
          handlePayAndConfirmOrder();
        },
      });
    } finally {
      setProcessing(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 2000);
    }
  };

  // ── Success Celebration View ──────────────────────────────────────────────
  if (isSuccess) {
    const isCod = selectedMethod === 'cod';

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.successContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Green checkmark hero */}
          <View style={[styles.successIconCircle, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
          </View>

          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            Order Confirmed! 🎉
          </Text>
          <Text style={[styles.successGreeting, { color: colors.textSecondary }]}>
            Thank you, {user?.name || 'Valued Customer'}
          </Text>

          {/* Order number badge */}
          <View style={[styles.orderNumberBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="receipt-outline" size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={[styles.orderNumberText, { color: colors.primary }]}>
              ORDER #{confirmedOrderName || confirmedOrderId}
            </Text>
          </View>

          {/* Payment info card */}
          <View
            style={[
              styles.successInfoCard,
              {
                backgroundColor: isCod
                  ? (isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4')
                  : (isDark ? 'rgba(2,132,199,0.12)' : '#F0F9FF'),
                borderColor: isCod ? '#16A34A' : '#0284C7',
              },
            ]}
          >
            <Ionicons
              name={isCod ? 'cash-outline' : 'shield-checkmark-outline'}
              size={22}
              color={isCod ? '#16A34A' : '#0284C7'}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.successInfoTitle, { color: isCod ? '#16A34A' : '#0284C7' }]}>
                {isCod ? 'Cash on Delivery' : 'Payment Verified ✓'}
              </Text>
              <Text style={[styles.successInfoSub, { color: colors.textSecondary }]}>
                {isCod
                  ? `₹${totalAmount} to be collected at your doorstep`
                  : `₹${totalAmount} paid via Razorpay UPI`}
              </Text>
              {confirmedPaymentRef ? (
                <Text style={[styles.successPayRef, { color: colors.textTertiary }]}>
                  Txn: {confirmedPaymentRef}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Delivery order card */}
          {deliveryOrder && (
            <View
              style={[
                styles.successInfoCard,
                {
                  backgroundColor: isDark ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
                  borderColor: '#D97706',
                },
              ]}
            >
              <Ionicons name="cube-outline" size={22} color="#D97706" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.successInfoTitle, { color: '#D97706' }]}>
                  Delivery Order Created
                </Text>
                <Text style={[styles.successInfoSub, { color: colors.textSecondary }]}>
                  {deliveryOrder.name} • Hub is packing your order
                </Text>
                <Text style={[styles.successPayRef, { color: colors.textTertiary }]}>
                  Status: {deliveryOrder.state?.toUpperCase() ?? 'PROCESSING'}
                </Text>
              </View>
            </View>
          )}

          {/* Delivery ETA strip */}
          <View
            style={[
              styles.successEtaStrip,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="bicycle-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.successEtaText, { color: colors.textSecondary }]}>
              Fresh items will be delivered to your doorstep in{' '}
              <Text style={{ fontWeight: '800', color: colors.textPrimary }}>~15 minutes</Text>
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.successActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (confirmedOrderState) {
                  onOrderSuccess(confirmedOrderState);
                }
              }}
              style={[styles.viewOrdersBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            >
              <Ionicons name="receipt-outline" size={16} color={colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.viewOrdersBtnText, { color: colors.onPrimary }]}>
                View Order Details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onNavigateToShop}
              style={[styles.continueShoppingBtn, { borderColor: colors.border, borderRadius: borderRadius.md }]}
            >
              <Text style={[styles.continueShoppingText, { color: colors.textPrimary }]}>
                Continue Shopping
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Payment Method" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Confirmed Delivery Address Card */}
        <View
          style={[
            styles.addressCard,
            {
              backgroundColor: colors.card,
              borderColor: selectedAddress ? colors.border : colors.error,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.addressCardHeader}>
            <View style={styles.addressCardTitleRow}>
              <View
                style={[
                  styles.addressIconBox,
                  { backgroundColor: selectedAddress ? `${colors.primary}15` : `${colors.error}15` },
                ]}
              >
                <Ionicons
                  name="location"
                  size={18}
                  color={selectedAddress ? colors.primary : colors.error}
                />
              </View>
              <Text style={[styles.addressCardTitle, { color: colors.textPrimary }]}>
                Delivery Address
              </Text>
              {selectedAddress && (
                <View style={[styles.confirmedPill, { backgroundColor: `${colors.primary}12` }]}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.primary} style={{ marginRight: 3 }} />
                  <Text style={[styles.confirmedPillText, { color: colors.primary }]}>CONFIRMED</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              style={styles.changeAddressBtn}
            >
              <Text style={[styles.changeAddressText, { color: colors.primary }]}>
                CHANGE
              </Text>
            </TouchableOpacity>
          </View>

          {selectedAddress ? (
            <View style={styles.addressBody}>
              <View style={styles.addressBadgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                    {selectedAddress.type?.toUpperCase() || 'DELIVERY'}
                  </Text>
                </View>
                <Text style={[styles.recipientName, { color: colors.textPrimary }]}>
                  {selectedAddress.name}
                </Text>
              </View>
              <Text style={[styles.addressFullText, { color: colors.textSecondary }]}>
                {selectedAddress.flatNo ? `${selectedAddress.flatNo}, ` : ''}
                {selectedAddress.streetArea}, {selectedAddress.city} - {selectedAddress.pincode}
              </Text>
              {selectedAddress.phone && (
                <Text style={[styles.addressPhoneText, { color: colors.textSecondary }]}>
                  📞 {selectedAddress.phone}
                </Text>
              )}

              {/* 15 Mins Delivery ETA Pill */}
              <View
                style={[
                  styles.deliveryEtaPill,
                  { backgroundColor: `${colors.secondary}12`, borderColor: `${colors.secondary}30` },
                ]}
              >
                <Ionicons name="flash" size={13} color={colors.secondary} style={{ marginRight: 5 }} />
                <Text style={[styles.deliveryEtaText, { color: colors.secondary }]}>
                  15-Min Doorstep Express Delivery
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.noAddressWarningBox, { borderColor: colors.error }]}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={20} color={colors.error} />
              <Text style={[styles.noAddressWarningText, { color: colors.error }]}>
                No delivery address selected. Tap to select address.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Total Summary Strip */}
        <View
          style={[
            styles.totalStrip,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View>
            <Text style={[styles.stripLabel, { color: colors.textSecondary }]}>
              Amount Payable
            </Text>
            <Text style={[styles.stripAmount, { color: colors.primary }]}>
              ₹{totalAmount}
            </Text>
          </View>
          <View style={[styles.secureBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name="shield-checkmark" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.secureText, { color: colors.primary }]}>256-Bit Encrypted</Text>
          </View>
        </View>

        {/* Coupon Savings Callout */}
        {discount > 0 && (
          <View
            style={[
              styles.couponSavingsStrip,
              {
                backgroundColor: `${colors.secondary}15`,
                borderColor: colors.secondary,
              },
            ]}
          >
            <Ionicons name="pricetag" size={15} color={colors.secondary} style={{ marginRight: 6 }} />
            <Text style={[styles.couponSavingsText, { color: colors.secondary }]}>
              Coupon Savings of ₹{discount} applied{couponCode ? ` (${couponCode})` : ''}
            </Text>
          </View>
        )}

        {/* Payment Methods Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          SELECT PAYMENT OPTION
        </Text>

        <View style={styles.optionsList}>
          {paymentOptions.map(opt => {
            const isSelected = selectedMethod === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setSelectedMethod(opt.id)}
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: borderRadius.lg,
                    shadowColor: isSelected ? colors.primary : '#000',
                  },
                ]}
              >
                <View
                  style={[
                    styles.methodIconBox,
                    {
                      backgroundColor: isSelected ? `${colors.primary}18` : colors.surfaceVariant,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={isSelected ? colors.primary : colors.textPrimary}
                  />
                </View>

                <View style={styles.methodInfo}>
                  <View style={styles.titleWithBadge}>
                    <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>
                      {opt.title}
                    </Text>
                    {opt.badge && (
                      <View style={[styles.optBadge, { backgroundColor: `${colors.secondary}20` }]}>
                        <Text style={[styles.optBadgeText, { color: colors.secondary }]}>
                          {opt.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.methodSubtitle, { color: colors.textSecondary }]}>
                    {opt.subtitle}
                  </Text>
                </View>

                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Guarantee Banner */}
        <View
          style={[
            styles.trustCard,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons name="lock-closed" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.trustCardText, { color: colors.textSecondary }]}>
            Safe and seamless checkout powered by Razorpay 256-Bit Encryption and Odoo Accounting.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        <View>
          <Text style={[styles.bottomLabel, { color: colors.textSecondary }]}>TOTAL PAYABLE</Text>
          <Text style={[styles.bottomAmount, { color: colors.textPrimary }]}>₹{totalAmount}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePayAndConfirmOrder}
          disabled={processing}
          style={[
            styles.payBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.md,
              opacity: processing ? 0.7 : 1,
            },
          ]}
        >
          {processing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.payBtnText, { color: colors.onPrimary }]}>
              {selectedMethod === 'cod' ? 'CONFIRM ORDER' : `PAY ₹${totalAmount}`} ›
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  totalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  stripAmount: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
    marginLeft: 4,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  methodInfo: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  optBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  methodSubtitle: {
    fontSize: 11.5,
    marginTop: 3,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  trustCardText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  payBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 40,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  successGreeting: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 16,
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    width: '100%',
  },
  successInfoTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  successInfoSub: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  successPayRef: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
  },
  successEtaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    width: '100%',
  },
  successEtaText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  deliveryPickingTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  deliveryPickingSub: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  couponSavingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  couponSavingsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  successSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  viewOrdersBtn: {
    width: '100%',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  viewOrdersBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  continueShoppingBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  continueShoppingText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressCard: {
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addressCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addressCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  confirmedPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  changeAddressBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeAddressText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addressBody: {
    marginTop: 2,
  },
  addressBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  recipientName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  addressFullText: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  addressPhoneText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  deliveryEtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  deliveryEtaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noAddressWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 4,
  },
  noAddressWarningText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
});
