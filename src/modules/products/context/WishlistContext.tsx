import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../../../storage/AsyncStorage';
import { Product } from '../types/product';
import { mapOdooProductToProduct } from '../utils/productMapper';

const WISHLIST_STORAGE_KEY = '@lb_delivery_wishlist';

interface WishlistContextType {
  wishlist: Product[];
  wishlistCount: number;
  isInWishlist: (productId: string | number) => boolean;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string | number) => void;
  toggleWishlist: (product: Product) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Product[]>([]);

  useEffect(() => {
    const restoreWishlist = async () => {
      try {
        const saved = await storage.getJson<Product[]>(WISHLIST_STORAGE_KEY);
        if (saved && Array.isArray(saved)) {
          setWishlist(saved);
        }
      } catch (err) {
        console.warn('Wishlist restore error:', err);
      }
    };
    restoreWishlist();
  }, []);

  const persistWishlist = async (items: Product[]) => {
    try {
      await storage.setJson(WISHLIST_STORAGE_KEY, items);
    } catch (err) {
      console.warn('Wishlist persist error:', err);
    }
  };

  const isInWishlist = (productId: string | number) => {
    return wishlist.some(p => String(p.id) === String(productId));
  };

  const addToWishlist = (incomingProduct: Product) => {
    const product = mapOdooProductToProduct(incomingProduct);
    if (!isInWishlist(product.id)) {
      setWishlist(prev => {
        const updated = [product, ...prev];
        persistWishlist(updated);
        return updated;
      });
    }
  };

  const removeFromWishlist = (productId: string | number) => {
    setWishlist(prev => {
      const updated = prev.filter(p => String(p.id) !== String(productId));
      persistWishlist(updated);
      return updated;
    });
  };

  const toggleWishlist = (product: Product) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const clearWishlist = () => {
    setWishlist([]);
    persistWishlist([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
