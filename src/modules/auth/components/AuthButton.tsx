import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../../theme';

interface AuthButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  ...props
}) => {
  const { colors, borderRadius } = useTheme();

  const isOutline = variant === 'outline';
  const isSecondary = variant === 'secondary';

  const backgroundColor = isOutline
    ? 'transparent'
    : isSecondary
    ? colors.surfaceVariant
    : disabled
    ? colors.surfaceVariant
    : colors.primary;

  const textColor = isOutline
    ? colors.primary
    : isSecondary
    ? colors.textPrimary
    : disabled
    ? colors.textTertiary
    : colors.onPrimary;

  const borderColor = isOutline ? colors.primary : 'transparent';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth: isOutline ? 1.5 : 0,
          borderRadius: borderRadius.md,
          shadowColor: disabled || isOutline ? 'transparent' : colors.primary,
          shadowOpacity: disabled || isOutline ? 0 : 0.25,
          elevation: disabled || isOutline ? 0 : 3,
        },
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.85}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
