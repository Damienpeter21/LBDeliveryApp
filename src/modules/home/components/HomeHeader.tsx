import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { IMAGES } from '../../../assets';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useCart } from '../../products';
import { useAddress } from '../../profile';
import { useLocation } from '../../location';

interface HomeHeaderProps {
  onPressCart: () => void;
  onPressProfile: () => void;
  onRequireAuth?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onPressCart,
  onPressProfile,
  onRequireAuth,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { totalQuantity } = useCart();
  const { location, openLocationPicker } = useLocation();
  const { selectedAddress } = useAddress();

  const handleLocationOrLogoPress = () => {
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        onPressProfile();
      }
      return;
    }
    openLocationPicker();
  };

  const displayAddress = React.useMemo(() => {
    if (!isAuthenticated || !user) {
      return 'Sign in to set location';
    }
    if (selectedAddress) {
      const typeLabel = selectedAddress.type ? `${selectedAddress.type}: ` : '';
      const locality = selectedAddress.streetArea || selectedAddress.city;
      const flat = selectedAddress.flatNo ? `${selectedAddress.flatNo}, ` : '';
      return `${typeLabel}${flat}${locality}`;
    }
    if (location?.shortAddress) {
      return location.shortAddress;
    }
    if (location?.locality) {
      return `${location.locality}, ${location.city}`;
    }
    return 'Select Delivery Location';
  }, [isAuthenticated, user, selectedAddress, location?.shortAddress, location?.locality, location?.city]);

  const addressIcon = !isAuthenticated
    ? 'location-outline'
    : selectedAddress?.type === 'WORK'
    ? 'briefcase'
    : selectedAddress?.type === 'HOME'
    ? 'home'
    : 'location-sharp';

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top + 8, 18),
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* Brand & Live GPS Location Selector */}
        <View style={styles.brandLocationSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLocationOrLogoPress}
            style={styles.brandRow}
          >
            <View style={[styles.headerLogoBadge, { backgroundColor: colors.primaryVariant }]}>
              <Image
                source={IMAGES.LOGO}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.brandTitle, { color: colors.primary }]}>LB Delivery</Text>
            <View style={[styles.superstorePill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.superstoreText, { color: colors.onSecondary }]}>PARTNER</Text>
            </View>

          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLocationOrLogoPress}
            style={styles.locationSelector}
          >
            <Ionicons
              name={addressIcon}
              size={13.5}
              color={colors.primary}
              style={styles.pinIcon}
            />

            <Text
              style={[
                styles.locationText,
                { color: isAuthenticated ? colors.textPrimary : colors.primary },
              ]}
              numberOfLines={1}
            >
              {displayAddress}
            </Text>

            <Ionicons
              name={isAuthenticated ? 'chevron-down' : 'chevron-forward'}
              size={12}
              color={colors.primary}
              style={styles.dropdownChevron}
            />
          </TouchableOpacity>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {/* Quick Theme Toggle Icon */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDark ? colors.secondary : colors.primary}
            />
          </TouchableOpacity>

          {/* User Profile */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
            onPress={onPressProfile}
            activeOpacity={0.8}
          >
            {isAuthenticated && user?.name ? (
              <Text style={[styles.profileInitial, { color: colors.primary }]}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>

          {/* Cart Button with Live Badge */}
          <TouchableOpacity
            style={[
              styles.cartBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.full,
              },
            ]}
            onPress={onPressCart}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color={colors.onPrimary} />
            {totalQuantity > 0 && (
              <View
                style={[
                  styles.cartBadge,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.cartBadgeText, { color: colors.onSecondary }]}>
                  {totalQuantity}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLocationSection: {
    flex: 1,
    marginRight: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  superstorePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  superstoreText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  loadingSpinner: {
    marginRight: 5,
  },
  pinIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '75%',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  dropdownChevron: {
    marginLeft: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileInitial: {
    fontSize: 15,
    fontWeight: '800',
  },
  cartBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  cartBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
