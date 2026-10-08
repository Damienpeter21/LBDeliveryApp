import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';

interface GoogleSignInButtonProps {
  title?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Official Google Identity Services Standard Button
 * Implements Google's Brand Guidelines for "Continue with Google" / "Sign in with Google"
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  title = 'Continue with Google',
  onPress,
  loading = false,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
          borderColor: isDark ? '#3C4043' : '#DADCE0',
          shadowColor: '#000000',
        },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <View style={styles.contentRow}>
          {/* Authentic Google 'G' Multi-Color Emblem */}
          <View style={styles.logoContainer}>
            <View style={styles.googleIconWrapper}>
              <Ionicons name="logo-google" size={19} color="#EA4335" />
            </View>
          </View>

          {/* Standard Text */}
          <Text
            style={[
              styles.buttonText,
              {
                color: isDark ? '#E8EAED' : '#3C4043',
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 24, // Google Standard Pill Style
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  disabled: {
    opacity: 0.55,
  },
});
