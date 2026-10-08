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
import { GOOGLE_SETTINGS } from '../../../app/config';
import { useTheme } from '../../../theme';
import { AuthButton } from '../components/AuthButton';
import { AuthInput } from '../components/AuthInput';
import { AuthLogo } from '../components/AuthLogo';
import { GoogleAccountPickerModal } from '../components/GoogleAccountPickerModal';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/useAuth';

interface LoginScreenProps {
  onNavigateToRegister?: () => void;
  onNavigateToForgotPassword?: () => void;
  onLoginSuccess?: () => void;
  onBack?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return;
    const success = await login({ email, password });
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleGoogleSignInPress = () => {
    setShowGooglePicker(true);
  };

  const handleSelectGoogleAccount = async (account: {
    email: string;
    name?: string;
    password?: string;
  }) => {
    const success = await loginWithGoogle(account);
    if (success) {
      setShowGooglePicker(false);
      if (onLoginSuccess) {
        onLoginSuccess();
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
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}

          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.skipPill}>
              <Text style={[styles.skipText, { color: colors.primary }]}>Skip for now ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Brand Logo Header */}
        <AuthLogo size="large" tagline="Sign in for exclusive deals, orders & fast checkout" />

        {/* Trust Badges */}
        <View style={[styles.trustRow, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.trustText, { color: colors.textPrimary }]}>100% Genuine</Text>
          </View>
          <View style={[styles.trustDivider, { backgroundColor: colors.border }]} />
          <View style={styles.trustItem}>
            <Ionicons name="flash-outline" size={14} color={colors.secondary} style={{ marginRight: 4 }} />
            <Text style={[styles.trustText, { color: colors.textPrimary }]}>Express Delivery</Text>
          </View>
          <View style={[styles.trustDivider, { backgroundColor: colors.border }]} />
          <View style={styles.trustItem}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.trustText, { color: colors.textPrimary }]}>Easy Returns</Text>
          </View>
        </View>

        {/* Form Card */}
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
            onChangeText={text => {
              setEmail(text);
              if (error) clearError();
            }}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <AuthInput
            label="Password"
            iconName="lock-closed-outline"
            placeholder="Enter your password"
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (error) clearError();
            }}
            secureTextEntry
            hasError={!!error}
          />

          {/* ── Login Error Banner ──────────────────────────────────────────
              Shown when the API returns an error (e.g. wrong credentials).
              Displayed as a banner so the message is impossible to miss.
              Does NOT affect the login flow — error is already in context.
          ────────────────────────────────────────────────── */}
          {!!error && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${colors.error}12`, borderColor: `${colors.error}40` },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={16}
                color={colors.error}
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {onNavigateToForgotPassword && (
            <TouchableOpacity
              onPress={onNavigateToForgotPassword}
              style={styles.forgotPassBtn}
            >
              <Text style={[styles.forgotPassText, { color: colors.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}

          <AuthButton
            title="Sign In to LB Delivery"
            loading={isLoading}
            disabled={!email || !password}
            onPress={handleLogin}
          />

          {/* Social Google Sign In Option - Commented per request */}
          {/* {Boolean(GOOGLE_SETTINGS.androidClientId) && (
            <>
              <View style={styles.socialDividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
                <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              </View>

              <GoogleSignInButton
                title="Continue with Google"
                loading={isLoading}
                onPress={handleGoogleSignInPress}
              />
            </>
          )} */}
        </View>

        {/* Switch to Register */}
        {onNavigateToRegister && (
          <View style={styles.registerPrompt}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
              Don't have a partner account?
            </Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={[styles.registerLink, { color: colors.primary }]}>
                Register as Delivery Partner
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Disclaimer Terms */}
        <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
          By continuing, you agree to LB Delivery Terms of Service & Privacy Policy
        </Text>
      </ScrollView>

      {/* Google Identity Services Account Picker Modal */}
      <GoogleAccountPickerModal
        visible={showGooglePicker}
        loading={isLoading}
        onClose={() => setShowGooglePicker(false)}
        onSelectAccount={handleSelectGoogleAccount}
      />
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
    marginBottom: 20,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  skipPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerSection: {
    marginBottom: 16,
  },
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  organicPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  organicText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mainHeadline: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 6,
  },
  subHeadline: {
    fontSize: 14,
    lineHeight: 20,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trustDivider: {
    width: 1,
    height: 14,
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
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotPassText: {
    fontSize: 13,
    fontWeight: '700',
  },
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
  // ── Login Error Banner ─────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
});
