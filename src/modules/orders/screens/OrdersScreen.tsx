import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState, Skeleton } from '../../../components';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { OrderCard } from '../components/OrderCard';
import { DeliveryTabFilter, useOrders } from '../hooks/useOrders';
import { Order } from '../types';

interface OrdersScreenProps {
  onBack: () => void;
  onNavigateToShop?: () => void;
  onNavigateToOrderDetails: (order: Order) => void;
  onNavigateToLogin?: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  onBack,
  onNavigateToOrderDetails,
  onNavigateToLogin,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    orders,
    availableOrders,
    activeDeliveries,
    deliveredOrders,
    cancelledOrders,
    selectedTab,
    setSelectedTab,
    loading,
    refreshing,
    refreshOrders,
    acceptOrder,
    rejectOrder,
  } = useOrders();

  const isFirstMountRef = React.useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated && onNavigateToLogin) {
        onNavigateToLogin();
        return;
      }
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        return;
      }
      refreshOrders();
    }, [isAuthenticated, onNavigateToLogin, refreshOrders]),
  );

  const tabs: { id: DeliveryTabFilter; label: string; count: number; icon: string }[] = useMemo(
    () => [
      {
        id: 'available',
        label: 'New Orders',
        count: availableOrders.length,
        icon: 'flash-outline',
      },
      {
        id: 'active',
        label: 'Active',
        count: activeDeliveries.length,
        icon: 'bicycle-outline',
      },
      {
        id: 'delivered',
        label: 'Delivered',
        count: deliveredOrders.length,
        icon: 'checkmark-circle-outline',
      },
      {
        id: 'cancelled',
        label: 'Cancelled',
        count: cancelledOrders.length,
        icon: 'close-circle-outline',
      },
    ],
    [availableOrders.length, activeDeliveries.length, deliveredOrders.length, cancelledOrders.length],
  );

  const displayedOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      order =>
        order.orderNumber.toLowerCase().includes(q) ||
        (order.customerName && order.customerName.toLowerCase().includes(q)) ||
        order.deliveryAddress.toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Delivery Orders" onBack={onBack} />

      {/* Search Input Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? colors.surfaceVariant : '#F8FAFC',
              borderColor: colors.border,
              borderRadius: 12,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.primary}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search order #, customer name, address..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modern Capsule Pill Delivery Tabs */}
      <View style={[styles.tabBarWrapper, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map(tab => {
            const isSelected = selectedTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.75}
                onPress={() => setSelectedTab(tab.id)}
                style={[
                  styles.tabPill,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(22, 163, 74, 0.22)'
                        : '#DCFCE7'
                      : isDark
                      ? colors.surfaceVariant
                      : '#F1F5F9',
                    borderColor: isSelected
                      ? colors.primary
                      : isDark
                      ? colors.border
                      : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isSelected ? colors.primary : colors.textSecondary}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Context / Result Summary Header */}
      <View style={[styles.summaryRow, { backgroundColor: colors.background }]}>
        <Text style={[styles.summaryCountText, { color: colors.textSecondary }]}>
          {searchQuery.trim()
            ? `Matching "${searchQuery}" (${displayedOrders.length})`
            : `${tabs.find(t => t.id === selectedTab)?.label || 'Orders'} (${displayedOrders.length})`}
        </Text>
        {selectedTab === 'available' && displayedOrders.length > 0 && (
          <View style={[styles.hintPill, { backgroundColor: isDark ? 'rgba(202, 138, 4, 0.15)' : '#FEF9C3' }]}>
            <Ionicons name="flash" size={11} color="#CA8A04" style={{ marginRight: 3 }} />
            <Text style={styles.hintPillText}>Ready for pickup</Text>
          </View>
        )}
      </View>

      {/* Orders List / Loading / Empty */}
      {loading && !refreshing ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.xl },
              ]}
            >
              <Skeleton width="40%" height={16} borderRadius={4} />
              <Skeleton width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
              <Skeleton width="60%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : displayedOrders.length === 0 ? (
        <EmptyState
          title={
            selectedTab === 'available'
              ? 'No New Orders Right Now'
              : selectedTab === 'active'
              ? 'No Active Deliveries'
              : selectedTab === 'delivered'
              ? 'No Delivered Orders Yet'
              : 'No Cancelled Orders'
          }
          message={
            selectedTab === 'available'
              ? 'Check back shortly or pull down to refresh when new order pickings are assigned to the hub.'
              : selectedTab === 'active'
              ? 'Accept orders from the "New Orders" tab to start your delivery shift.'
              : 'All your delivery order activities will show up here.'
          }
          iconName={selectedTab === 'available' ? 'flash-outline' : 'bicycle-outline'}
          actionLabel="Refresh Orders"
          onAction={refreshOrders}
        />
      ) : (
        <FlatList
          data={displayedOrders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onTrackOrder={onNavigateToOrderDetails}
              onAccept={item.status === 'unassigned' ? o => acceptOrder(o.pickingId || Number(o.id)) : undefined}
              onReject={item.status === 'unassigned' ? o => rejectOrder(o.pickingId || Number(o.id)) : undefined}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 16, 24) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshOrders}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
    fontWeight: '500',
  },
  tabBarWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.2,
  },
  tabIcon: {
    marginRight: 5,
  },
  tabLabel: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  tabBadge: {
    marginLeft: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  summaryCountText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  hintPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonCard: {
    padding: 16,
    borderWidth: 1,
  },
  listContent: {
    paddingTop: 6,
  },
});
