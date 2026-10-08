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

interface ResetPasswordScreenProps {
  initialEmail?: string;
  onNavigateToLogin?: () => void;
  onResetSuccess?: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  initialEmail = '',
  onNavigateToLogin,
  onResetSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();

  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { resetPassword, isLoading, error } = useAuth();

  const handleReset = async () => {
    setValidationError(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setValidationError('Email is required');
      return;
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    const success = await resetPassword(trimmedEmail);
    if (success) {
      setIsSuccess(true);
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
        {/* Top Navigation Row */}
        <View style={styles.topNavRow}>
          {onNavigateToLogin ? (
            <TouchableOpacity
              onPress={onNavigateToLogin}
              activeOpacity={0.7}
              style={[
                styles.backBtn,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}

          <View style={[styles.badgePill, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.badgePillText, { color: colors.primary }]}>NEW PASSWORD</Text>
          </View>
        </View>

        {/* Brand Logo Header */}
        <AuthLogo size="medium" tagline="Set a new secure password for your account" />

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Confirm Reset
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Confirm your registered email to reset your credentials and secure your account.
          </Text>
        </View>

        {isSuccess ? (
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
            <Ionicons
              name="checkmark-circle"
              size={52}
              color={colors.primary}
              style={{ marginBottom: 12 }}
            />
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              Password Reset Complete!
            </Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              Your account password request for <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{email}</Text> has been processed successfully by Odoo. You can now sign in.
            </Text>
            <AuthButton
              title="Proceed to Sign In"
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
              label="Registered Email"
              iconName="mail-outline"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <AuthInput
              label="New Password"
              iconName="lock-closed-outline"
              placeholder="Enter new password (optional)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <AuthInput
              label="Confirm New Password"
              iconName="shield-checkmark-outline"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={validationError || error || undefined}
            />

            <AuthButton
              title="Reset Password Now"
              loading={isLoading}
              disabled={!email.trim()}
              onPress={handleReset}
            />
          </View>
        )}

        {onNavigateToLogin && !isSuccess && (
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Remembered your password?
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
    textAlign: 'center',
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
