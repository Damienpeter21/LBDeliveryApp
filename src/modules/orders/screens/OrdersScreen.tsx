import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
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
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search order #, customer name, address..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Delivery Stage Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map(tab => {
          const isSelected = selectedTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              onPress={() => setSelectedTab(tab.id)}
              style={[
                styles.tabItem,
                isSelected && [styles.activeTabItem, { borderBottomColor: colors.primary }],
              ]}
            >
              <View style={styles.tabContentRow}>
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isSelected ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                    isSelected && styles.activeTabLabel,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isSelected ? colors.onPrimary : colors.textSecondary },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
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
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabLabel: {
    fontWeight: '700',
  },
  tabBadge: {
    marginLeft: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
    paddingTop: 8,
  },
});
