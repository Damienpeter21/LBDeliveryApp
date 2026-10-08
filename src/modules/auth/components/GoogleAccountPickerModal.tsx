import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { storage } from '../../../storage';
import { useTheme } from '../../../theme';

export interface GoogleAccount {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  isCustom?: boolean;
}

interface GoogleAccountPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (account: { email: string; name?: string; password?: string }) => Promise<void> | void;
  loading?: boolean;
}

const STORAGE_LAST_GOOGLE_ACCOUNT = 'LAST_GOOGLE_ACCOUNT';

export const GoogleAccountPickerModal: React.FC<GoogleAccountPickerModalProps> = ({
  visible,
  onClose,
  onSelectAccount,
  loading = false,
}) => {
  const { colors, isDark } = useTheme();
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [showManualInput, setShowManualInput] = useState<boolean>(true);
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Load last used Google account from persistent storage
  useEffect(() => {
    if (!visible) {
      setShowManualInput(accounts.length === 0);
      setCustomEmail('');
      setCustomPassword('');
      setShowPassword(false);
      setCustomName('');
      setInputError(null);
      setSelectedAccountId(null);
      return;
    }

    const loadStoredAccount = async () => {
      try {
        const stored = await storage.getJson<GoogleAccount>(STORAGE_LAST_GOOGLE_ACCOUNT);
        if (stored?.email) {
          setAccounts([{ ...stored, id: 'last_used' }]);
          setShowManualInput(false);
        } else {
          setAccounts([]);
          setShowManualInput(true);
        }
      } catch (_) {
        setAccounts([]);
        setShowManualInput(true);
      }
    };

    loadStoredAccount();
  }, [visible]);

  const handleChoose = async (account: {
    email: string;
    name?: string;
    password?: string;
    id?: string;
  }) => {
    setSelectedAccountId(account.id || account.email);
    try {
      // Save chosen account to persistent storage for quick re-use
      await storage.setJson(STORAGE_LAST_GOOGLE_ACCOUNT, {
        id: 'last_used',
        name: account.name || account.email.split('@')[0],
        email: account.email,
      });
    } catch (_) {}

    await onSelectAccount({
      email: account.email,
      name: account.name,
      password: account.password,
    });
  };

  const handleManualSubmit = () => {
    const trimmedEmail = customEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setInputError('Please enter your Google email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setInputError('Please enter a valid email address (e.g. name@gmail.com)');
      return;
    }

    const trimmedPassword = customPassword.trim();
    if (!trimmedPassword) {
      setInputError('Please enter your password');
      return;
    }

    const resolvedName = customName.trim() || trimmedEmail.split('@')[0];
    handleChoose({
      email: trimmedEmail,
      password: trimmedPassword,
      name: resolvedName,
      id: 'manual',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={loading ? () => {} : onClose}
    >
      <TouchableWithoutFeedback onPress={loading ? () => {} : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: isDark ? '#202124' : '#FFFFFF',
                  borderColor: isDark ? '#3C4043' : '#E0E0E0',
                },
              ]}
            >
              {/* Top Handle bar */}
              <View style={styles.dragHandle} />

              {/* Google Identity Header */}
              <View style={styles.header}>
                <View style={styles.googleIconCircle}>
                  <Ionicons name="logo-google" size={24} color="#EA4335" />
                </View>
                <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#202124' }]}>
                  Choose an account
                </Text>
                <Text
                  style={[styles.subtitle, { color: isDark ? '#9AA0A6' : '#5F6368' }]}
                >
                  to continue to <Text style={styles.appNameHighlight}>LB Delivery</Text>
                </Text>

              </View>

              <ScrollView
                style={styles.scrollArea}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Account List */}
                <View style={styles.accountsList}>
                  {accounts.map(acc => {
                    const isSelected = selectedAccountId === acc.id || (loading && selectedAccountId === acc.email);
                    const initial = (acc.name || acc.email || 'G').charAt(0).toUpperCase();

                    return (
                      <TouchableOpacity
                        key={acc.id + acc.email}
                        activeOpacity={0.7}
                        disabled={loading}
                        onPress={() => handleChoose(acc)}
                        style={[
                          styles.accountRow,
                          {
                            borderBottomColor: isDark ? '#2D2F31' : '#F1F3F4',
                          },
                        ]}
                      >
                        <View style={[styles.avatarCircle, { backgroundColor: '#4285F4' }]}>
                          <Text style={styles.avatarText}>{initial}</Text>
                        </View>

                        <View style={styles.accountInfo}>
                          <View style={styles.nameRow}>
                            <Text
                              style={[
                                styles.accountName,
                                { color: isDark ? '#E8EAED' : '#202124' },
                              ]}
                              numberOfLines={1}
                            >
                              {acc.name}
                            </Text>
                            {acc.id === 'last_used' && (
                              <View style={styles.badgeLastUsed}>
                                <Text style={styles.badgeText}>Last used</Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.accountEmail,
                              { color: isDark ? '#9AA0A6' : '#5F6368' },
                            ]}
                            numberOfLines={1}
                          >
                            {acc.email}
                          </Text>
                        </View>

                        {isSelected && loading ? (
                          <ActivityIndicator size="small" color="#4285F4" />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={isDark ? '#5F6368' : '#BDC1C6'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* "Use another account" row */}
                  {!showManualInput ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={loading}
                      onPress={() => setShowManualInput(true)}
                      style={styles.useAnotherRow}
                    >
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: isDark ? '#303134' : '#F1F3F4',
                            borderColor: isDark ? '#5F6368' : '#DADCE0',
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Ionicons
                          name="person-add-outline"
                          size={18}
                          color={isDark ? '#E8EAED' : '#3C4043'}
                        />
                      </View>
                      <View style={styles.accountInfo}>
                        <Text
                          style={[
                            styles.useAnotherText,
                            { color: isDark ? '#8AB4F8' : '#1A73E8' },
                          ]}
                        >
                          Use another account
                        </Text>
                        <Text
                          style={[
                            styles.useAnotherSubtext,
                            { color: isDark ? '#9AA0A6' : '#5F6368' },
                          ]}
                        >
                          Sign in with a different Google email
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    /* Manual Google Email Input Container */
                    <View
                      style={[
                        styles.manualInputContainer,
                        {
                          backgroundColor: isDark ? '#2D2F31' : '#F8F9FA',
                          borderColor: inputError
                            ? '#D93025'
                            : isDark
                            ? '#3C4043'
                            : '#DADCE0',
                        },
                      ]}
                    >
                      <View style={styles.manualInputHeader}>
                        <Text
                          style={[
                            styles.manualInputTitle,
                            { color: isDark ? '#E8EAED' : '#202124' },
                          ]}
                        >
                          Enter your Google Account
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowManualInput(false);
                            setInputError(null);
                          }}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color={isDark ? '#9AA0A6' : '#5F6368'}
                          />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          styles.inputWrapper,
                          {
                            backgroundColor: isDark ? '#202124' : '#FFFFFF',
                            borderColor: isDark ? '#3C4043' : '#DADCE0',
                          },
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={isDark ? '#9AA0A6' : '#5F6368'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="your.email@gmail.com"
                          placeholderTextColor={isDark ? '#5F6368' : '#80868B'}
                          value={customEmail}
                          onChangeText={text => {
                            setCustomEmail(text);
                            if (inputError) setInputError(null);
                          }}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={[
                            styles.textInput,
                            { color: isDark ? '#FFFFFF' : '#202124' },
                          ]}
                        />
                      </View>

                      <View
                        style={[
                          styles.inputWrapper,
                          {
                            backgroundColor: isDark ? '#202124' : '#FFFFFF',
                            borderColor: isDark ? '#3C4043' : '#DADCE0',
                            marginTop: 8,
                          },
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={isDark ? '#9AA0A6' : '#5F6368'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="Enter your password"
                          placeholderTextColor={isDark ? '#5F6368' : '#80868B'}
                          value={customPassword}
                          onChangeText={text => {
                            setCustomPassword(text);
                            if (inputError) setInputError(null);
                          }}
                          secureTextEntry={!showPassword}
                          style={[
                            styles.textInput,
                            { color: isDark ? '#FFFFFF' : '#202124' },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={isDark ? '#9AA0A6' : '#5F6368'}
                          />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          styles.inputWrapper,
                          {
                            backgroundColor: isDark ? '#202124' : '#FFFFFF',
                            borderColor: isDark ? '#3C4043' : '#DADCE0',
                            marginTop: 8,
                          },
                        ]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color={isDark ? '#9AA0A6' : '#5F6368'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="Your Name (optional)"
                          placeholderTextColor={isDark ? '#5F6368' : '#80868B'}
                          value={customName}
                          onChangeText={setCustomName}
                          autoCapitalize="words"
                          style={[
                            styles.textInput,
                            { color: isDark ? '#FFFFFF' : '#202124' },
                          ]}
                        />
                      </View>

                      {inputError && (
                        <Text style={styles.errorText}>
                          <Ionicons name="alert-circle" size={13} color="#D93025" />{' '}
                          {inputError}
                        </Text>
                      )}

                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={loading}
                        onPress={handleManualSubmit}
                        style={[
                          styles.continueBtn,
                          {
                            backgroundColor: '#1A73E8',
                          },
                        ]}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.continueBtnText}>
                            Continue with this Google Account
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Privacy & Terms notice matching Google Identity guidelines */}
                <View style={styles.footnote}>
                  <Text
                    style={[styles.footnoteText, { color: isDark ? '#9AA0A6' : '#5F6368' }]}
                  >
                    To continue, Google will share your name, email address, and language preference
                    with LB Delivery.
                  </Text>

                </View>
              </ScrollView>

              {/* Bottom Cancel Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={loading}
                onPress={onClose}
                style={[
                  styles.cancelBtn,
                  {
                    borderTopColor: isDark ? '#3C4043' : '#E0E0E0',
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? '#E8EAED' : '#3C4043' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    maxHeight: '82%',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADCE0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  googleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13.5,
    marginTop: 4,
  },
  appNameHighlight: {
    fontWeight: '600',
  },
  scrollArea: {
    paddingHorizontal: 18,
  },
  accountsList: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  accountInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  badgeLastUsed: {
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#1A73E8',
    fontSize: 11,
    fontWeight: '600',
  },
  accountEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  useAnotherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  useAnotherText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  useAnotherSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  manualInputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
  },
  manualInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  manualInputTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  errorText: {
    color: '#D93025',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  continueBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footnote: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  footnoteText: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  cancelBtn: {
    borderTopWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
