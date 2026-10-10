import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';
import { Order } from '../types';

interface OrderCardProps {
  order: Order;
  onTrackOrder: (order: Order) => void;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onTrackOrder,
  onAccept,
  onReject,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const getStatusConfig = () => {
    switch (order.status) {
      case 'unassigned':
        return {
          label: 'Ready for Pickup',
          icon: 'flash',
          bg: isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3',
          color: '#B45309',
          border: isDark ? 'rgba(234, 179, 8, 0.3)' : '#FDE047',
        };
      case 'assigned':
        return {
          label: 'Order Accepted',
          icon: 'checkmark-circle',
          bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
          color: '#0284C7',
          border: isDark ? 'rgba(2, 132, 199, 0.3)' : '#BAE6FD',
        };
      case 'arrived_store':
        return {
          label: 'At Store',
          icon: 'business',
          bg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F3E8FF',
          color: '#9333EA',
          border: isDark ? 'rgba(147, 51, 234, 0.3)' : '#E9D5FF',
        };
      case 'picked_up':
      case 'in_transit':
        return {
          label: 'Out for Delivery',
          icon: 'bicycle',
          bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
          color: '#0284C7',
          border: isDark ? 'rgba(2, 132, 199, 0.3)' : '#BAE6FD',
        };
      case 'arrived_customer':
        return {
          label: 'At Doorstep',
          icon: 'navigate',
          bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5',
          color: '#059669',
          border: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          icon: 'checkmark-done-circle',
          bg: isDark ? 'rgba(22, 163, 74, 0.15)' : '#DCFCE7',
          color: '#16A34A',
          border: isDark ? 'rgba(22, 163, 74, 0.3)' : '#BBF7D0',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: 'close-circle',
          bg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
          color: '#DC2626',
          border: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
        };
      default:
        return {
          label: 'In Progress',
          icon: 'cube',
          bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7',
          color: '#16A34A',
          border: isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const primaryItem = order.items[0];
  const primaryItemName = primaryItem?.product?.name || primaryItem?.productName || 'Delivery Package';
  const cleanOrderNumber = order.orderNumber.replace(/^#+/, '');
  const isAvailable = order.status === 'unassigned' || Boolean(onAccept);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onTrackOrder(order)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isAvailable
            ? isDark
              ? 'rgba(34, 197, 94, 0.4)'
              : '#BBF7D0'
            : isDark
            ? colors.border
            : '#E2E8F0',
        },
      ]}
    >
      {/* ── 1. TWO-TIER HEADER (Order # & Status in Row 1, Full Timestamp in Row 2) ── */}
      <View
        style={[
          styles.headerContainer,
          {
            borderBottomColor: colors.divider,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={[styles.orderNumberBadge, { backgroundColor: isDark ? colors.surfaceVariant : '#EEF2F6' }]}>
            <Ionicons name="receipt-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.orderNumberText, { color: colors.textPrimary }]}>
              #{cleanOrderNumber}
            </Text>
            {order.origin ? (
              <Text style={[styles.orderOriginText, { color: colors.textTertiary }]}>
                {' '}({order.origin})
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusConfig.bg,
                borderColor: statusConfig.border,
              },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={12}
              color={statusConfig.color}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Timestamp Row: Has the entire width so date never truncates or squashes */}
        <View style={styles.headerMetaRow}>
          <Ionicons name="time-outline" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
          <Text style={[styles.orderDateTime, { color: colors.textSecondary }]}>
            {order.date} • {order.time}
          </Text>
          <View style={[styles.metaDot, { backgroundColor: colors.border }]} />
          <Ionicons name="storefront-outline" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
          <Text style={[styles.orderHubText, { color: colors.textTertiary }]}>
            LB Hub Dispatch
          </Text>
        </View>
      </View>

      {/* ── 2. MIDDLE CONTENT: Customer, Drop Location, Cart Item Summary ── */}
      <View style={styles.middleSection}>
        {/* Customer & Payment Badge */}
        <View style={styles.customerRow}>
          <View style={[styles.avatarBox, { backgroundColor: isDark ? colors.surfaceVariant : '#EFF6FF' }]}>
            <Ionicons name="person" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>
              {order.customerName || 'Customer'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Ionicons name="call-outline" size={11} color={colors.textTertiary} style={{ marginRight: 3 }} />
              <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
                {order.customerPhone || 'Phone unavailable'}
              </Text>
            </View>
          </View>

          {/* Payment Status Pill */}
          <View
            style={[
              styles.paymentBadge,
              {
                backgroundColor: order.isCod ? '#FEF3C7' : '#DCFCE7',
                borderColor: order.isCod ? '#FDE68A' : '#86EFAC',
              },
            ]}
          >
            <Ionicons
              name={order.isCod ? 'cash' : 'checkmark-circle'}
              size={12}
              color={order.isCod ? '#D97706' : '#16A34A'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.paymentBadgeText, { color: order.isCod ? '#B45309' : '#15803D' }]}>
              {order.isCod ? 'COD CASH' : 'PREPAID'}
            </Text>
          </View>
        </View>

        {/* Drop Location Container */}
        <View
          style={[
            styles.addressBox,
            {
              backgroundColor: isDark ? colors.surfaceVariant : '#F8FAFC',
              borderColor: isDark ? 'transparent' : '#F1F5F9',
            },
          ]}
        >
          <Ionicons name="location" size={16} color="#EF4444" style={{ marginTop: 2, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.addressLabel, { color: colors.textTertiary }]}>DELIVERY ADDRESS</Text>
            <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={2}>
              {order.deliveryAddress}
            </Text>
          </View>
        </View>

        {/* Item & Cart Summary Box */}
        <View
          style={[
            styles.cartSummaryBox,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
              borderColor: colors.divider,
            },
          ]}
        >
          <View style={styles.cartLeft}>
            <View style={[styles.packageIconBox, { backgroundColor: isDark ? colors.surfaceVariant : '#EDE9FE' }]}>
              <Ionicons name="cube" size={15} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              <View style={styles.itemCountRow}>
                <View style={[styles.itemCountPill, { backgroundColor: isDark ? colors.surfaceVariant : '#E2E8F0' }]}>
                  <Text style={[styles.itemCountPillText, { color: colors.textPrimary }]}>
                    {order.itemCount} {order.itemCount === 1 ? 'ITEM' : 'ITEMS'}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.primaryItemName, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {primaryItemName}
              </Text>
            </View>
          </View>

          {/* Amount / Collection Box */}
          <View style={styles.amountBox}>
            <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
              {order.isCod
                ? 'CASH TO COLLECT'
                : order.totalAmount > 0
                ? 'PAID ONLINE'
                : 'PAYMENT STATUS'}
            </Text>
            <Text
              style={[
                styles.amountValue,
                {
                  color: order.isCod
                    ? '#D97706'
                    : '#16A34A',
                  fontSize: !order.isCod && order.totalAmount === 0 ? 13 : 15,
                },
              ]}
            >
              {order.isCod
                ? `₹${order.totalAmount.toFixed(2)}`
                : order.totalAmount > 0
                ? `₹${order.totalAmount.toFixed(2)}`
                : 'Prepaid ✓'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3. ACTION BUTTONS ── */}
      <View style={[styles.footerRow, { borderTopColor: colors.divider }]}>
        {isAvailable && onAccept ? (
          <View style={styles.unassignedActionRow}>
            {onReject ? (
              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                  },
                ]}
                onPress={() => onReject(order)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" style={{ marginRight: 5 }} />
                <Text style={styles.rejectBtnText}>Decline</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.acceptBtn,
                {
                  backgroundColor: '#16A34A',
                  shadowColor: '#16A34A',
                },
              ]}
              onPress={() => onAccept(order)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.acceptBtnText}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.standardActionRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="navigate-circle-outline" size={17} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.viewDetailsPrompt, { color: colors.textSecondary }]}>
                {order.status === 'in_transit' ? 'Out for Delivery' : 'Pickup & Delivery Workflow'}
              </Text>
            </View>
            <View style={[styles.detailsBadge, { backgroundColor: isDark ? colors.surfaceVariant : '#F0FDF4' }]}>
              <Text style={[styles.detailsLink, { color: colors.primary }]}>Details</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 7,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 9,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  orderOriginText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDateTime: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 7,
  },
  orderHubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  middleSection: {
    padding: 14,
    gap: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerPhone: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  paymentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  addressLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  cartSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  packageIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  itemCountRow: {
    marginBottom: 2,
  },
  itemCountPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  itemCountPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  primaryItemName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  amountBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingLeft: 6,
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  footerRow: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unassignedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  rejectBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  standardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  viewDetailsPrompt: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailsLink: {
    fontSize: 12,
    fontWeight: '800',
  },
});
