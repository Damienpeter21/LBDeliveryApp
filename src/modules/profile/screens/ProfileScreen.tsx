import React, { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, Skeleton, useStatusModal } from '../../../components';
import { useLocation } from '../../location';
import { IMAGES } from '../../../assets';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useOrders } from '../../orders';
import { useWishlist } from '../../products/context/WishlistContext';
import { useAddress } from '../context/AddressContext';
import { CustomerService } from '../services/customerService';

interface ProfileScreenProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
  onNavigateToOrders: () => void;
  onNavigateToSavedAddresses: () => void;
  onNavigateToWishlist: () => void;
  onNavigateToEditProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToHelpAndLegal?: (initialTab?: 'support' | 'terms' | 'privacy') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onNavigateToLogin,
  onNavigateToOrders,
  onNavigateToSavedAddresses,
  onNavigateToWishlist,
  onNavigateToEditProfile,
  onNavigateToNotifications,
  onNavigateToHelpAndLegal,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const { location } = useLocation();
  const { addresses, refreshAddresses } = useAddress();
  const { wishlistCount } = useWishlist();
  const { orders, refreshOrders, loading: ordersLoading } = useOrders();
  const { showStatusModal } = useStatusModal();

  // Refresh live order count and saved addresses whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && (user?.partnerId || user?.id)) {
        refreshOrders();
        refreshAddresses();
      }
    }, [isAuthenticated, user?.partnerId, user?.id, refreshOrders, refreshAddresses])
  );

  // Synchronize live user profile from Odoo on mount
  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated || !user?.id) return;

    CustomerService.getUserProfile(user.id)
      .then(res => {
        const profile = Array.isArray(res?.result)
          ? res.result[0]
          : Array.isArray(res)
          ? res[0]
          : res?.result;

        if (isMounted && profile) {
          const pId = Array.isArray(profile.partner_id)
            ? profile.partner_id[0]
            : profile.partner_id || undefined;

          updateUser({
            ...(profile.name ? { name: profile.name } : {}),
            ...(profile.phone ? { phone: String(profile.phone) } : {}),
            ...(profile.email ? { email: profile.email } : {}),
            ...(pId ? { partnerId: pId } : {}),
          });
        }
      })
      .catch(err => {
        console.warn('Profile live sync warning:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  const handleLogout = () => {
    showStatusModal({
      type: 'confirm',
      title: 'Log Out',
      message: 'Are you sure you want to log out of your LB Delivery Partner account?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: logout,
    });
  };

  const handleFeatureNotice = (title: string) => {
    showStatusModal({
      type: 'info',
      title,
      message: 'Please review our official Terms & Conditions for full details and policies.',
      buttonText: 'OK',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="My Account" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 30, 40),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              {isAuthenticated && user?.name ? (
                <Text style={[styles.avatarInitial, { color: colors.onPrimary }]}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Ionicons name="person" size={26} color={colors.onPrimary} />
              )}
            </View>

            <View style={styles.heroTextContainer}>
              {isAuthenticated ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.userName, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                      {user?.name}
                    </Text>
                    {onNavigateToEditProfile && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={onNavigateToEditProfile}
                        style={[
                          styles.editBadgeBtn,
                          {
                            backgroundColor: colors.surfaceVariant,
                            borderColor: colors.border,
                            borderRadius: borderRadius.sm,
                          },
                        ]}
                      >
                        <Ionicons name="pencil" size={11} color={colors.primary} style={{ marginRight: 3 }} />
                        <Text style={[styles.editBadgeText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                    {user?.email}
                  </Text>
                  <View style={[styles.clubBadge, { backgroundColor: colors.surfaceVariant, borderColor: colors.secondary }]}>
                    <Ionicons name="sparkles" size={11} color={colors.secondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.clubBadgeText, { color: colors.primary }]}>
                      Delivery Partner
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.userName, { color: colors.textPrimary }]}>
                    Welcome Guest!
                  </Text>
                  <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                    Sign in to track orders & save delivery addresses
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onNavigateToLogin}
                    style={[
                      styles.signInBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Text style={[styles.signInBtnText, { color: colors.onPrimary }]}>
                      Sign In / Register ›
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {/* 3-Card Stats Row (Orders, Wishlist, Addresses) */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
            onPress={onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="bag-handle" size={18} color={colors.primary} />
            </View>
            <View style={styles.statInfo}>
              {isAuthenticated && ordersLoading && orders.length === 0 ? (
                <Skeleton width={28} height={18} borderRadius={4} style={{ marginVertical: 3 }} />
              ) : (
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {isAuthenticated ? orders.length : 0}
                </Text>
              )}
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Orders</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
            onPress={onNavigateToWishlist}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="heart" size={18} color={colors.error} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {wishlistCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wishlist</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
            onPress={() => (isAuthenticated ? onNavigateToSavedAddresses() : onNavigateToLogin())}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="location" size={18} color={colors.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {isAuthenticated ? addresses.length : 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Addresses</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 1: Account Activities */}
        <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>ACCOUNT & ACTIVITY</Text>
        <View
          style={[
            styles.menuGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          {/* My Orders */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.divider }]}
            onPress={onNavigateToOrders}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>My Orders</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Track live orders, deliveries & invoices</Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              <View style={[styles.countBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {isAuthenticated ? orders.length : 0}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* My Wishlist */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.divider }]}
            onPress={onNavigateToWishlist}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="heart-outline" size={18} color={colors.error} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>My Wishlist</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Saved favorite fresh items</Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              <View style={[styles.countBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.countBadgeText, { color: colors.error }]}>{wishlistCount}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* Delivery Addresses */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => (isAuthenticated ? onNavigateToSavedAddresses() : onNavigateToLogin())}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="navigate-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Delivery Addresses</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {!isAuthenticated
                    ? 'Sign in to view saved delivery addresses'
                    : addresses.length > 0
                    ? `${addresses.length} saved • ${(() => {
                        const def = addresses.find(a => a.isDefault) || addresses[0];
                        return def ? [def.flatNo, def.streetArea, def.city].filter(Boolean).join(', ') : location.shortAddress;
                      })()}`
                    : 'No saved address • Add new'}
                </Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              <View style={[styles.countBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {isAuthenticated ? addresses.length : 0}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 2: Preferences & Support */}
        <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>PREFERENCES & SUPPORT</Text>
        <View
          style={[
            styles.menuGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          {/* Notifications */}
          {onNavigateToNotifications && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.divider }]}
              onPress={onNavigateToNotifications}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Notifications</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                    Order alerts, delivery updates & offers
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <View style={[styles.menuItem, { borderBottomColor: colors.divider }]}>
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Dark Mode</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              if (onNavigateToHelpAndLegal) {
                onNavigateToHelpAndLegal('terms');
              } else {
                handleFeatureNotice('Terms & Conditions');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Terms & Conditions</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Official service policies & customer guidelines</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Log Out Action */}
        {isAuthenticated && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            style={[
              styles.logoutButton,
              {
                borderColor: colors.error,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Log Out</Text>
          </TouchableOpacity>
        )}

        {/* App Footer Info */}
        <View style={styles.appFooter}>
          <View style={[styles.footerLogoBadge, { backgroundColor: colors.primaryVariant }]}>
            <Image
              source={IMAGES.LOGO}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.footerBrand, { color: colors.primary }]}>LB Delivery</Text>
          <Text style={[styles.footerVersion, { color: colors.textTertiary }]}>
            Version 1.0.0 (Build 42) • Crafted with ❤️ in India
          </Text>
          <Text style={[styles.footerSub, { color: colors.textTertiary }]}>
            Fast & Reliable Orders Delivery Partner App
          </Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCard: {
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12.5,
    marginTop: 2,
    marginBottom: 6,
  },
  clubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  clubBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  signInBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  signInBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  logoutButton: {
    flexDirection: 'row',
    height: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  appFooter: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
    marginBottom: 6,
  },
  footerLogo: {
    width: '100%',
    height: '100%',
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerVersion: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  footerSub: {
    fontSize: 10.5,
    marginTop: 3,
    textAlign: 'center',
  },
  editBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginLeft: 8,
  },
  editBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
