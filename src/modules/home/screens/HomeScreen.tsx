import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { IMAGES } from '../../../assets';
import { Skeleton, useStatusModal } from '../../../components';
import { storage } from '../../../storage';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { OrderCard } from '../../orders/components/OrderCard';
import { Order } from '../../orders/types';
import { HomeActions } from '../services/HomeActions';

interface HomeScreenProps {
  onNavigateToOrderDetails: (order: Order) => void;
  onNavigateToOrders: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToCashHandover?: () => void;
  onNavigateToProfile: () => void;
  onRequireAuth?: () => void;
  onNavigateToProductDetails?: any;
  onNavigateToProductList?: any;
  onNavigateToCategories?: any;
  onNavigateToCart?: any;
}

const SHIFT_STORAGE_KEY = '@lb_delivery_shift_checked_in';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToOrderDetails,
  onNavigateToOrders,
  onNavigateToAttendance,
  onNavigateToCashHandover,
  onNavigateToProfile,
  onRequireAuth,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { showStatusModal } = useStatusModal();

  const driverUserId = user?.userId || Number(user?.id) || 15;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
  const [pendingCashTotal, setPendingCashTotal] = useState<number>(0);
  const [workedHours, setWorkedHours] = useState<number>(0);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Check stored shift state
      const storedShift = await storage.getString(SHIFT_STORAGE_KEY);
      if (storedShift === 'true') {
        setIsCheckedIn(true);
      }

      const [newOrders, active, attendance, cashHandover] = await Promise.all([
        HomeActions.getUnassignedOrders(),
        HomeActions.getMyActiveDeliveries(driverUserId),
        HomeActions.getAttendanceSummary(driverUserId),
        HomeActions.getPendingCashHandover(driverUserId),
      ]);

      setUnassignedOrders(newOrders);
      setActiveDeliveries(active);

      if (attendance) {
        if (attendance.isCheckedIn !== undefined) {
          setIsCheckedIn(Boolean(attendance.isCheckedIn));
          await storage.set(SHIFT_STORAGE_KEY, String(Boolean(attendance.isCheckedIn)));
        }
        if (attendance.todayWorkedHours) {
          setWorkedHours(attendance.todayWorkedHours);
        }
      }

      if (cashHandover) {
        setPendingCashTotal(Number(cashHandover.total_pending_cash || 0));
      }
    } catch (err) {
      console.warn('HomeScreen dashboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverUserId]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData(false);
    }, [loadDashboardData]),
  );

  const handleToggleCheckIn = async () => {
    if (!isAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }

    const userEmail = user?.email || 'karthik.delivery@example.com';
    setActionLoading(true);

    try {
      if (!isCheckedIn) {
        await HomeActions.checkIn(userEmail);
        setIsCheckedIn(true);
        await storage.set(SHIFT_STORAGE_KEY, 'true');
        showStatusModal({
          type: 'success',
          title: 'Shift Started! 🛵',
          message: 'You are now Online. Orders assigned to you will notify immediately.',
        });
      } else {
        await HomeActions.checkOut(userEmail);
        setIsCheckedIn(false);
        await storage.set(SHIFT_STORAGE_KEY, 'false');
        showStatusModal({
          type: 'info',
          title: 'Shift Ended 👋',
          message: 'You are now Offline. Take care and see you on the next shift!',
        });
      }
      await loadDashboardData(true);
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Attendance Error',
        message: err?.message || 'Failed to update shift status',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptOrder = async (order: Order) => {
    const pickingId = order.pickingId || Number(order.id);
    setActionLoading(true);
    try {
      await HomeActions.getMyActiveDeliveries(driverUserId); // refresh
      onNavigateToOrderDetails(order);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top + 8, 16),
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.brandGroup}>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>LB Delivery</Text>
          <View style={[styles.partnerPill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.partnerPillText, { color: colors.onSecondary }]}>PARTNER</Text>
          </View>
        </View>

        <View style={styles.headerRightGroup}>
          <View
            style={[
              styles.onlineStatusBadge,
              {
                backgroundColor: isCheckedIn ? '#DCFCE7' : '#F3F4F6',
                borderColor: isCheckedIn ? '#86EFAC' : '#D1D5DB',
              },
            ]}
          >
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: isCheckedIn ? '#16A34A' : '#9CA3AF' },
              ]}
            />
            <Text
              style={[
                styles.onlineStatusText,
                { color: isCheckedIn ? '#16A34A' : '#6B7280' },
              ]}
            >
              {isCheckedIn ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.profileAvatarBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            onPress={onNavigateToProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="person" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboardData(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Shift Banner & Quick Toggle ──────────────────────────── */}
        <View
          style={[
            styles.shiftBanner,
            {
              backgroundColor: colors.card,
              borderColor: isCheckedIn ? colors.primary : colors.border,
              borderWidth: 1.5,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <View style={styles.shiftBannerContent}>
            <View>
              <Text style={[styles.driverGreeting, { color: colors.textSecondary }]}>
                Hello, {user?.name || 'Delivery Partner'} 👋
              </Text>
              <Text style={[styles.shiftStatusLarge, { color: colors.textPrimary }]}>
                {isCheckedIn ? 'You are On Duty' : 'You are Off Duty'}
              </Text>
              <Text style={[styles.shiftHoursText, { color: colors.textSecondary }]}>
                Worked today: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{workedHours ? `${workedHours} hrs` : isCheckedIn ? 'Active' : '0 hrs'}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.shiftToggleBtn,
                {
                  backgroundColor: isCheckedIn ? '#DC2626' : colors.primary,
                },
              ]}
              onPress={handleToggleCheckIn}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.shiftToggleBtnText}>
                  {isCheckedIn ? 'Check Out' : 'Check In'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── KPI Metric Cards ─────────────────────────────────────── */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Available Orders */}
          <TouchableOpacity
            style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="flash" size={20} color="#CA8A04" />
            </View>
            <Text style={[styles.kpiNumber, { color: colors.textPrimary }]}>
              {unassignedOrders.length}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Available</Text>
          </TouchableOpacity>

          {/* Card 2: Active Deliveries */}
          <TouchableOpacity
            style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="bicycle" size={20} color="#0284C7" />
            </View>
            <Text style={[styles.kpiNumber, { color: colors.textPrimary }]}>
              {activeDeliveries.length}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Active</Text>
          </TouchableOpacity>

          {/* Card 3: Pending Cash Handover */}
          <TouchableOpacity
            style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onNavigateToCashHandover || onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cash" size={20} color="#D97706" />
            </View>
            <Text style={[styles.kpiNumber, { color: colors.primary }]}>
              ₹{pendingCashTotal.toFixed(0)}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending COD</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Action Shortcuts ───────────────────────────────── */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={[styles.shortcutBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            onPress={onNavigateToOrders}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={[styles.shortcutText, { color: colors.textPrimary }]}>All Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            onPress={onNavigateToCashHandover || onNavigateToOrders}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={[styles.shortcutText, { color: colors.textPrimary }]}>Cash Handover</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            onPress={onNavigateToAttendance || onNavigateToProfile}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.shortcutText, { color: colors.textPrimary }]}>Attendance</Text>
          </TouchableOpacity>
        </View>

        {/* ── Active Deliveries in Progress ────────────────────────── */}
        {activeDeliveries.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="bicycle" size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Active In-Transit ({activeDeliveries.length})
                </Text>
              </View>
              <TouchableOpacity onPress={onNavigateToOrders}>
                <Text style={[styles.seeAllLink, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>

            {activeDeliveries.slice(0, 2).map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onTrackOrder={onNavigateToOrderDetails}
              />
            ))}
          </View>
        )}

        {/* ── New Orders Ready for Pickup (Unassigned) ─────────────── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="flash" size={18} color="#CA8A04" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                New Orders Ready for Pickup ({unassignedOrders.length})
              </Text>
            </View>
            <TouchableOpacity onPress={onNavigateToOrders}>
              <Text style={[styles.seeAllLink, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View style={styles.skeletonContainer}>
              <Skeleton width="100%" height={120} borderRadius={16} />
            </View>
          ) : unassignedOrders.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.xl },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.primary} />
              <Text style={[styles.emptyBoxTitle, { color: colors.textPrimary }]}>
                You're All Caught Up!
              </Text>
              <Text style={[styles.emptyBoxSub, { color: colors.textSecondary }]}>
                No new unassigned orders waiting right now. Pull down to refresh or check back shortly.
              </Text>
            </View>
          ) : (
            unassignedOrders.slice(0, 4).map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onTrackOrder={onNavigateToOrderDetails}
                onAccept={handleAcceptOrder}
                onReject={() => {}}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  partnerPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  partnerPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 16,
  },
  shiftBanner: {
    marginHorizontal: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  shiftBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverGreeting: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  shiftStatusLarge: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  shiftHoursText: {
    fontSize: 12,
    marginTop: 4,
  },
  shiftToggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shiftToggleBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  shortcutsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  seeAllLink: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  skeletonContainer: {
    paddingHorizontal: 16,
  },
  emptyBox: {
    marginHorizontal: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    gap: 8,
  },
  emptyBoxTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyBoxSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
