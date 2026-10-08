import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import { NetworkHelper } from '../../app/utils/NetworkHelper';

export interface NoInternetScreenProps {
  onRetry?: () => any;
  isOverlay?: boolean;
}

export const NoInternetScreen: React.FC<NoInternetScreenProps> = ({
  onRetry,
  isOverlay = false,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();
  const [retrying, setRetrying] = useState<boolean>(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      if (onRetry) {
        await Promise.resolve(onRetry());
      } else {
        await NetworkHelper.isInternetConnected();
      }
    } finally {
      setTimeout(() => setRetrying(false), 800);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 20, 40),
          paddingBottom: Math.max(insets.bottom + 20, 30),
        },
      ]}
    >
      <View style={styles.centerContent}>
        {/* Themed Double Concentric Halo Offline Emblem */}
        <View style={styles.emblemContainer}>
          <View
            style={[
              styles.outerHalo,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.innerHalo,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="cloud-offline-outline" size={54} color={colors.primary} />

              {/* Alert Warning Dot */}
              <View
                style={[
                  styles.offlineBadge,
                  { backgroundColor: colors.error, borderColor: colors.surface },
                ]}
              >
                <Ionicons name="alert" size={14} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>

        {/* Title & Description */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          No Internet Connection
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          You appear to be offline. Please verify your Wi-Fi or mobile data network to continue browsing fresh groceries.
        </Text>

        {/* Troubleshooting Checklist Card */}
        <View
          style={[
            styles.tipsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>
            Quick Troubleshooting
          </Text>

          <View style={styles.tipRow}>
            <View style={[styles.tipIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="wifi-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Check if your Wi-Fi or Mobile Data is turned on
            </Text>
          </View>

          <View style={styles.tipRow}>
            <View style={[styles.tipIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="airplane-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Make sure Airplane Mode is disabled
            </Text>
          </View>

          <View style={[styles.tipRow, { marginBottom: 0 }]}>
            <View style={[styles.tipIconBox, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="refresh-circle-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Restart router or toggle mobile data off and on
            </Text>
          </View>
        </View>
      </View>

      {/* Try Again CTA Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleRetry}
          disabled={retrying}
          style={[
            styles.retryButton,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          {retrying ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>
                Checking Connection...
              </Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="refresh" size={18} color={colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>
                Try Again
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerHalo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  offlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: '90%',
    marginBottom: 28,
  },
  tipsCard: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipText: {
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  actionContainer: {
    width: '100%',
    paddingTop: 16,
  },
  retryButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
