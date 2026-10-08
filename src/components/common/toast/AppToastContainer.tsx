import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast, { BaseToastProps, ToastConfig } from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TOAST_POSITION } from './appToast';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type AppToastContentProps = BaseToastProps & {
  variant: ToastVariant;
};

const toastTheme = {
  success: {
    background: '#ECFDF3',
    border: '#12B76A',
    iconBackground: '#D1FADF',
    iconColor: '#039855',
    textColor: '#344054',
    icon: '✓',
  },
  error: {
    background: '#FEF3F2',
    border: '#F04438',
    iconBackground: '#FEE4E2',
    iconColor: '#D92D20',
    textColor: '#344054',
    icon: '!',
  },
  warning: {
    background: '#FFFAEB',
    border: '#F79009',
    iconBackground: '#FEF0C7',
    iconColor: '#DC6803',
    textColor: '#344054',
    icon: '!',
  },
  info: {
    background: '#EFF8FF',
    border: '#2E90FA',
    iconBackground: '#D1E9FF',
    iconColor: '#1570EF',
    textColor: '#344054',
    icon: 'i',
  },
};

const AppToastContent = ({ text1, variant = 'info' }: { text1?: string; variant: ToastVariant }) => {
  const theme = toastTheme[variant] || toastTheme.info;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderLeftColor: theme.border,
        },
      ]}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: theme.iconBackground }]}
      >
        <Text style={[styles.icon, { color: theme.iconColor }]}>{theme.icon}</Text>
      </View>

      <Text
        style={[styles.message, { color: theme.textColor }]}
        numberOfLines={4}
      >
        {text1}
      </Text>
    </View>
  );
};

export const appToastConfig: any = {
  success: (props: any) => <AppToastContent {...props} variant="success" />,
  error: (props: any) => <AppToastContent {...props} variant="error" />,
  warning: (props: any) => <AppToastContent {...props} variant="warning" />,
  info: (props: any) => <AppToastContent {...props} variant="info" />,
};


const AppToastContainer = () => {
  const insets = useSafeAreaInsets();

  return (
    <Toast
      config={appToastConfig}
      position={APP_TOAST_POSITION}
      topOffset={Math.max(insets.top, 12) + 8}
      bottomOffset={Math.max(insets.bottom, 12) + 8}
    />
  );
};

export default AppToastContainer;

const styles = StyleSheet.create({
  container: {
    width: '92%',
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
