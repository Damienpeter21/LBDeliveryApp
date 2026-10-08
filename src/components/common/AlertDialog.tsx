// src/components/common/AlertDialog.tsx
import React from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';

export type AlertDialogType = 'success' | 'error' | 'reject' | 'warning' | 'info' | 'confirm';

export interface AlertDialogOptions {
  type?: AlertDialogType;
  title: string;
  message: string;
  buttonText?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  iconName?: string;
  closeOnBackdrop?: boolean;
}

interface AlertDialogProps {
  visible: boolean;
  options: AlertDialogOptions | null;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const AlertDialog: React.FC<AlertDialogProps> = ({ visible, options, onClose }) => {
  const { colors, borderRadius, isDark } = useTheme();

  if (!visible || !options) return null;

  const rawType = options.type || 'info';
  const type: 'success' | 'error' | 'warning' | 'info' | 'confirm' = rawType === 'reject' ? 'error' : rawType;
  const isConfirm = type === 'confirm' || !!options.cancelText;
  const allowBackdropClose = options.closeOnBackdrop !== false;

  const getVisualMeta = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#16A34A',
          bgColor: isDark ? 'rgba(22, 163, 74, 0.18)' : '#DCFCE7',
          btnColor: colors.primary,
          titleColor: colors.textPrimary,
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          iconColor: '#EF4444',
          bgColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
          btnColor: '#DC2626',
          titleColor: colors.textPrimary,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: '#F59E0B',
          bgColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
          btnColor: colors.primary,
          titleColor: colors.textPrimary,
        };
      case 'confirm':
        return {
          icon: options.isDestructive ? ('trash-outline' as const) : ('help-circle' as const),
          iconColor: options.isDestructive ? '#EF4444' : colors.primary,
          bgColor: options.isDestructive
            ? isDark
              ? 'rgba(239, 68, 68, 0.18)'
              : '#FEE2E2'
            : isDark
            ? 'rgba(46, 117, 89, 0.18)'
            : `${colors.primary}15`,
          btnColor: options.isDestructive ? '#DC2626' : colors.primary,
          titleColor: colors.textPrimary,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          iconColor: '#3B82F6',
          bgColor: isDark ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
          btnColor: colors.primary,
          titleColor: colors.textPrimary,
        };
    }
  };

  const meta = getVisualMeta();

  const handleConfirm = () => {
    onClose();
    if (options.onConfirm) {
      options.onConfirm();
    }
  };

  const handleCancel = () => {
    onClose();
    if (options.onCancel) {
      options.onCancel();
    }
  };

  const handleBackdropPress = () => {
    if (!allowBackdropClose) return;
    if (isConfirm) {
      handleCancel();
    } else {
      handleConfirm();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isConfirm ? handleCancel : handleConfirm}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.xl || 24,
                },
              ]}
            >
              {/* Icon Container with glowing badge */}
              <View style={[styles.iconCircle, { backgroundColor: meta.bgColor }]}>
                <Ionicons
                  name={options.iconName || meta.icon}
                  size={36}
                  color={meta.iconColor}
                />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: meta.titleColor }]}>
                {options.title}
              </Text>

              {/* Message */}
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {options.message}
              </Text>

              {/* Action Buttons */}
              {isConfirm ? (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleCancel}
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                      {options.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                    style={[
                      styles.confirmBtn,
                      {
                        backgroundColor: meta.btnColor,
                      },
                    ]}
                  >
                    <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>
                      {options.confirmText || 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirm}
                  style={[styles.singleBtn, { backgroundColor: meta.btnColor }]}
                >
                  <Text style={[styles.singleBtnText, { color: '#FFFFFF' }]}>
                    {options.buttonText || 'OK'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: Math.min(width - 48, 380),
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  singleBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  singleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
