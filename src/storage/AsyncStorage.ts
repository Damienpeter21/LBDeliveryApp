import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin wrapper around AsyncStorage that preserves the previous storage API
 * (`storage.set` and `storage.getString`).
 *
 * Note: AsyncStorage is asynchronous, so both methods return a Promise.
 * Callers should `await` the result (or use `.then(...)`).
 */
export const storage = {
  set: async (key: string, value: string | number | boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (error) {
      console.error(`storage.set failed for key "${key}":`, error);
    }
  },

  getString: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`storage.getString failed for key "${key}":`, error);
      return null;
    }
  },

  getBoolean: async (key: string): Promise<boolean> => {
    try {
      const val = await AsyncStorage.getItem(key);
      return val === 'true';
    } catch (error) {
      console.error(`storage.getBoolean failed for key "${key}":`, error);
      return false;
    }
  },

  getJson: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`storage.getJson failed for key "${key}":`, error);
      return null;
    }
  },

  setJson: async (key: string, value: unknown): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`storage.setJson failed for key "${key}":`, error);
    }
  },

  delete: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`storage.delete failed for key "${key}":`, error);
    }
  },

  clearAll: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('storage.clearAll failed:', error);
    }
  },
};
