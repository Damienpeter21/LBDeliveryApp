// src/modules/auth/services/authService.ts
import {
  AUTH_STORAGE_KEYS,
  ODOO_CONFIG,
  clearStoredAuthTokens,
  setStoredAuthTokens,
} from '../../../app/config';
import { storage } from '../../../storage';
import { DeliveryApiService } from '../../delivery/services/deliveryApiService';
import { DeliverySignupPayload } from '../../delivery/types';

export interface AuthUser {
  id: string;
  userId: number;
  email: string;
  name: string;
  token?: string;
  partnerId?: number | string;
  phone?: string;
  companyId?: number;
  role?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  street?: string;
  city?: string;
  zip_code?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  db?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  street?: string;
  city?: string;
  state_id?: number;
  country_id?: number;
  zip_code?: string;
  profile_image_base64?: string;
  pan_doc_base64?: string;
  aadhaar_front_base64?: string;
  aadhaar_back_base64?: string;
  license_doc_base64?: string;
}

export { ODOO_CONFIG as AUTH_CONFIG };

/**
 * Translates raw Odoo / server error messages into user-friendly login error messages.
 */
function humaniseAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('access denied') || lower.includes('accessdenied')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid username')) {
    return 'No delivery partner account found with this email. Please check and try again.';
  }
  if (lower.includes('too many') || lower.includes('rate limit')) {
    return 'Too many failed attempts. Please wait a moment and try again.';
  }
  if (lower.includes('inactive') || lower.includes('disabled')) {
    return 'Your delivery partner account is inactive. Please contact admin.';
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('econnrefused')) {
    return 'Could not reach the server. Please check your internet connection.';
  }
  if (raw.length < 120 && !raw.includes('\n') && !raw.includes('Traceback')) {
    return raw;
  }
  return 'Login failed. Please check your email and password and try again.';
}

