import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState } from '../../../components';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { DeliveryApiService } from '../services/deliveryApiService';
import { PendingCashHandoverItem } from '../types';

interface CashHandoverScreenProps {
  onBack: () => void;
}

export const CashHandoverScreen: React.FC<CashHandoverScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const driverUserId = user?.userId || Number(user?.id) || 15;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [totalPendingCash, setTotalPendingCash] = useState<number>(0);
  const [orders, setOrders] = useState<PendingCashHandoverItem[]>([]);

  const fetchPendingCash = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await DeliveryApiService.getPendingCashHandover(driverUserId);
      const data = res?.result !== undefined ? res.result : res;
      if (data) {
        const handovers = Array.isArray(data.pending_handovers)
          ? data.pending_handovers
          : Array.isArray(data.orders)
          ? data.orders
          : [];

        const orderList: any[] = [];
        let total = 0;

        for (const ho of handovers) {
          total += Number(ho.total_amount || ho.amount || ho.amount_collected || 0);
          const hid = ho.handover_id || ho.id;
          if (Array.isArray(ho.lines) && ho.lines.length > 0) {
            for (const line of ho.lines) {
              orderList.push({
                ...line,
                reference: ho.reference,
                date: ho.date,
                handover_id: hid,
              });
            }
          } else {
            orderList.push({ ...ho, handover_id: hid });
          }
        }

        if (data.total_pending_cash !== undefined) {
          total = Number(data.total_pending_cash);
        }

        setTotalPendingCash(total);
        setOrders(orderList);
      }
    } catch (err) {
      console.warn('Error fetching cash handover:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverUserId]);

  const handleConfirmHandover = async () => {
    setActionLoading(true);
    try {
      const hid = orders[0]?.handover_id || 1;
      await DeliveryApiService.confirmCashHandover(hid);
      setShowConfirmModal(false);
      await fetchPendingCash(true);
    } catch (err: any) {
      console.warn('Error confirming handover:', err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCash();
  }, [fetchPendingCash]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Cash Handover (COD)" onBack={onBack} />

      {/* Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: borderRadius.xl,
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              TOTAL PENDING CASH IN HAND
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.primary }]}>
              ₹{totalPendingCash.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.iconPill, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="cash-outline" size={26} color="#D97706" />
          </View>
        </View>

        <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>
          Please hand over cash collected from completed Cash on Delivery (COD) orders to the hub cashier before shift end.
        </Text>
      </View>

      {/* Orders List Section */}
      <View style={styles.listHeaderRow}>
        <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>
          Pending COD Orders ({orders.length})
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No Cash Pending Handover"
          message="You have no pending cash to deposit right now. All collected COD orders are reconciled."
          iconName="checkmark-done-circle-outline"
          actionLabel="Refresh"
          onAction={() => fetchPendingCash(true)}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item, index) => String(item.order_id || index)}
          renderItem={({ item }) => (
            <View
              style={[
                styles.orderCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.orderCardLeft}>
                <View style={[styles.orderNumberBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.orderNumberText, { color: colors.textPrimary }]}>
                    #{item.order_name || item.reference || item.order_id || 'COD-ORDER'}
                  </Text>
                </View>
                <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                  {item.date || 'Today'}
                </Text>
              </View>

              <View style={styles.orderCardRight}>
                <Text style={[styles.itemAmount, { color: colors.primary }]}>
                  ₹{Number(item.amount || item.total_amount || 0).toFixed(2)}
                </Text>
                <View style={[styles.statusTag, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.statusTagText, { color: '#B45309' }]}>Pending Handover</Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 16, 24) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPendingCash(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {totalPendingCash > 0 && !loading && (
        <View
          style={[
            styles.bottomActionBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 12, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.handoverButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowConfirmModal(true)}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-done-circle" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.handoverButtonText, { color: colors.onPrimary }]}>
                  Hand Over ₹{totalPendingCash.toFixed(2)} to Cashier
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="wallet-outline" size={32} color="#D97706" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Confirm Cash Handover
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Have you handed over ₹{totalPendingCash.toFixed(2)} in physical cash to the hub cashier/accountant?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowConfirmModal(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmHandover}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.modalConfirmBtnText, { color: colors.onPrimary }]}>Yes, Handed Over</Text>
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
  summaryCard: {
    margin: 16,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  iconPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHint: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  listHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  orderCardLeft: {
    gap: 4,
  },
  orderNumberBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  orderDate: {
    fontSize: 12,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bottomActionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  handoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  handoverButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
