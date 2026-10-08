import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, useStatusModal } from '../../../components';
import { storage } from '../../../storage';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { DeliveryApiService } from '../services/deliveryApiService';
import { AttendanceSummary } from '../types';

interface AttendanceScreenProps {
  onBack: () => void;
}

const SHIFT_STORAGE_KEY = '@lb_delivery_shift_checked_in';

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const { showStatusModal } = useStatusModal();
  const driverUserId = user?.userId || Number(user?.id) || 14;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // Fully online application: default driver to Online
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const fetchAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const storedShift = await storage.getString(SHIFT_STORAGE_KEY);
      if (storedShift === 'false') {
        setIsCheckedIn(false);
      } else {
        setIsCheckedIn(true);
      }

      const res = await DeliveryApiService.getAttendanceSummary({
        uid: driverUserId,
      });
      const data = res?.result !== undefined ? res.result : res;
      if (data) {
        setSummary(data);
        const rawData: any = data;
        if (rawData.isCheckedIn !== undefined) {
          setIsCheckedIn(Boolean(rawData.isCheckedIn));
          await storage.set(SHIFT_STORAGE_KEY, String(Boolean(rawData.isCheckedIn)));
        } else if (rawData.is_checked_in !== undefined) {
          setIsCheckedIn(Boolean(rawData.is_checked_in));
          await storage.set(SHIFT_STORAGE_KEY, String(Boolean(rawData.is_checked_in)));
        } else if (rawData.attendance_state) {
          const isOnline = rawData.attendance_state === 'checked_in';
          setIsCheckedIn(isOnline);
          await storage.set(SHIFT_STORAGE_KEY, String(isOnline));
        }
      }
    } catch (err) {
      console.warn('Error fetching attendance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverUserId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleToggleCheckIn = async () => {
    const userEmail = user?.email || 'karthik.delivery@example.com';
    setActionLoading(true);

    try {
      if (!isCheckedIn) {
        // Perform Check-in
        await DeliveryApiService.checkIn({
          login: userEmail,
        });
        setIsCheckedIn(true);
        await storage.set(SHIFT_STORAGE_KEY, 'true');
        showStatusModal({
          type: 'success',
          title: 'Shift Started! 🛵',
          message: 'You are now Checked In. You are ready to receive delivery orders.',
        });
      } else {
        // Perform Check-out
        await DeliveryApiService.checkOut({
          login: userEmail,
        });
        setIsCheckedIn(false);
        await storage.set(SHIFT_STORAGE_KEY, 'false');
        showStatusModal({
          type: 'info',
          title: 'Shift Ended 👋',
          message: 'You are now Checked Out. Have a good rest!',
        });
      }
      await fetchAttendance(true);
    } catch (err: any) {
      showStatusModal({
        type: 'error',
        title: 'Attendance Error',
        message: err?.message || 'Failed to update attendance status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Shift Attendance" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 30) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAttendance(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Main Status & Toggle Card */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.card,
              borderColor: isCheckedIn ? colors.primary : colors.border,
              borderWidth: 1.5,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <View style={styles.statusTopRow}>
            <View
              style={[
                styles.statusIconBox,
                { backgroundColor: isCheckedIn ? '#DCFCE7' : '#F3F4F6' },
              ]}
            >
              <Ionicons
                name={isCheckedIn ? 'radio-button-on' : 'power-outline'}
                size={30}
                color={isCheckedIn ? '#16A34A' : '#6B7280'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.shiftStatusTitle, { color: colors.textPrimary }]}>
                {isCheckedIn ? 'Shift Active (Online)' : 'Checked Out (Offline)'}
              </Text>
              <Text style={[styles.shiftStatusSub, { color: colors.textSecondary }]}>
                {isCheckedIn
                  ? 'Ready to accept customer orders'
                  : 'Check in to start receiving new orders'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isCheckedIn ? '#DC2626' : colors.primary,
              },
            ]}
            onPress={handleToggleCheckIn}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.btnInnerRow}>
                <Ionicons
                  name={isCheckedIn ? 'log-out-outline' : 'log-in-outline'}
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionButtonText}>
                  {isCheckedIn ? 'End Shift (Check Out)' : 'Start Shift (Check In)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Working Hours & KPI Card */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>
            Shift Summary
          </Text>

          <View style={styles.kpiGrid}>
            <View style={[styles.kpiBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {summary?.todayWorkedHours ? `${summary.todayWorkedHours} hrs` : isCheckedIn ? 'Active' : '0 hrs'}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Worked Today</Text>
            </View>

            <View style={[styles.kpiBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="calendar-outline" size={22} color={colors.secondary} />
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {summary?.target_date || new Date().toISOString().split('T')[0]}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Shift Date</Text>
            </View>
          </View>
        </View>

        {/* Attendance Policy Notice */}
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Shift Guidelines</Text>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              Make sure your GPS is enabled and vehicle is ready before starting your shift. Ensure all cash collected from COD deliveries is deposited before ending your shift.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftStatusTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  shiftStatusSub: {
    fontSize: 13,
    marginTop: 3,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  kpiCard: {
    padding: 18,
    borderWidth: 1,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  noticeCard: {
    flexDirection: 'row',
    padding: 14,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
