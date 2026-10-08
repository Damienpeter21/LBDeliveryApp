import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { API_SETTINGS } from '../apiSettings';
import { showErrorToast } from '../../../components/common/toast';
import { storage } from '../../../storage';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, skips attaching the Authorization header */
    skipAuth?: boolean;
    /** When true, skips showing global error toasts on failure */
    skipGlobalErrorToast?: boolean;
    /** Internal flag to avoid infinite refresh retry loops */
    _retry?: boolean;
  }
}

/** Storage keys for authentication tokens */
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: '@lb_delivery_access_token',
  REFRESH_TOKEN: '@lb_delivery_refresh_token',
  USER_DATA: '@lb_delivery_user_data',
  USER_ACTIVE: 'useractive',
  SHIFT_CHECKED_IN: '@lb_delivery_shift_checked_in',
};


// ── Auth Token Helpers ──────────────────────────────────────────────

export const getStoredAccessToken = async (): Promise<string | null> => {
  return await storage.getString(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
};

export const getStoredRefreshToken = async (): Promise<string | null> => {
  return await storage.getString(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
};

export const setStoredAuthTokens = async (tokens: {
  accessToken: string;
  refreshToken?: string;
}): Promise<void> => {
  await storage.set(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  if (tokens.refreshToken) {
    await storage.set(AUTH_STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  }
};

export const clearStoredAuthTokens = async (): Promise<void> => {
  await storage.delete(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  await storage.delete(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  await storage.delete(AUTH_STORAGE_KEYS.USER_DATA);
  await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, false);
};

// Optional global callback for session expiration (e.g. redirect to login screen)
let onSessionExpiredCallback: (() => void) | null = null;
export const setOnSessionExpired = (callback: (() => void) | null): void => {
  onSessionExpiredCallback = callback;
};

// ── Axios Instance Creation ─────────────────────────────────────────

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_SETTINGS.baseUrl,
  timeout: API_SETTINGS.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────

const isMultipartFormData = (data: unknown): boolean => {
  if (data == null || typeof data !== 'object') return false;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true;
  const maybe = data as { append?: unknown; constructor?: { name?: string } };
  return (
    typeof maybe.append === 'function' &&
    (maybe.constructor?.name === 'FormData' ||
      Object.prototype.toString.call(data) === '[object FormData]')
  );
};

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.includes('/auth/') ||
    url.includes('/jsonrpc') ||
    url.includes('/web/session/authenticate') ||
    url.includes('top_selling') ||
    url.includes('/api/products/')
  );
};

/** Extracts user-friendly error message from Axios errors or API responses */
export const extractErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const axiosErr = error as AxiosError<any>;
  if (axiosErr.response?.data) {
    const data = axiosErr.response.data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data.message && typeof data.message === 'string') return data.message.trim();
    if (data.error && typeof data.error === 'string') return data.error.trim();
    if (data.detail && typeof data.detail === 'string') return data.detail.trim();
    if (data.statusMessage && typeof data.statusMessage === 'string') return data.statusMessage.trim();

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      return typeof first === 'string' ? first : JSON.stringify(first);
    }

    if (data.errors && typeof data.errors === 'object') {
      const messages: string[] = [];
      Object.values(data.errors).forEach(val => {
        if (Array.isArray(val)) {
          messages.push(...val.filter(v => typeof v === 'string'));
        } else if (typeof val === 'string') {
          messages.push(val);
        }
      });
      if (messages.length > 0) return messages.join('\n');
    }
  }

  if (axiosErr.message) {
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.message.toLowerCase().includes('timeout')) {
      return 'Request timed out. Please check your network connection.';
    }
    if (axiosErr.message === 'Network Error') {
      return 'No internet connection. Please check your network.';
    }
    return axiosErr.message;
  }

  return fallback;
};

// ── Refresh Token Queue Mutex ───────────────────────────────────────

interface FailedQueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Executes token refresh against backend endpoint */
const refreshAuthToken = async (): Promise<string | null> => {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    // Bare axios call without interceptors to prevent circular interception
    const response = await axios.post<{
      accessToken?: string;
      token?: string;
      refreshToken?: string;
    }>(
      `${API_SETTINGS.baseUrl}/auth/refresh`,
      { refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: API_SETTINGS.timeoutMs,
      },
    );

    const newAccessToken = response.data?.accessToken || response.data?.token;
    const newRefreshToken = response.data?.refreshToken;

    if (newAccessToken) {
      await setStoredAuthTokens({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
      return newAccessToken;
    }

    return null;
  } catch (error) {
    console.error('Refresh token request failed:', error);
    return null;
  }
};

// ── Request Interceptor ─────────────────────────────────────────────

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    try {
      // 1. Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected === false) {
        if (config.skipGlobalErrorToast !== true) {
          showErrorToast('Please check your internet connection.');
        }
        return Promise.reject(new Error('No internet connection'));
      }

      // 2. Ensure headers instance
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }

      // 3. Attach Bearer token if available and not skipped
      if (!config.skipAuth) {
        const accessToken = await getStoredAccessToken();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }

      // 4. Handle Content-Type for FormData vs JSON
      if (isMultipartFormData(config.data)) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
          config.headers.delete('content-type');
        } else {
          delete (config.headers as Record<string, unknown>)['Content-Type'];
          delete (config.headers as Record<string, unknown>)['content-type'];
        }
      }

      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  },
  error => Promise.reject(error),
);

// ── Response Interceptor ────────────────────────────────────────────

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized with Token Refresh
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      if (isRefreshing) {
        // If refresh is already in flight, queue this request until refresh finishes
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(axiosInstance(originalRequest));
            },
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAuthToken();

        if (newAccessToken) {
          processQueue(null, newAccessToken);
          axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        } else {
          processQueue(new Error('Session expired'), null);
          await clearStoredAuthTokens();
          if (originalRequest.skipGlobalErrorToast !== true) {
            showErrorToast('Your session has expired. Please sign in again.');
          }
          onSessionExpiredCallback?.();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearStoredAuthTokens();
        if (originalRequest.skipGlobalErrorToast !== true) {
          showErrorToast('Your session has expired. Please sign in again.');
        }
        onSessionExpiredCallback?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Show global toast for non-401 errors if not suppressed
    if (originalRequest?.skipGlobalErrorToast !== true && error.response?.status !== 401) {
      const message = extractErrorMessage(error);
      showErrorToast(message);
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
