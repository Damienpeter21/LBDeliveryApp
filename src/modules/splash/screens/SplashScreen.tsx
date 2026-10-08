import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { IMAGES } from '../../../assets';
import { useTheme } from '../../../theme';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { colors, borderRadius } = useTheme();

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Finish splash after 2.2 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 2200);

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [onFinish, opacityAnim, pulseAnim, scaleAnim]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Decorative Rings */}
      <View
        style={[
          styles.decorativeRing,
          {
            borderColor: colors.surfaceVariant,
            width: width * 1.2,
            height: width * 1.2,
            borderRadius: (width * 1.2) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.decorativeRing,
          {
            borderColor: colors.surfaceVariant,
            width: width * 0.9,
            height: width * 0.9,
            borderRadius: (width * 0.9) / 2,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Animated Brand Logo in PrimaryVariant Backdrop */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: colors.primaryVariant,
              borderColor: colors.secondary,
              borderRadius: borderRadius.full,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={IMAGES.LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Title Row */}
        <View style={styles.titleRow}>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>LB Delivery</Text>
          <View style={[styles.superstorePill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.superstoreText, { color: colors.onSecondary }]}>PARTNER</Text>
          </View>
        </View>

        {/* Subtitle */}
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Fast • Reliable • Delivery Partner App
        </Text>

        {/* Delivery Partner Badges */}
        <View style={[styles.badgeContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.badgeItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: colors.textPrimary }]}>Verified Partner</Text>
          </View>
          <View style={[styles.badgeDivider, { backgroundColor: colors.border }]} />
          <View style={styles.badgeItem}>
            <Ionicons name="flash-outline" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: colors.textPrimary }]}>Fast Delivery</Text>
          </View>
          <View style={[styles.badgeDivider, { backgroundColor: colors.border }]} />
          <View style={styles.badgeItem}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: colors.textPrimary }]}>Instant COD</Text>
          </View>
        </View>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          LB Delivery Partner Application
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  contentWrapper: {
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    padding: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  superstorePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  superstoreText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  tagline: {
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 28,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 34,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
