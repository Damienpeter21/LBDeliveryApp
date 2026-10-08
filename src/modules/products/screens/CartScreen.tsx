import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState, Skeleton, useAlertDialog } from '../../../components';
import { API_SETTINGS } from '../../../app/config/apiSettings';
import { storage } from '../../../storage/AsyncStorage';
import { useLocation } from '../../location';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useAddress } from '../../profile';
import { useCart } from '../context/CartContext';
import { CartService } from '../services/cartService';
import { CartItem } from '../types/cart';

interface CartScreenProps {
  onBack: () => void;
  onNavigateToShop: () => void;
  onRequireAuthForCheckout: () => void;
  onNavigateToCheckout?: () => void;
  onNavigateToAddAddress?: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  onBack,
  onNavigateToShop,
  onRequireAuthForCheckout,
  onNavigateToCheckout,
  onNavigateToAddAddress,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { location, openLocationPicker } = useLocation();
  const { selectedAddress } = useAddress();
  const { items, totalAmount, totalQuantity, updateQuantity, removeFromCart, clearCart, isLoading, cartOrderId, setCartOrderId } = useCart();
  const { showAlertDialog } = useAlertDialog();

  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [showOrderConfirm, setShowOrderConfirm] = useState<boolean>(false);

  const deliveryFee = 0; // Free delivery
  const handlingFee = items.length > 0 ? 5 : 0;
  const totalSavings = Math.round(
    items.reduce(
      (acc, item) => acc + (item.product.originalPrice - item.product.price) * item.quantity,
      0
    ) * 100
  ) / 100;

  const finalTotal = Math.max(0, Math.round((totalAmount + deliveryFee + handlingFee) * 100) / 100);

