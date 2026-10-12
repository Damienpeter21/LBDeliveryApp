import { DeliveryApiService } from '../src/modules/delivery/services/deliveryApiService';
import { AuthService } from '../src/modules/auth/services/authService';
import { axiosInstance } from '../src/app/config';

jest.mock('../src/app/config/axios/AxiosInstance', () => {
  const mockAxios: any = jest.fn();
  mockAxios.create = jest.fn(() => mockAxios);
  mockAxios.interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  mockAxios.defaults = { headers: { common: {} } };
  return {
    __esModule: true,
    default: mockAxios,
    AUTH_STORAGE_KEYS: {
      ACCESS_TOKEN: '@lb_delivery_access_token',
      REFRESH_TOKEN: '@lb_delivery_refresh_token',
      USER_DATA: '@lb_delivery_user_data',
      USER_ACTIVE: 'useractive',
      SHIFT_CHECKED_IN: '@lb_delivery_shift_checked_in',
      SESSION_COOKIE: '@lb_delivery_session_cookie',
    },
    getStoredAccessToken: jest.fn(),
    getStoredRefreshToken: jest.fn(),
    getStoredSessionCookie: jest.fn(),
    setStoredAuthTokens: jest.fn(),
    clearStoredAuthTokens: jest.fn(),
    setOnSessionExpired: jest.fn(),
  };
});

describe('Login Payload Structure Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DeliveryApiService.login sends exact required payload { db, login, password, app_type }', async () => {
    const mockPostResponse = {
      data: {
        jsonrpc: '2.0',
        result: {
          uid: 42,
          username: 'customer@example.com',
          name: 'Delivery Driver',
          company_id: 1,
        },
      },
    };

    (axiosInstance as unknown as jest.Mock).mockResolvedValueOnce(mockPostResponse);

    const payload = {
      db: 'home_delivery',
      login: 'customer@example.com',
      password: 'password',
      app_type: 'delivery',
    };

    const res = await DeliveryApiService.login(payload);

    expect(axiosInstance).toHaveBeenCalledTimes(1);
    const callArgs = (axiosInstance as unknown as jest.Mock).mock.calls[0][0];

    expect(callArgs.url).toBe('/web/session/authenticate');
    expect(callArgs.method).toBe('POST');
    expect(callArgs.data.params).toEqual({
      db: 'home_delivery',
      login: 'customer@example.com',
      password: 'password',
      app_type: 'delivery',
    });
    expect(res.uid).toBe(42);
  });

  it('AuthService.login correctly structures payload with db, login, password, and app_type', async () => {
    const mockAuthResponse = {
      data: {
        jsonrpc: '2.0',
        result: {
          uid: 15,
          username: 'customer@example.com',
          name: 'Customer Delivery',
          company_id: 1,
          partner_id: [15, 'Customer Delivery'],
        },
      },
    };

    (axiosInstance as unknown as jest.Mock).mockResolvedValueOnce(mockAuthResponse);

    // Call AuthService.login with user specified payload structure
    const user = await AuthService.login({
      db: 'home_delivery',
      login: 'customer@example.com',
      password: 'password',
      app_type: 'delivery',
    });

    expect(axiosInstance).toHaveBeenCalled();
    const callArgs = (axiosInstance as unknown as jest.Mock).mock.calls[0][0];

    expect(callArgs.url).toBe('/web/session/authenticate');
    expect(callArgs.data.params).toEqual({
      db: 'home_delivery',
      login: 'customer@example.com',
      password: 'password',
      app_type: 'delivery',
    });

    expect(user.userId).toBe(15);
    expect(user.email).toBe('customer@example.com');
  });

  it('AuthService.login defaults db to home_delivery and app_type to delivery if not provided', async () => {
    const mockAuthResponse = {
      data: {
        jsonrpc: '2.0',
        result: {
          uid: 20,
          username: 'partner@example.com',
          name: 'Partner',
          company_id: 1,
        },
      },
    };

    (axiosInstance as unknown as jest.Mock).mockResolvedValueOnce(mockAuthResponse);

    // Call AuthService.login with only email and password
    await AuthService.login({
      email: 'partner@example.com',
      password: 'secretpassword',
    });

    const callArgs = (axiosInstance as unknown as jest.Mock).mock.calls[0][0];
    expect(callArgs.data.params).toEqual({
      db: 'home_delivery',
      login: 'partner@example.com',
      password: 'secretpassword',
      app_type: 'delivery',
    });
  });
});
