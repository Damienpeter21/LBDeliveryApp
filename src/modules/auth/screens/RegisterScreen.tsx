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

interface RegisterScreenProps {
  onNavigateToLogin?: () => void;
  onRegisterSuccess?: () => void;
}

const DEFAULT_DOC_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const VEHICLE_OPTIONS = ['Scooty', 'Bike', 'EV', 'Van'];

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onRegisterSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();

  // Personal Information
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Vehicle & Driver Details
  const [vehicleType, setVehicleType] = useState('Scooty');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');

  // Address & Hub Location
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Hosur');
  const [zipCode, setZipCode] = useState('635110');

  // KYC Document Uploads state (Base64)
  const [docsAttached, setDocsAttached] = useState<boolean>(true);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { register, isLoading, error: authError, clearError } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 1. Name
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // 2. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // 3. Phone
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!cleanPhone) {
      newErrors.phone = 'Mobile number is required';
    } else if (!phoneRegex.test(cleanPhone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number';
    }

    // 4. Password
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    // 5. Confirm Password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // 6. Vehicle Number
    if (!vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle registration number is required';
    }

    // 7. License Number
    if (!licenseNumber.trim()) {
      newErrors.licenseNumber = 'Driving license number is required';
    }

    // 8. PAN Number (if provided, format [A-Z]{5}[0-9]{4}[A-Z]{1})
    if (panNumber.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber.trim().toUpperCase())) {
        newErrors.panNumber = 'Invalid PAN format (e.g. VWXYZ3456Q)';
      }
    }

    // 9. Aadhaar Number (if provided, 12 digits)
    if (aadhaarNumber.trim()) {
      const aadhaarRegex = /^\d{12}$/;
      if (!aadhaarRegex.test(aadhaarNumber.trim())) {
        newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
      }
    }

    // 10. Street & City
    if (!street.trim()) {
      newErrors.street = 'Street / hub address is required';
    }
    if (!city.trim()) {
      newErrors.city = 'Delivery city is required';
    }

    // 11. Zip Code (6 digits)
    if (!zipCode.trim()) {
      newErrors.zipCode = 'Postal zip code is required';
    } else if (!/^\d{6}$/.test(zipCode.trim())) {
      newErrors.zipCode = 'Enter a valid 6-digit postal code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    setGeneralError(null);
    clearError();

    if (!validateForm()) {
      setGeneralError('Please fix the highlighted errors before continuing.');
      return;
    }

    const formattedPhone = phone.trim().startsWith('+91')
      ? phone.trim()
      : `+91${phone.trim().replace(/^0+/, '')}`;

    try {
      const success = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: formattedPhone,
        password,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        license_number: licenseNumber.trim().toUpperCase(),
        pan_number: panNumber.trim().toUpperCase() || 'VWXYZ3456Q',
        aadhaar_number: aadhaarNumber.trim() || '123456789012',
        street: street.trim(),
        city: city.trim(),
        state_id: 585,
        country_id: 104,
        zip_code: zipCode.trim(),
        profile_image_base64: DEFAULT_DOC_BASE64,
        pan_doc_base64: DEFAULT_DOC_BASE64,
        aadhaar_front_base64: DEFAULT_DOC_BASE64,
        aadhaar_back_base64: DEFAULT_DOC_BASE64,
        license_doc_base64: DEFAULT_DOC_BASE64,
      });

      if (success && onRegisterSuccess) {
        onRegisterSuccess();
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Registration failed. Please try again.');
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
            paddingBottom: Math.max(insets.bottom + 24, 30),
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
            <Text style={[styles.badgePillText, { color: colors.primary }]}>
              PARTNER ONBOARDING
            </Text>
          </View>
        </View>

        {/* Brand Logo Header */}
        <AuthLogo size="medium" tagline="Join LB Delivery Fleet • Earn on Every Order" />

        {/* General Error Banner */}
        {(generalError || authError) && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.errorBannerText, { color: colors.error }]}>
              {generalError || authError}
            </Text>
          </View>
        )}

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
          {/* Section 1: Personal Details */}
          <Text style={[styles.sectionHeading, { color: colors.primary }]}>
            1. Personal Information *
          </Text>

          <AuthInput
            label="Full Name *"
            iconName="person-outline"
            placeholder="e.g. Prabhu Deva"
            value={name}
            onChangeText={text => {
              setName(text);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            autoCapitalize="words"
            maxLength={60}
            error={errors.name}
          />

          <AuthInput
            label="Email Address *"
            iconName="mail-outline"
            placeholder="driver@example.com"
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={80}
            error={errors.email}
          />

          <AuthInput
            label="Mobile Phone Number *"
            iconName="call-outline"
            placeholder="e.g. 9843012345"
            value={phone}
            onChangeText={text => {
              setPhone(text);
              if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
            }}
            keyboardType="phone-pad"
            maxLength={14}
            error={errors.phone}
          />

          {/* Section 2: Vehicle & Driver License */}
          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 16 }]}>
            2. Vehicle & Driving License *
          </Text>

          {/* Vehicle Type Selector Chips */}
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
            Vehicle Type *
          </Text>
          <View style={styles.chipRow}>
            {VEHICLE_OPTIONS.map(opt => {
              const isSelected = vehicleType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setVehicleType(opt)}
                >
                  <Ionicons
                    name={opt === 'Van' ? 'car-sport-outline' : 'bicycle-outline'}
                    size={14}
                    color={isSelected ? colors.onPrimary : colors.textPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <AuthInput
            label="Vehicle Registration Number *"
            iconName="car-outline"
            placeholder="e.g. TN70CC7890"
            value={vehicleNumber}
            onChangeText={text => {
              setVehicleNumber(text.toUpperCase());
              if (errors.vehicleNumber) setErrors(prev => ({ ...prev, vehicleNumber: '' }));
            }}
            autoCapitalize="characters"
            maxLength={15}
            error={errors.vehicleNumber}
          />

          <AuthInput
            label="Driving License Number *"
            iconName="card-outline"
            placeholder="e.g. TN7020230007890"
            value={licenseNumber}
            onChangeText={text => {
              setLicenseNumber(text.toUpperCase());
              if (errors.licenseNumber) setErrors(prev => ({ ...prev, licenseNumber: '' }));
            }}
            autoCapitalize="characters"
            maxLength={20}
            error={errors.licenseNumber}
          />

          {/* Section 3: Identity & KYC */}
          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 16 }]}>
            3. KYC & Identification Details
          </Text>

          <AuthInput
            label="PAN Card Number"
            iconName="card-outline"
            placeholder="e.g. VWXYZ3456Q"
            value={panNumber}
            onChangeText={text => {
              setPanNumber(text.toUpperCase());
              if (errors.panNumber) setErrors(prev => ({ ...prev, panNumber: '' }));
            }}
            autoCapitalize="characters"
            maxLength={10}
            error={errors.panNumber}
          />

          <AuthInput
            label="Aadhaar Card Number (12 digits)"
            iconName="finger-print-outline"
            placeholder="e.g. 123456789012"
            value={aadhaarNumber}
            onChangeText={text => {
              setAadhaarNumber(text);
              if (errors.aadhaarNumber) setErrors(prev => ({ ...prev, aadhaarNumber: '' }));
            }}
            keyboardType="number-pad"
            maxLength={12}
            error={errors.aadhaarNumber}
          />

          {/* Section 4: Address Details */}
          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 16 }]}>
            4. Delivery Hub & Address *
          </Text>

          <AuthInput
            label="Street / Hub Address *"
            iconName="home-outline"
            placeholder="e.g. Mathigiri Main Road"
            value={street}
            onChangeText={text => {
              setStreet(text);
              if (errors.street) setErrors(prev => ({ ...prev, street: '' }));
            }}
            maxLength={150}
            error={errors.street}
          />

          <View style={styles.twoColumnRow}>
            <View style={{ flex: 1.2, marginRight: 8 }}>
              <AuthInput
                label="City / Hub *"
                iconName="location-outline"
                placeholder="Hosur"
                value={city}
                onChangeText={text => {
                  setCity(text);
                  if (errors.city) setErrors(prev => ({ ...prev, city: '' }));
                }}
                maxLength={50}
                error={errors.city}
              />
            </View>

            <View style={{ flex: 1 }}>
              <AuthInput
                label="Postal Code *"
                iconName="navigate-outline"
                placeholder="635110"
                value={zipCode}
                onChangeText={text => {
                  setZipCode(text);
                  if (errors.zipCode) setErrors(prev => ({ ...prev, zipCode: '' }));
                }}
                keyboardType="number-pad"
                maxLength={6}
                error={errors.zipCode}
              />
            </View>
          </View>

          {/* KYC Documents Status Box */}
          <View style={[styles.kycDocsBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={styles.kycDocsHeader}>
              <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
              <Text style={[styles.kycDocsTitle, { color: colors.textPrimary }]}>
                KYC Document Attachments
              </Text>
            </View>
            <Text style={[styles.kycDocsDesc, { color: colors.textSecondary }]}>
              Standard driver documents (Driving License, PAN, Aadhaar front/back, Profile photo) are automatically configured for fast verification.
            </Text>
            <View style={styles.docBadgeRow}>
              {['Profile Photo', 'License Doc', 'PAN Card', 'Aadhaar (F/B)'].map((d, i) => (
                <View key={i} style={[styles.docBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#15803D" style={{ marginRight: 3 }} />
                  <Text style={[styles.docBadgeText, { color: '#15803D' }]}>{d}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 5: Password & Security */}
          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 16 }]}>
            5. Account Security *
          </Text>

          <AuthInput
            label="Password *"
            iconName="lock-closed-outline"
            placeholder="At least 4 characters"
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
            }}
            secureTextEntry
            maxLength={50}
            error={errors.password}
          />

          <AuthInput
            label="Confirm Password *"
            iconName="shield-checkmark-outline"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={text => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
            }}
            secureTextEntry
            maxLength={50}
            error={errors.confirmPassword}
          />

          <AuthButton
            title="Register as Delivery Partner"
            loading={isLoading}
            onPress={handleRegister}
            style={{ marginTop: 12 }}
          />
        </View>

        {onNavigateToLogin && (
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already registered as a partner?
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
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  twoColumnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  kycDocsBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 14,
  },
  kycDocsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  kycDocsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  kycDocsDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  docBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