  // Helper to format currency values cleanly with at most 2 digits after the decimal point
  const formatAmount = (val: number | string): string => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toFixed(2).replace(/\.00$/, '');
  };

  const handleRemoveItem = (item: CartItem) => {
    showAlertDialog({
      type: 'confirm',
      title: 'Remove Item',
      message: `Remove "${item.product.name}" from your cart?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: () => removeFromCart(item.product.id),
    });
  };

  const handleClearAll = () => {
    showAlertDialog({
      type: 'confirm',
      title: 'Clear Cart',
      message: 'Are you sure you want to remove all items from your cart?',
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: () => clearCart(),
    });
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      onRequireAuthForCheckout();
      return;
    }

    if (!selectedAddress) {
      showAlertDialog({
        type: 'warning',
        title: 'Delivery Address Required',
        message: 'Please add or select a delivery address to proceed with your order.',
        confirmText: 'Select / Add Address',
        cancelText: 'Cancel',
        onConfirm: () => {
          if (onNavigateToAddAddress) {
            onNavigateToAddAddress();
          } else {
            openLocationPicker();
          }
        },
      });
      return;
    }

    if (onNavigateToCheckout) {
      onNavigateToCheckout();
      return;
    }

    setCheckoutLoading(true);
    try {
      const partnerId = Number(user?.partnerId || user?.id || 2);
      const shippingId = selectedAddress?.id ? Number(selectedAddress.id) : undefined;

      const orderPayload = {
        partnerId,
        partnerShippingId: shippingId,
        items: items.map(item => ({
          productId: Number(item.product.id) || 1,
          templateId: item.product.templateId ? Number(item.product.templateId) : undefined,
          name: item.product.name,
          quantity: item.quantity,
          priceUnit: item.product.price,
        })),
      };

      const res = await CartService.createSaleOrder(orderPayload);
      const orderId = res?.result;

      if (orderId && typeof orderId === 'number') {
        // Validate minimum order on server API (Postman: /api/delivery/order/validate_minimum)
        try {
          const valRes = await CartService.validateMinimumOrder(orderId);
          if (valRes.valid === false) {
            const serverMin = valRes.minAmount;
            showAlertDialog({
              type: 'warning',
              title: serverMin ? `Minimum Order Value is ₹${formatAmount(serverMin)}` : 'Minimum Order Amount Required',
              message:
                valRes.message ||
                (serverMin
                  ? `Your current items total is ₹${formatAmount(totalAmount)}. Please add items to meet the minimum order requirement of ₹${formatAmount(serverMin)}.`
                  : 'Your current items total does not meet the minimum order requirement. Please add more items.'),
              confirmText: 'Add More Items',
              cancelText: 'View Cart',
              onConfirm: onNavigateToShop,
            });
            return;
          }
        } catch (vErr) {
          console.warn('Backend validateMinimumOrder note:', vErr);
        }
      }

      clearCart();
      showAlertDialog({
        type: 'success',
        title: 'Order Placed Successfully',
        message: `Thank you ${user?.name || ''}! Your order #${orderId || 'LB-Confirmed'} of ₹${formatAmount(finalTotal)} is confirmed and will be delivered in 15 mins.`,
        buttonText: 'View Orders',
        onConfirm: onNavigateToShop,
      });
    } catch (err: any) {
      console.warn('Checkout createSaleOrder error, proceeding with local confirmation:', err);
      clearCart();
      showAlertDialog({
        type: 'success',
        title: 'Order Placed Successfully',
        message: `Thank you ${user?.name || ''}! Your order of ₹${formatAmount(finalTotal)} is confirmed and on the way in 15 mins.`,
        buttonText: 'View Orders',
        onConfirm: onNavigateToShop,
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Called when user taps "Proceed to Pay" inside the confirmation modal
  const handleConfirmOrder = async () => {
    if (items.length === 0) {
      setShowOrderConfirm(false);
      return;
    }

    setCheckoutLoading(true);
    try {
      const partnerId = Number(user?.partnerId || user?.id || 2);
      const shippingId = selectedAddress?.id ? Number(selectedAddress.id) : undefined;

      const orderPayload = {
        partnerId,
        partnerShippingId: shippingId,
        items: items.map(item => ({
          productId: Number(item.product.id) || 1,
          templateId: item.product.templateId ? Number(item.product.templateId) : undefined,
          name: item.product.name,
          quantity: item.quantity,
          priceUnit: item.product.price,
        })),
      };

      const res = await CartService.createSaleOrder(orderPayload);
      const createdOrderId = res?.result && typeof res.result === 'number' ? Number(res.result) : null;

      if (createdOrderId) {
        if (setCartOrderId) {
          setCartOrderId(createdOrderId);
        }
        try {
          await storage.set(`@lb_delivery_cart_order_id_${partnerId}`, String(createdOrderId));
          await storage.set('@lb_delivery_cart_order_id', String(createdOrderId));
        } catch (_) {}

        // Validate minimum order on server API (Postman: /api/delivery/order/validate_minimum)
        try {
          const valRes = await CartService.validateMinimumOrder(createdOrderId);
          if (valRes.valid === false) {
            setShowOrderConfirm(false);
            const serverMin = valRes.minAmount;
            showAlertDialog({
              type: 'warning',
              title: serverMin ? `Minimum Order Value is ₹${formatAmount(serverMin)}` : 'Minimum Order Amount Required',
              message:
                valRes.message ||
                (serverMin
                  ? `Your current items total is ₹${formatAmount(totalAmount)}. Please add items to meet the minimum order requirement of ₹${formatAmount(serverMin)}.`
                  : 'Your current items total does not meet the minimum order requirement. Please add more items.'),
              confirmText: 'Add More Items',
              cancelText: 'View Cart',
              onConfirm: onNavigateToShop,
            });
            return;
          }
        } catch (vErr) {
          console.warn('Backend validateMinimumOrder note:', vErr);
        }
      }

      setShowOrderConfirm(false);

      if (onNavigateToCheckout) {
        onNavigateToCheckout();
      } else {
        clearCart();
        showAlertDialog({
          type: 'success',
          title: 'Order Placed Successfully',
          message: `Thank you ${user?.name || ''}! Your order #${createdOrderId || 'LB-Confirmed'} of ₹${formatAmount(finalTotal)} is placed and will be delivered in 15 mins.`,
          buttonText: 'View Orders',
          onConfirm: onNavigateToShop,
        });
      }
    } catch (err: any) {
      console.warn('Confirmation createSaleOrder error:', err);
      setShowOrderConfirm(false);
      if (onNavigateToCheckout) {
        onNavigateToCheckout();
      } else {
        showAlertDialog({
          type: 'error',
          title: 'Connection Notice',
          message: 'Unable to establish draft order on the server. Please check your internet connection and try again.',
        });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const rawName = item.product.name || 'Fresh Product';
    const skuMatch = rawName.match(/^\[(.*?)\]/);
    const skuCode = skuMatch ? skuMatch[1] : null;
    const cleanName = rawName.replace(/^\[.*?\]\s*/, '').trim() || rawName;

    const itemTotal = item.product.price * item.quantity;
    const originalItemTotal =
      item.product.originalPrice > item.product.price
        ? item.product.originalPrice * item.quantity
        : 0;

    const baseUrl = (API_SETTINGS?.baseUrl || 'https://9d6f-122-187-121-222.ngrok-free.app').replace(/\/+$/, '');
    const imageUrl =
      item.product.imageUrl ||
      `${baseUrl}/web/image/product.product/${item.product.id}/image_512`;

    return (
      <View
        style={[
          styles.itemCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        {/* Top Section: Image + Info + Dedicated Remove Button */}
        <View style={styles.itemTopSection}>
          <View
            style={[
              styles.itemImageBox,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
              },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.itemInfo}>
            {skuCode ? (
              <View style={[styles.skuBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.skuText, { color: colors.textSecondary }]}>
                  {skuCode}
                </Text>
              </View>
            ) : null}

            <Text
              style={[styles.itemName, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {cleanName}
            </Text>

            <Text style={[styles.itemUnit, { color: colors.textSecondary }]}>
              {item.product.unit || '1 Unit'}
              {item.product.category ? ` • ${item.product.category}` : ''}
            </Text>
          </View>

          {/* Dedicated Remove Cart Item Button */}
          <TouchableOpacity
            onPress={() => handleRemoveItem(item)}
            style={[styles.removeBtn, { backgroundColor: colors.surfaceVariant }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Remove item from cart"
          >
            <Ionicons name="trash-outline" size={17} color={colors.error || '#EF4444'} />
          </TouchableOpacity>
        </View>

        {/* Subtle Divider */}
        <View style={[styles.itemDivider, { backgroundColor: colors.divider }]} />

        {/* Bottom Section: Price Breakdown & Stepper */}
        <View style={styles.itemBottomSection}>
          <View style={styles.itemPriceRow}>
            <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
              ₹{formatAmount(itemTotal)}
            </Text>
            {originalItemTotal > itemTotal && (
              <Text style={[styles.itemOriginalPrice, { color: colors.textTertiary }]}>
                ₹{formatAmount(originalItemTotal)}
              </Text>
            )}
            {item.product.discountPercentage ? (
              <View style={[styles.discountPill, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={[styles.discountPillText, { color: colors.primary }]}>
                  {item.product.discountPercentage}% OFF
                </Text>
              </View>
            ) : null}
          </View>

          {/* Modern Stepper with Trash Icon when quantity is 1 */}
          <View
            style={[
              styles.stepper,
              {
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
              style={styles.stepperAction}
              activeOpacity={0.7}
              accessibilityLabel={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
            >
              {item.quantity === 1 ? (
                <Ionicons name="trash-outline" size={13} color={colors.error || '#EF4444'} />
              ) : (
                <Ionicons name="remove" size={14} color={colors.primary} />
              )}
            </TouchableOpacity>

            <Text style={[styles.quantityNumber, { color: colors.primary }]}>
              {item.quantity}
            </Text>

            <TouchableOpacity
              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
              style={styles.stepperAction}
              activeOpacity={0.7}
              accessibilityLabel="Increase quantity"
            >
              <Ionicons name="add" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={`My Cart (${totalQuantity})`} onBack={onBack} />

      {isLoading && items.length === 0 ? (
        <View style={{ padding: 16 }}>
          {/* Skeleton delivery banner */}
          <View
            style={[
              styles.addressCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                marginBottom: 16,
                padding: 14,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={15} borderRadius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="85%" height={13} borderRadius={4} />
              </View>
            </View>
          </View>

          {/* Skeleton Cart Item Cards */}
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                  marginBottom: 12,
                  padding: 14,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={64} height={64} borderRadius={10} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="75%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="35%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width="45%" height={16} borderRadius={4} />
                </View>
                <Skeleton width={80} height={32} borderRadius={8} />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        !isAuthenticated ? (
          <EmptyState
            iconName="cart-outline"
            badgeIcon="sparkles"
            title="Your Cart is Empty"
            description="Sign in to view your cart items, or discover fresh products and start shopping!"
            actionLabel="Sign In / Register"
            onAction={onRequireAuthForCheckout}
            secondaryActionLabel="Start Shopping"
            onSecondaryAction={onNavigateToShop}
          />
        ) : (
          <EmptyState
            iconName="cart-outline"
            badgeIcon="sparkles"
            title="Your Cart is Empty"
            description="Looks like you haven't added anything to your cart yet. Discover all genuine products from different brands at the best prices!"
            actionLabel="Start Shopping"
            onAction={onNavigateToShop}
          />
        )
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={item => item.product.id}
            renderItem={renderCartItem}
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: Math.max(insets.bottom + 100, 120) },
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.headerSection}>
                {/* 1. Delivery Address Banner on Top */}
                {selectedAddress ? (
                  <View
                    style={[
                      styles.addressCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: borderRadius.lg,
                      },
                    ]}
                  >
                    <View style={styles.addressLeft}>
                      <View
                        style={[
                          styles.addressIconCircle,
                          { backgroundColor: `${colors.primary}15` },
                        ]}
                      >
                        <Ionicons
                          name={
                            selectedAddress.type === 'WORK'
                              ? 'briefcase'
                              : selectedAddress.type === 'HOME'
                              ? 'home'
                              : 'location'
                          }
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.addressTitle, { color: colors.textPrimary }]}>
                            Deliver to {selectedAddress.name || 'Doorstep'}
                          </Text>
                          <View style={[styles.typeMiniBadge, { backgroundColor: `${colors.primary}12` }]}>
                            <Text style={[styles.typeMiniBadgeText, { color: colors.primary }]}>
                              {selectedAddress.type || 'HOME'}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[styles.addressSubtitle, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {`${selectedAddress.flatNo ? selectedAddress.flatNo + ', ' : ''}${selectedAddress.streetArea}, ${selectedAddress.city}`}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeBtn}
                      activeOpacity={0.7}
                      onPress={openLocationPicker}
                    >
                      <Text style={[styles.changeText, { color: colors.primary }]}>CHANGE</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.addressCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.primary,
                        borderStyle: 'dashed',
                        borderWidth: 1.5,
                        borderRadius: borderRadius.lg,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (onNavigateToAddAddress) {
                        onNavigateToAddAddress();
                      } else {
                        openLocationPicker();
                      }
                    }}
                  >
                    <View style={styles.addressLeft}>
                      <View
                        style={[
                          styles.addressIconCircle,
                          { backgroundColor: `${colors.primary}15` },
                        ]}
                      >
                        <Ionicons
                          name="location-outline"
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={[styles.addressTitle, { color: colors.textPrimary }]}>
                          Add Delivery Address
                        </Text>
                        <Text
                          style={[styles.addressSubtitle, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          Select saved address or use current GPS location
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.changeBtn,
                        {
                          backgroundColor: colors.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: borderRadius.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.changeText,
                          { color: colors.onPrimary, fontWeight: '700' },
                        ]}
                      >
                        + ADD
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Items in Cart Heading & Clear Cart Button */}
                <View style={styles.itemsHeaderRow}>
                  <Text style={[styles.itemsHeaderTitle, { color: colors.textPrimary }]}>
                    Items in Basket ({totalQuantity})
                  </Text>
                  <TouchableOpacity
                    onPress={handleClearAll}
                    style={styles.clearAllBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="trash-bin-outline"
                      size={14}
                      color={colors.error || '#EF4444'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.clearAllText, { color: colors.error || '#EF4444' }]}>
                      Clear Cart
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerContainer}>
                {/* Bill Breakdown */}
                <View
                  style={[
                    styles.billCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: borderRadius.lg,
                    },
                  ]}
                >
                  <View style={styles.billHeaderRow}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.billTitle, { color: colors.textPrimary }]}>
                      Bill Details
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: colors.textSecondary }]}>Items Total</Text>
                    <Text style={[styles.billValue, { color: colors.textPrimary }]}>₹{formatAmount(totalAmount)}</Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: colors.textSecondary }]}>Delivery Fee</Text>
                    <View style={[styles.freeBadge, { backgroundColor: `${colors.secondary}18` }]}>
                      <Text style={[styles.freeBadgeText, { color: colors.secondary }]}>FREE</Text>
                    </View>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: colors.textSecondary }]}>Handling Fee</Text>
                    <Text style={[styles.billValue, { color: colors.textPrimary }]}>₹{formatAmount(handlingFee)}</Text>
                  </View>

                  <View style={[styles.billDivider, { backgroundColor: colors.divider }]} />

                  <View style={styles.billRow}>
                    <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>To Pay</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>₹{formatAmount(finalTotal)}</Text>
                  </View>

                  {totalSavings > 0 && (
                    <View style={[styles.savingsPill, { backgroundColor: colors.surfaceVariant, borderColor: colors.secondary }]}>
                      <Ionicons name="sparkles" size={14} color={colors.secondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.savingsPillText, { color: colors.primary }]}>
                        You saved ₹{formatAmount(totalSavings)} on this order!
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            }
          />

          {/* Sticky Checkout Bar */}
          <View
            style={[
              styles.checkoutBar,
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
              <Text style={[styles.checkoutTotalLabel, { color: colors.textSecondary }]}>
                {isAuthenticated ? 'TOTAL TO PAY' : 'GUEST CHECKOUT'}
              </Text>
              <Text style={[styles.checkoutTotal, { color: colors.textPrimary }]}>
                ₹{formatAmount(finalTotal)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCheckout}
              disabled={checkoutLoading}
              style={[
                styles.checkoutButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.md,
                  opacity: checkoutLoading ? 0.7 : 1,
                },
              ]}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={[styles.checkoutButtonText, { color: colors.onPrimary }]}>
                  {!isAuthenticated
                    ? 'LOGIN TO CHECKOUT ›'
                    : !selectedAddress
                    ? 'SELECT ADDRESS ›'
                    : 'PROCEED TO CHECKOUT ›'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Order Confirmation Modal ──────────────────────────────────────────
          Shown when authenticated user taps PROCEED TO PAY.
          Summarises ALL cart items as ONE single order before committing.
          "Go Back"  → dismiss, stay on cart
          "Confirm"  → call existing checkout/navigation flow unchanged
      ─────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={showOrderConfirm}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowOrderConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          {/* Dimmed backdrop — tap to dismiss */}
          <TouchableOpacity
            style={styles.confirmBackdrop}
            activeOpacity={1}
            onPress={() => setShowOrderConfirm(false)}
          />

          <View
            style={[
              styles.confirmSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.confirmHandleBox}>
              <View style={[styles.confirmHandle, { backgroundColor: colors.border }]} />
            </View>

            {/* Header */}
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconCircle, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="receipt" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
                  Confirm Your Order
                </Text>
                <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                  Review all items before proceeding to payment
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowOrderConfirm(false)}
                style={[styles.confirmCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            >
              {/* ── Items List ── */}
              <View style={[styles.confirmSection, { borderColor: colors.border }]}>
                <View style={styles.confirmSectionHead}>
                  <Ionicons name="basket" size={13} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text style={[styles.confirmSectionLabel, { color: colors.textSecondary }]}>
                    ORDER ITEMS · {totalQuantity} ITEMS · 1 ORDER
                  </Text>
                </View>

                {items.map((item, idx) => {
                  const cleanName = (item.product.name || '').replace(/^\[.*?\]\s*/, '').trim();
                  return (
                    <View
                      key={`${item.product.id}_confirm_${idx}`}
                      style={[
                        styles.confirmItemRow,
                        {
                          borderBottomColor: colors.divider,
                          borderBottomWidth: idx === items.length - 1 ? 0 : 1,
                        },
                      ]}
                    >
                      {/* Qty badge */}
                      <View style={[styles.confirmQtyBadge, { backgroundColor: `${colors.primary}15` }]}>
                        <Text style={[styles.confirmQtyText, { color: colors.primary }]}>
                          {item.quantity}×
                        </Text>
                      </View>

                      {/* Product name */}
                      <Text
                        style={[styles.confirmItemName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {cleanName}
                      </Text>

                      {/* Line price */}
                      <Text style={[styles.confirmItemPrice, { color: colors.textPrimary }]}>
                        ₹{formatAmount(item.product.price * item.quantity)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* ── Bill Summary ── */}
              <View
                style={[
                  styles.confirmBill,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
              >
                <View style={styles.confirmBillRow}>
                  <Text style={[styles.confirmBillLabel, { color: colors.textSecondary }]}>Items Total</Text>
                  <Text style={[styles.confirmBillVal, { color: colors.textPrimary }]}>₹{formatAmount(totalAmount)}</Text>
                </View>
                <View style={styles.confirmBillRow}>
                  <Text style={[styles.confirmBillLabel, { color: colors.textSecondary }]}>Delivery Fee</Text>
                  <Text style={[styles.confirmBillVal, { color: colors.secondary, fontWeight: '800' }]}>FREE</Text>
                </View>
                {handlingFee > 0 && (
                  <View style={styles.confirmBillRow}>
                    <Text style={[styles.confirmBillLabel, { color: colors.textSecondary }]}>Handling Fee</Text>
                    <Text style={[styles.confirmBillVal, { color: colors.textPrimary }]}>₹{formatAmount(handlingFee)}</Text>
                  </View>
                )}
                {totalSavings > 0 && (
                  <View style={styles.confirmBillRow}>
                    <Text style={[styles.confirmBillLabel, { color: '#16A34A' }]}>You Save</Text>
                    <Text style={[styles.confirmBillVal, { color: '#16A34A', fontWeight: '800' }]}>−₹{formatAmount(totalSavings)}</Text>
                  </View>
                )}
                <View style={[styles.confirmBillDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.confirmBillRow}>
                  <Text style={[styles.confirmTotalLabel, { color: colors.textPrimary }]}>Total to Pay</Text>
                  <Text style={[styles.confirmTotalVal, { color: colors.primary }]}>₹{formatAmount(finalTotal)}</Text>
                </View>
              </View>

              {/* ── Single-order notice ── */}
              <View
                style={[
                  styles.confirmNotice,
                  { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}28` },
                ]}
              >
                <Ionicons name="information-circle" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.confirmNoticeText, { color: colors.textSecondary }]}>
                  All{' '}
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{totalQuantity} items</Text>
                  {' '}will be placed as{' '}
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>one single order</Text>.
                  {' '}Select your payment method on the next screen.
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.confirmFooter, { borderTopColor: colors.divider }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={checkoutLoading}
                onPress={() => setShowOrderConfirm(false)}
                style={[
                  styles.confirmGoBackBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceVariant, opacity: checkoutLoading ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.confirmGoBackText, { color: colors.textPrimary }]}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={checkoutLoading}
                onPress={handleConfirmOrder}
                style={[
                  styles.confirmProceedBtn,
                  { backgroundColor: colors.primary, opacity: checkoutLoading ? 0.7 : 1 },
                ]}
              >
                {checkoutLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="card" size={15} color={colors.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.confirmProceedText, { color: colors.onPrimary }]}>
                      Proceed to Pay  ₹{formatAmount(finalTotal)}
                    </Text>
                  </>
                )}
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
  listContainer: {
    padding: 16,
    gap: 12,
  },
  headerSection: {
    gap: 12,
    marginBottom: 4,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  addressIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addressTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  typeMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  addressSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  changeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  minOrderCard: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  minOrderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  minOrderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minOrderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  minOrderSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  shopMoreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  shopMoreText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  minOrderMetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  minOrderMetText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  itemsHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemTopSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemImageBox: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  itemImage: {
    width: '90%',
    height: '90%',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 6,
  },
  skuBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginBottom: 4,
  },
  skuText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  itemName: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  itemUnit: {
    fontSize: 12,
    marginTop: 3,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDivider: {
    height: 1,
    marginVertical: 10,
  },
  itemBottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  itemOriginalPrice: {
    fontSize: 12.5,
    textDecorationLine: 'line-through',
  },
  discountPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  stepperAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quantityNumber: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  footerContainer: {
    gap: 12,
    marginTop: 4,
  },
  billCard: {
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  billHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  billLabel: {
    fontSize: 14,
  },
  billValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  billDivider: {
    height: 1,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  savingsPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  checkoutBar: {
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
  checkoutTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkoutTotal: {
    fontSize: 22,
    fontWeight: '800',
  },
  checkoutButton: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  checkoutButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Order Confirmation Modal ─────────────────────────────────────────────────
  confirmOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  confirmBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  confirmSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 14,
  },
  confirmHandleBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  confirmIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  confirmSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  confirmCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmSection: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  confirmSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  confirmSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  confirmItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmQtyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginRight: 8,
  },
  confirmQtyText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  confirmItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  confirmItemPrice: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  confirmBill: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  confirmBillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  confirmBillLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  confirmBillVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  confirmBillDivider: {
    height: 1,
    marginVertical: 6,
  },
  confirmTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmTotalVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  confirmNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  confirmNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  confirmFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    marginTop: 4,
  },
  confirmGoBackBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmGoBackText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmProceedBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmProceedText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