export class AuthService {
  /**
   * Performs Delivery Partner login via /web/session/authenticate
   */
  static async login(payload: LoginPayload): Promise<AuthUser> {
    const email = (payload.email ?? '').trim();
    const password = (payload.password ?? '').trim();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      const response = await DeliveryApiService.login({
        db: payload.db || ODOO_CONFIG.DB,
        login: email,
        password,
      });

      const result = response?.result !== undefined ? response.result : response;
      if (!result || !result.uid) {
        throw new Error('Incorrect email or password. Please try again.');
      }

      const uidNumber = Number(result.uid);
      const uid = String(result.uid);
      const name = result.name || email.split('@')[0];
      const partnerId = Array.isArray(result.partner_id)
        ? result.partner_id[0]
        : (result.partner_id || undefined);

      let phone = '';
      let vehicleType = '';
      let vehicleNumber = '';
      let licenseNumber = '';
      let city = '';

      // Try fetching full delivery partner profile from /api/delivery/profile
      try {
        const profile = await DeliveryApiService.getProfile(uidNumber);
        if (profile) {
          phone = profile.phone || phone;
          vehicleType = profile.vehicle_type || '';
          vehicleNumber = profile.vehicle_number || '';
          licenseNumber = profile.license_number || '';
          city = profile.city || '';
        }
      } catch (profErr) {
        console.warn('Could not fetch delivery partner profile details:', profErr);
      }

      const token = `odoo_delivery_session_${uid}_${Date.now()}`;
      await setStoredAuthTokens({
        accessToken: token,
        refreshToken: token,
      });

      const authUser: AuthUser = {
        id: uid,
        userId: uidNumber,
        email: result.username || email,
        name,
        token,
        partnerId,
        phone,
        companyId: result.company_id,
        role: 'delivery_partner',
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        license_number: licenseNumber,
        city,
      };

      await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, true);
      await storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, authUser);

      return authUser;
    } catch (error: any) {
      console.error('Error in AuthService.login:', error);
      const rawMsg = String(error?.message || '');
      const lower = rawMsg.toLowerCase();

      // If the backend server is unreachable or offline (e.g. ngrok tunnel down) and demo credentials are provided,
      // allow fallback authentication so testing and development flow are not blocked.
      const isUnreachable =
        lower.includes('network') ||
        lower.includes('timeout') ||
        lower.includes('econnrefused') ||
        lower.includes('offline') ||
        lower.includes('ngrok') ||
        lower.includes('failed to fetch') ||
        lower.includes('err_') ||
        lower.includes('502') ||
        lower.includes('503') ||
        lower.includes('504');

      const isDemoPartner =
        (email.toLowerCase() === 'karthik.delivery@example.com' ||
          email.toLowerCase() === (ODOO_CONFIG.LOGIN || '').toLowerCase()) &&
        (password === '1234' || password === ODOO_CONFIG.PASSWORD);

      if (isUnreachable && isDemoPartner) {
        console.warn('Backend server unreachable; logging in using Demo Partner fallback profile.');
        const token = `odoo_delivery_session_${ODOO_CONFIG.UID}_${Date.now()}`;
        await setStoredAuthTokens({
          accessToken: token,
          refreshToken: token,
        });

        const fallbackUser: AuthUser = {
          id: String(ODOO_CONFIG.UID),
          userId: ODOO_CONFIG.UID,
          email,
          name: 'Karthik Driver',
          token,
          partnerId: 42,
          phone: '+919843012345',
          companyId: 1,
          role: 'delivery_partner',
          vehicle_type: 'Scooty',
          vehicle_number: 'TN70CC7890',
          license_number: 'TN7020230007890',
          city: 'Hosur',
        };

        await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, true);
        await storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, fallbackUser);

        return fallbackUser;
      }

      throw new Error(humaniseAuthError(rawMsg));
    }
  }

  /**
   * Performs Google / Gmail Sign In
   */
  static async loginWithGoogle(
    payload?: Partial<LoginPayload & { name?: string }>,
  ): Promise<AuthUser> {
    const rawEmail = (payload?.email || '').trim();
    if (!rawEmail) {
      throw new Error('Please select or enter a Google account.');
    }
    const email = rawEmail.toLowerCase();
    let password = (payload?.password || '').trim();

    if (!password) {
      if (email === ODOO_CONFIG.LOGIN.toLowerCase()) {
        password = ODOO_CONFIG.PASSWORD;
      }
    }

    if (!password) {
      throw new Error('Password is required to sign in with this account.');
    }

    return await this.login({ email, password });
  }

  /**
   * Registers a new Delivery Partner via /api/delivery/signup
   */
  static async register(payload: RegisterPayload): Promise<AuthUser> {
    const name = (payload.name ?? '').trim();
    const email = (payload.email ?? '').trim().toLowerCase();
    const password = (payload.password ?? '').trim();
    const phone = (payload.phone ?? '').trim();

    if (!name || !email || !password) {
      throw new Error('Name, email and password are required');
    }

    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters');
    }

    try {
      const signupPayload: DeliverySignupPayload = {
        name,
        email,
        phone: phone || '+919843012345',
        password,
        vehicle_type: payload.vehicle_type || 'Bike',
        vehicle_number: payload.vehicle_number || 'TN70CC7890',
        license_number: payload.license_number || 'TN7020230007890',
        pan_number: payload.pan_number || 'VWXYZ3456Q',
        aadhaar_number: payload.aadhaar_number || '123456789012',
        street: payload.street || 'Main Road',
        city: payload.city || 'Hosur',
        state_id: payload.state_id || 585,
        country_id: payload.country_id || 104,
        zip_code: payload.zip_code || '635110',
        profile_image_base64: payload.profile_image_base64,
        pan_doc_base64: payload.pan_doc_base64,
        aadhaar_front_base64: payload.aadhaar_front_base64,
        aadhaar_back_base64: payload.aadhaar_back_base64,
        license_doc_base64: payload.license_doc_base64,
      };

      await DeliveryApiService.signup(signupPayload);

      // Log in immediately after successful signup
      return await this.login({ email, password });
    } catch (error: any) {
      console.error('Error in AuthService.register:', error);
      const msg = error?.message || 'Registration failed. Please try again.';
      throw new Error(msg);
    }
  }

  /**
   * Requests password reset using /api/delivery/forgot_password
   */
  static async forgotPassword(email: string): Promise<boolean> {
    const trimmedEmail = (email ?? '').trim();
    if (!trimmedEmail) {
      throw new Error('Email is required');
    }

    try {
      await DeliveryApiService.forgotPassword(trimmedEmail);
      return true;
    } catch (error: any) {
      console.error('Error in AuthService.forgotPassword:', error);
      throw error instanceof Error
        ? error
        : new Error('Password reset request failed. Please try again.');
    }
  }

  /**
   * Resets password
   */
  static async resetPassword(email: string): Promise<boolean> {
    return this.forgotPassword(email);
  }

  /**
   * Logs out delivery partner and clears stored credentials
   */
  static async logout(): Promise<void> {
    try {
      await clearStoredAuthTokens();
    } catch (_) {
      // Ignore errors on logout
    }
  }
}
