// src/components/common/StatusModal.tsx
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';

export type StatusModalType = 'success' | 'error' | 'reject' | 'warning' | 'info' | 'confirm';

export interface StatusModalOptions {
  type?: StatusModalType;
  title: string;
  message: string;
  buttonText?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  iconName?: string;
}

interface StatusModalProps {
  visible: boolean;
  options: StatusModalOptions | null;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const StatusModal: React.FC<StatusModalProps> = ({ visible, options, onClose }) => {
  const { colors, borderRadius } = useTheme();

  if (!visible || !options) return null;

  const rawType = options.type || 'info';
  const type = rawType === 'reject' ? 'error' : rawType;
  const isConfirm = type === 'confirm' || !!options.cancelText;

  const getVisualMeta = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#16A34A',
          bgColor: '#DCFCE7',
          btnColor: colors.primary,
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          iconColor: '#DC2626',
          bgColor: '#FEE2E2',
          btnColor: '#DC2626',
        };
      case 'warning':
      case 'confirm':
        return {
          icon: 'alert-circle' as const,
          iconColor: options.isDestructive ? '#DC2626' : '#D97706',
          bgColor: options.isDestructive ? '#FEE2E2' : '#FEF3C7',
          btnColor: options.isDestructive ? '#DC2626' : colors.primary,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          iconColor: '#2563EB',
          bgColor: '#DBEAFE',
          btnColor: colors.primary,
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isConfirm ? handleCancel : handleConfirm}
    >
      <TouchableWithoutFeedback onPress={isConfirm ? handleCancel : handleConfirm}>
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
              {/* Icon Container */}
              <View style={[styles.iconCircle, { backgroundColor: meta.bgColor }]}>
                <Ionicons name={options.iconName || meta.icon} size={38} color={meta.iconColor} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.textPrimary }]}>
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
                    activeOpacity={0.7}
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
                    activeOpacity={0.8}
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
                  activeOpacity={0.8}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 6,
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
    shadowOpacity: 0.1,
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  singleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
