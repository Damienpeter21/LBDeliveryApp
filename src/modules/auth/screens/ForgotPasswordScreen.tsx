import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';
import { AuthButton } from '../components/AuthButton';
import { AuthInput } from '../components/AuthInput';
import { AuthLogo } from '../components/AuthLogo';
import { useAuth } from '../hooks/useAuth';

interface ForgotPasswordScreenProps {
  onNavigateToLogin?: () => void;
  onNavigateToResetPassword?: (email?: string) => void;
  onResetSuccess?: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigateToLogin,
  onNavigateToResetPassword,
  onResetSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();

  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { forgotPassword, isLoading, error } = useAuth();

  const handleResetPassword = async () => {
    if (!email) return;
    const success = await forgotPassword(email);
    if (success) {
      setIsSubmitted(true);
      if (onResetSuccess) {
        onResetSuccess();
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 20),
            paddingBottom: Math.max(insets.bottom + 20, 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Nav Row */}
        <View style={styles.topNavRow}>
          {onNavigateToLogin ? (
            <TouchableOpacity
              onPress={onNavigateToLogin}
              activeOpacity={0.7}
              style={[styles.backBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}

          <View style={styles.badgePill}>
            <Text style={[styles.badgePillText, { color: colors.primary }]}>RECOVERY</Text>
          </View>
        </View>

        {/* Brand Logo Header */}
        <AuthLogo size="medium" tagline="Recover your account and access your orders" />

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Reset Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the email address associated with your LB Delivery account and we'll send you a password reset link.
          </Text>
        </View>

        {isSubmitted ? (
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.secondary,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              Check Your Inbox
            </Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              We have sent password recovery instructions to <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{email}</Text>.
            </Text>
            <AuthButton
              title="Return to Sign In"
              onPress={onNavigateToLogin}
              style={{ marginTop: 20, width: '100%' }}
            />
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <AuthInput
              label="Email Address"
              iconName="mail-outline"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={error || undefined}
            />

            <AuthButton
              title="Send Reset Link"
              loading={isLoading}
              disabled={!email}
              onPress={handleResetPassword}
            />

            {onNavigateToResetPassword && (
              <TouchableOpacity
                onPress={() => onNavigateToResetPassword(email)}
                style={{ marginTop: 14, alignSelf: 'center' }}
              >
                <Text style={[styles.footerLink, { color: colors.secondary, fontSize: 13 }]}>
                  Have a reset code? Set New Password ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {onNavigateToLogin && !isSubmitted && (
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Remember your password?
            </Text>
            <TouchableOpacity onPress={onNavigateToLogin}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  successCard: {
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
});
