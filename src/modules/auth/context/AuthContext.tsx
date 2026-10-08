import React, { createContext, useContext, useEffect, useState } from 'react';
import { AUTH_STORAGE_KEYS, setOnSessionExpired } from '../../../app/config';
import { storage } from '../../../storage';
import { AuthService, AuthUser, LoginPayload, RegisterPayload } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<boolean>;
  loginWithGoogle: (payload?: Partial<LoginPayload & { name?: string }>) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updateUser: (updatedFields: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restore authenticated user session from AsyncStorage on app launch
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const [userActive, storedUser] = await Promise.all([
          storage.getString(AUTH_STORAGE_KEYS.USER_ACTIVE),
          storage.getJson<AuthUser>(AUTH_STORAGE_KEYS.USER_DATA),
        ]);

        if (isMounted) {
          if (userActive === 'true' && storedUser) {
            setUser(storedUser);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session from storage:', err);
      }
    };

    restoreSession();

    // In case token refresh fails and session expires globally
    setOnSessionExpired(() => {
      if (isMounted) {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      setOnSessionExpired(null);
    };
  }, []);

  const login = async (payload: LoginPayload): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const authUser = await AuthService.login(payload);
      setUser(authUser);
      await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, true);
      await storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, authUser);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const authUser = await AuthService.register(payload);
      setUser(authUser);
      await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, true);
      await storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, authUser);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.forgotPassword(email);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Password reset request failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.resetPassword(email);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedFields: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, updated);
      return updated;
    });
  };

  const loginWithGoogle = async (
    payload?: Partial<LoginPayload & { name?: string }>,
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const authUser = await AuthService.loginWithGoogle(payload);
      setUser(authUser);
      await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, true);
      await storage.setJson(AUTH_STORAGE_KEYS.USER_DATA, authUser);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
      await storage.set(AUTH_STORAGE_KEYS.USER_ACTIVE, false);
      await storage.delete(AUTH_STORAGE_KEYS.USER_DATA);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        loginWithGoogle,
        register,
        forgotPassword,
        resetPassword,
        updateUser,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
