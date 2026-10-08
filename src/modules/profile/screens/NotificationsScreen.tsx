// src/modules/profile/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, Skeleton } from '../../../components';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { OrderService } from '../../orders/services/orderService';
import { NotificationService } from '../services/notificationService';

interface NotificationItem {
  id: number | string;
  title: string;
  body: string;
  type: 'order' | 'promo' | 'delivery' | 'system';
  isRead: boolean;
  time: string;
}

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigateToOrders?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onNavigateToOrders,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!isAuthenticated || (!user?.partnerId && !user?.id)) {
        setNotifications([
          {
            id: 'welcome_guest',
            title: 'Welcome to LB Delivery Partner!',
            body: 'Sign in to your account to view live delivery pickings, attendance status, and shift updates.',
            type: 'promo',
            isRead: false,
            time: 'Welcome',
          },
        ]);
        return;
      }

      const partnerId = user?.partnerId || user?.id;
      const notifs: NotificationItem[] = [];

      // 1. Fetch live Odoo notifications
      try {
        const res = await NotificationService.getNotifications(partnerId);
        const items = Array.isArray(res?.result) ? res.result : Array.isArray(res) ? res : [];
        if (items.length > 0) {
          items.forEach((it: any) => {
            notifs.push({
              id: it.id,
              title: it.notification_type === 'email' ? 'Email Notification' : 'LB Delivery Alert',
              body: Array.isArray(it.mail_message_id)
                ? it.mail_message_id[1]
                : typeof it.mail_message_id === 'string'
                ? it.mail_message_id
                : 'Order or account update from LB Delivery.',
              type: it.notification_type === 'inbox' ? 'order' : 'system',
              isRead: it.notification_status === 'sent',
              time: 'Recently',
            });
          });
        }
      } catch (notifErr) {
        console.warn('Odoo mail.notification fetch warning:', notifErr);
      }

      // 2. Derive live order notifications from the user's real Odoo orders
      if (partnerId) {
        try {
          const ordersRes = await OrderService.getAllOrders(partnerId, 5);
          const rawOrders = Array.isArray(ordersRes?.result)
            ? ordersRes.result
            : Array.isArray(ordersRes)
            ? ordersRes
            : [];

          rawOrders.forEach((ord: any) => {
            let orderTitle = `Order #${ord.name || ord.id}`;
            let orderBody = `Order total: ₹${ord.amount_total}.`;
            let notifType: NotificationItem['type'] = 'order';

            if (ord.state === 'sale') {
              if (ord.delivery_status === 'full') {
                orderTitle = `Order #${ord.name} Delivered`;
                orderBody = `Your order of ₹${ord.amount_total} has been delivered successfully.`;
                notifType = 'delivery';
              } else {
                orderTitle = `Order #${ord.name} Confirmed`;
                orderBody = `Your order of ₹${ord.amount_total} is confirmed and in preparation for doorstep delivery.`;
                notifType = 'order';
              }
            } else if (ord.state === 'cancel') {
              orderTitle = `Order #${ord.name} Cancelled`;
              orderBody = `Order #${ord.name} has been cancelled.`;
              notifType = 'order';
            } else if (ord.state === 'draft') {
              orderTitle = `Order #${ord.name} Placed`;
              orderBody = `Order #${ord.name} received and awaiting processing.`;
              notifType = 'order';
            }

            let timeStr = 'Recently';
            if (ord.date_order) {
              try {
                const d = new Date(ord.date_order.replace(' ', 'T'));
                if (!isNaN(d.getTime())) {
                  timeStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                }
              } catch (_) {}
            }

            notifs.push({
              id: `order_notif_${ord.id}`,
              title: orderTitle,
              body: orderBody,
              type: notifType,
              isRead: ord.state === 'sale' && ord.delivery_status === 'full',
              time: timeStr,
            });
          });
        } catch (ordErr) {
          console.warn('Live orders notifications derivation warning:', ordErr);
        }
      }

      setNotifications(notifs);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;

    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n))
    );

    if (typeof item.id === 'number') {
      try {
        await NotificationService.markNotificationRead(item.id);
      } catch (err) {
        console.warn('Failed to mark read in Odoo:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    for (const item of notifications) {
      if (!item.isRead && typeof item.id === 'number') {
        NotificationService.markNotificationRead(item.id).catch(() => {});
      }
    }
  };

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'order':
        return { name: 'receipt-outline', color: colors.primary };
      case 'delivery':
        return { name: 'bicycle-outline', color: colors.secondary };
      case 'promo':
        return { name: 'pricetag-outline', color: '#EAB308' };
      default:
        return { name: 'notifications-outline', color: colors.primary };
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Notifications" onBack={onBack} />

      {/* Header bar with Unread Count & Mark All Read */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.unreadCountText, { color: colors.textSecondary }]}>
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
            : 'All caught up!'}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={[styles.markAllReadText, { color: colors.primary }]}>
              Mark all as read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Skeleton width="55%" height={15} borderRadius={4} />
                  <Skeleton width={45} height={12} borderRadius={4} />
                </View>
                <Skeleton width="90%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
                <Skeleton width="70%" height={13} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 20, 24) },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Ionicons
                  name="notifications-off-outline"
                  size={42}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No Notifications Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                We'll notify you here about live order tracking, fresh offers, and exclusive discounts.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const iconConfig = getIconForType(item.type);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  handleMarkAsRead(item);
                  if (item.type === 'order' && onNavigateToOrders) {
                    onNavigateToOrders();
                  }
                }}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: item.isRead ? colors.card : colors.surface,
                    borderColor: item.isRead ? colors.border : colors.primary,
                    borderRadius: borderRadius.lg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
                </View>

                <View style={styles.contentBox}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.itemTitle,
                        {
                          color: colors.textPrimary,
                          fontWeight: item.isRead ? '700' : '900',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                      {item.time}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.bodyText,
                      { color: item.isRead ? colors.textSecondary : colors.textPrimary },
                    ]}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                </View>

                {!item.isRead && (
                  <View
                    style={[styles.unreadDot, { backgroundColor: colors.primary }]}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  unreadCountText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  markAllReadText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentBox: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bodyText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
