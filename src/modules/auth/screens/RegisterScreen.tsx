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

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onRegisterSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('Bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [city, setCity] = useState('Hosur');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { register, isLoading, error, clearError } = useAuth();

  const handleRegister = async () => {
    setValidationError(null);
    if (!name || !email || !password || !confirmPassword) {
      setValidationError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    const success = await register({
      name,
      email,
      phone: phone || '+919843012345',
      password,
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber || 'TN70CC7890',
      license_number: licenseNumber || 'TN7020230007890',
      city: city || 'Hosur',
    });

    if (success && onRegisterSuccess) {
      onRegisterSuccess();
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

          <View style={[styles.badgePill, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.badgePillText, { color: colors.primary }]}>DELIVERY PARTNER SIGNUP</Text>
          </View>
        </View>

        {/* Brand Logo Header */}
        <AuthLogo size="medium" tagline="Join LB Delivery Fleet • Earn on Every Order" />

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
          <Text style={[styles.sectionHeading, { color: colors.primary }]}>Personal Details</Text>

          <AuthInput
            label="Full Name"
            iconName="person-outline"
            placeholder="e.g. Prabhu Deva"
            value={name}
            onChangeText={text => {
              setName(text);
              if (error) clearError();
              if (validationError) setValidationError(null);
            }}
            autoCapitalize="words"
          />

          <AuthInput
            label="Email Address"
            iconName="mail-outline"
            placeholder="driver@example.com"
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (error) clearError();
              if (validationError) setValidationError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <AuthInput
            label="Phone Number"
            iconName="call-outline"
            placeholder="+91 98430 12345"
            value={phone}
            onChangeText={text => {
              setPhone(text);
              if (error) clearError();
              if (validationError) setValidationError(null);
            }}
            keyboardType="phone-pad"
          />

          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 12 }]}>Vehicle & City Details</Text>

          <AuthInput
            label="Vehicle Type"
            iconName="bicycle-outline"
            placeholder="Bike / Scooty / EV"
            value={vehicleType}
            onChangeText={setVehicleType}
          />

          <AuthInput
            label="Vehicle Number"
            iconName="car-outline"
            placeholder="e.g. TN70CC7890"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
          />

          <AuthInput
            label="Driving License Number"
            iconName="card-outline"
            placeholder="e.g. TN7020230007890"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
          />

          <AuthInput
            label="Delivery City / Hub"
            iconName="location-outline"
            placeholder="e.g. Hosur"
            value={city}
            onChangeText={setCity}
          />

          <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 12 }]}>Security</Text>

          <AuthInput
            label="Password"
            iconName="lock-closed-outline"
            placeholder="At least 4 characters"
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (error) clearError();
              if (validationError) setValidationError(null);
            }}
            secureTextEntry
          />

          <AuthInput
            label="Confirm Password"
            iconName="shield-checkmark-outline"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={text => {
              setConfirmPassword(text);
              if (error) clearError();
              if (validationError) setValidationError(null);
            }}
            secureTextEntry
            error={validationError || error || undefined}
          />

          <AuthButton
            title="Register as Delivery Partner"
            loading={isLoading}
            disabled={!name || !email || !password || !confirmPassword}
            onPress={handleRegister}
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
    marginBottom: 8,
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
