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
          label: 'Available for Pickup',
          icon: 'flash-outline',
          bg: isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3',
          color: '#CA8A04',
          border: isDark ? 'rgba(234, 179, 8, 0.3)' : '#FDE047',
        };
      case 'assigned':
        return {
          label: 'Order Accepted',
          icon: 'checkmark-circle-outline',
          bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
          color: '#0284C7',
          border: isDark ? 'rgba(2, 132, 199, 0.3)' : '#BAE6FD',
        };
      case 'arrived_store':
        return {
          label: 'At Store',
          icon: 'business-outline',
          bg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F3E8FF',
          color: '#9333EA',
          border: isDark ? 'rgba(147, 51, 234, 0.3)' : '#E9D5FF',
        };
      case 'picked_up':
      case 'in_transit':
        return {
          label: 'Out for Delivery',
          icon: 'bicycle-outline',
          bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
          color: '#0284C7',
          border: isDark ? 'rgba(2, 132, 199, 0.3)' : '#BAE6FD',
        };
      case 'arrived_customer':
        return {
          label: 'At Customer Doorstep',
          icon: 'navigate-outline',
          bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5',
          color: '#059669',
          border: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          icon: 'checkmark-done-circle-outline',
          bg: isDark ? 'rgba(22, 163, 74, 0.15)' : '#DCFCE7',
          color: '#16A34A',
          border: isDark ? 'rgba(22, 163, 74, 0.3)' : '#BBF7D0',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: 'close-circle-outline',
          bg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
          color: '#DC2626',
          border: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
        };
      default:
        return {
          label: 'Active Order',
          icon: 'cube-outline',
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
  const isAvailable = order.status === 'unassigned';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onTrackOrder(order)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isAvailable ? colors.primary : colors.border,
          borderWidth: isAvailable ? 1.5 : 1,
          borderRadius: borderRadius.xl,
        },
      ]}
    >
      {/* 1. Header: Order Number & Status Badge */}
      <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
        <View style={styles.orderIdentity}>
          <View style={[styles.orderNumberBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.orderNumberText, { color: colors.textPrimary }]}>
              #{cleanOrderNumber}
            </Text>
          </View>
          <Text style={[styles.orderDateTime, { color: colors.textSecondary }]}>
            {order.date} • {order.time}
          </Text>
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
            size={13}
            color={statusConfig.color}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* 2. Middle Content Section: Customer & Package Info */}
      <View style={styles.middleSection}>
        <View style={styles.customerRow}>
          <View style={[styles.avatarBox, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="person-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>
              {order.customerName || 'Customer'}
            </Text>
            <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
              {order.customerPhone || 'Phone unavailable'}
            </Text>
          </View>
          <View style={[styles.paymentBadge, { backgroundColor: order.isCod ? '#FFFBEB' : '#ECFDF5', borderColor: order.isCod ? '#FDE68A' : '#A7F3D0' }]}>
            <Text style={[styles.paymentBadgeText, { color: order.isCod ? '#D97706' : '#059669' }]}>
              {order.isCod ? 'COD CASH' : 'PREPAID'}
            </Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginTop: 2, marginRight: 6 }} />
          <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </View>

        {/* Item count & Amount */}
        <View style={styles.detailsRow}>
          <View style={styles.detailPill}>
            <Ionicons name="cube-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.detailPillText, { color: colors.textSecondary }]}>
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} ({primaryItemName})
            </Text>
          </View>
          <Text style={[styles.amountText, { color: colors.primary }]}>
            ₹{order.totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* 3. Action Buttons */}
      <View style={[styles.footerRow, { borderTopColor: colors.divider }]}>
        {isAvailable && onAccept && onReject ? (
          <View style={styles.unassignedActionRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, { borderColor: colors.error }]}
              onPress={() => onReject(order)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={colors.error} style={{ marginRight: 4 }} />
              <Text style={[styles.rejectBtnText, { color: colors.error }]}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              onPress={() => onAccept(order)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={16} color={colors.onPrimary} style={{ marginRight: 4 }} />
              <Text style={[styles.acceptBtnText, { color: colors.onPrimary }]}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.standardActionRow}>
            <Text style={[styles.viewDetailsPrompt, { color: colors.textSecondary }]}>
              Tap to view pickup & delivery workflow
            </Text>
            <View style={styles.chevronRow}>
              <Text style={[styles.detailsLink, { color: colors.primary }]}>Details</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
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
    marginVertical: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  orderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  orderDateTime: {
    fontSize: 11.5,
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
    fontSize: 11.5,
    fontWeight: '700',
  },
  middleSection: {
    padding: 14,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerPhone: {
    fontSize: 12,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  paymentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
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
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  standardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetailsPrompt: {
    fontSize: 11.5,
  },
  chevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsLink: {
    fontSize: 12,
    fontWeight: '700',
  },
});
