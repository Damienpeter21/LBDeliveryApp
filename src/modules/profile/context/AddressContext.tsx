// src/modules/profile/context/AddressContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../../../storage/AsyncStorage';
import { useAuth } from '../../auth';
import { CustomerService } from '../services/customerService';
import { SavedAddress } from '../types/address';
import {
  isRealDeliveryAddress,
  mapOdooPartnerToSavedAddress,
  mapSavedAddressToOdooPayload,
} from '../utils/addressMapper';

const ADDRESS_STORAGE_KEY = '@lb_delivery_saved_addresses';

interface AddressContextType {
  addresses: SavedAddress[];
  selectedAddress: SavedAddress | null;
  loading: boolean;
  addAddress: (addr: Omit<SavedAddress, 'id'>) => Promise<SavedAddress>;
  updateAddress: (id: string, addr: Partial<SavedAddress>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  selectAddress: (id: string) => void;
  selectAndVerifyAddress: (addressId: string, orderId?: number | string | null) => Promise<any>;
  refreshAddresses: (orderId?: number | string | null) => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const AddressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const partnerId = user?.partnerId || (user as any)?.id;

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAddresses = async (orderId?: number | string | null) => {
    if (!isAuthenticated || !partnerId) {
      setAddresses([]);
      setSelectedAddressId('');
      return;
    }

    setLoading(true);
    try {
      // Call custom Odoo delivery address list API (/api/delivery/address/list) with fallback
      const res = await CustomerService.fetchDeliveryAddressList(orderId, partnerId);
      const rawAddresses = Array.isArray(res?.result) ? res.result : [];

      // Filter to genuine delivery addresses
      const validAddresses = rawAddresses.filter(isRealDeliveryAddress);

      if (validAddresses.length > 0) {
        const mapped = validAddresses.map((p: any, idx: number) =>
          mapOdooPartnerToSavedAddress(p, idx === 0),
        );
        setAddresses(mapped);
        storage.setJson(ADDRESS_STORAGE_KEY, mapped);

        // Keep currently selected address if it still exists, else fallback to default or first
        setSelectedAddressId(prevId => {
          if (prevId && mapped.some((a: SavedAddress) => a.id === prevId)) {
            return prevId;
          }
          const defaultAddr = mapped.find((a: SavedAddress) => a.isDefault) || mapped[0];
          return defaultAddr ? defaultAddr.id : '';
        });
      } else {
        setAddresses([]);
        setSelectedAddressId('');
      }
    } catch (err) {
      console.warn('Could not fetch Odoo customer addresses:', err);
      setAddresses([]);
      setSelectedAddressId('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated || !partnerId) {
      setAddresses([]);
      setSelectedAddressId('');
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const partnerStorageKey = `${ADDRESS_STORAGE_KEY}_${partnerId}`;

    const loadCachedAddresses = async () => {
      try {
        const cached = await storage.getJson<SavedAddress[]>(partnerStorageKey);
        if (cached && Array.isArray(cached) && cached.length > 0 && isMounted) {
          setAddresses(cached);
          const defaultAddr = cached.find((a: SavedAddress) => a.isDefault) || cached[0];
          if (defaultAddr) {
            setSelectedAddressId(prev => prev || defaultAddr.id);
          }
        }
      } catch (cErr) {
        console.warn('Address cache load error:', cErr);
      }
    };

    loadCachedAddresses();
    fetchAddresses();

    return () => {
      isMounted = false;
    };
  }, [partnerId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && partnerId && addresses.length > 0) {
      storage.setJson(`${ADDRESS_STORAGE_KEY}_${partnerId}`, addresses);
    }
  }, [addresses, isAuthenticated, partnerId]);

  const addAddress = async (newAddr: Omit<SavedAddress, 'id'>): Promise<SavedAddress> => {
    // Restrict to maximum 5 addresses
    if (addresses.length >= 5) {
      throw new Error('Maximum limit of 5 addresses reached. Please delete an address to add a new one.');
    }

    let newId = `addr_${Date.now()}`;

    try {
      const odooPayload = mapSavedAddressToOdooPayload(newAddr);
      const res = await CustomerService.createCustomerAddress(partnerId, odooPayload);
      if (res?.result) {
        newId = String(res.result);
      }
    } catch (err) {
      console.warn('Odoo createCustomerAddress error, saving locally:', err);
    }

    const addressWithId: SavedAddress = {
      ...newAddr,
      id: newId,
    };

    setAddresses(prev => {
      if (newAddr.isDefault) {
        return [addressWithId, ...prev.map(a => ({ ...a, isDefault: false }))];
      }
      return [addressWithId, ...prev];
    });

    if (newAddr.isDefault || addresses.length === 0) {
      setSelectedAddressId(newId);
    }

    return addressWithId;
  };

  const updateAddress = async (id: string, updatedFields: Partial<SavedAddress>) => {
    try {
      const odooPayload = mapSavedAddressToOdooPayload(updatedFields);
      await CustomerService.updateCustomerAddress(id, odooPayload);
    } catch (err) {
      console.warn('Odoo updateCustomerAddress error, updating locally:', err);
    }

    setAddresses(prev =>
      prev.map(item => {
        if (item.id === id) {
          return { ...item, ...updatedFields };
        }
        if (updatedFields.isDefault) {
          return { ...item, isDefault: false };
        }
        return item;
      }),
    );
  };

  const deleteAddress = async (id: string) => {
    try {
      await CustomerService.deleteCustomerAddress(id);
    } catch (err) {
      console.warn('Odoo deleteCustomerAddress error, deleting locally:', err);
    }

    setAddresses(prev => {
      const remaining = prev.filter(item => item.id !== id);
      if (selectedAddressId === id && remaining.length > 0) {
        setSelectedAddressId(remaining[0].id);
      }
      return remaining;
    });
  };

  const setDefaultAddress = async (id: string) => {
    const target = addresses.find(a => a.id === id);
    if (target) {
      try {
        const odooPayload = mapSavedAddressToOdooPayload(target);
        await CustomerService.setDefaultAddress(partnerId, odooPayload);
      } catch (err) {
        console.warn('Odoo setDefaultAddress error, setting locally:', err);
      }
    }

    setAddresses(prev =>
      prev.map(item => ({
        ...item,
        isDefault: item.id === id,
      })),
    );
    setSelectedAddressId(id);
  };

  const selectAddress = (id: string) => {
    setSelectedAddressId(String(id));
  };

  const selectAndVerifyAddress = async (id: string, orderId?: number | string | null) => {
    setSelectedAddressId(String(id));
    if (orderId && !isNaN(Number(orderId)) && id && !isNaN(Number(id))) {
      try {
        const res = await CustomerService.selectAndVerifyDeliveryAddress(Number(orderId), Number(id));
        setAddresses(prev =>
          prev.map(a => (String(a.id) === String(id) ? { ...a, isVerified: true } : a)),
        );
        return res;
      } catch (err) {
        console.warn('selectAndVerifyAddress note:', err);
      }
    }
    return null;
  };

  const selectedAddress =
    addresses.find(a => Boolean(selectedAddressId && String(a.id) === String(selectedAddressId))) ||
    addresses.find(a => a.isDefault) ||
    addresses[0] ||
    null;

  return (
    <AddressContext.Provider
      value={{
        addresses,
        selectedAddress,
        loading,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        selectAddress,
        selectAndVerifyAddress,
        refreshAddresses: fetchAddresses,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

const FALLBACK_ADDRESS_CONTEXT: AddressContextType = {
  addresses: [],
  selectedAddress: null,
  loading: false,
  addAddress: async () => ({} as SavedAddress),
  updateAddress: async () => {},
  deleteAddress: async () => {},
  setDefaultAddress: async () => {},
  selectAddress: () => {},
  selectAndVerifyAddress: async () => null,
  refreshAddresses: async () => {},
};

export const useAddress = (): AddressContextType => {
  const context = useContext(AddressContext);
  if (!context) {
    return FALLBACK_ADDRESS_CONTEXT;
  }
  return context;
};
