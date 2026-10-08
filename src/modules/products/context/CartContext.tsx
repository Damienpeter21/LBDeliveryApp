import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_SETTINGS } from '../../../app/config';
import { storage } from '../../../storage/AsyncStorage';
import { useAuth } from '../../auth';
import { CartService } from '../services/cartService';
import { CartContextType, CartItem } from '../types/cart';
import { Product } from '../types/product';
import { mapOdooProductToProduct } from '../utils/productMapper';

const getCartStorageKey = (pid?: number | string | null) =>
  pid ? `@lb_delivery_cart_items_${pid}` : '@lb_delivery_cart_items_guest';
const getCartOrderIdKey = (pid?: number | string | null) =>
  pid ? `@lb_delivery_cart_order_id_${pid}` : '@lb_delivery_cart_order_id_guest';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const partnerId = user?.partnerId || user?.id;

  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOrderId, setCartOrderId] = useState<number | null>(null);
  const [serverMinOrderAmount, setServerMinOrderAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(isAuthenticated && partnerId));

  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;

  const cartOrderIdRef = useRef<number | null>(cartOrderId);
  cartOrderIdRef.current = cartOrderId;

  const validateMinimumOrder = async (): Promise<{ valid: boolean; minAmount?: number; message?: string }> => {
    const currentOrderId = cartOrderIdRef.current;
    if (!currentOrderId) {
      return { valid: true };
    }
    try {
      const res = await CartService.validateMinimumOrder(currentOrderId);
      if (res.minAmount !== undefined && !isNaN(Number(res.minAmount))) {
        setServerMinOrderAmount(Number(res.minAmount));
      }
      return {
        valid: res.valid,
        minAmount: res.minAmount,
        message: res.message,
      };
    } catch (err) {
      console.warn('CartContext validateMinimumOrder note:', err);
      return { valid: true };
    }
  };

  // ── Initial Mount & Auth Sync: Restore Local Storage & Sync with Server ──
  useEffect(() => {
    let isMounted = true;

    // Guard: For guest / unauthenticated users, restore local cart without deleting
    if (!isAuthenticated || !partnerId) {
      const loadGuestCart = async () => {
        try {
          const guestKey = getCartStorageKey(null);
          const savedItems = await storage.getJson<CartItem[]>(guestKey);
          if (savedItems && Array.isArray(savedItems) && isMounted) {
            setItems(savedItems);
          } else if (isMounted) {
            setItems([]);
          }
        } catch (e) {
          console.warn('Could not restore guest cart:', e);
        } finally {
          if (isMounted) {
            setCartOrderId(null);
            setIsLoading(false);
          }
        }
      };
      loadGuestCart();
      return () => {
        isMounted = false;
      };
    }

    const restoreCart = async () => {
      try {
        setIsLoading(true);
        // 1. Immediately read locally saved items for this authenticated user session
        const uKey = getCartStorageKey(partnerId);
        const oKey = getCartOrderIdKey(partnerId);
        const savedItems = await storage.getJson<CartItem[]>(uKey);
        const savedOrderIdStr = await storage.getString(oKey);

        let initialItems: CartItem[] = [];
        if (savedItems && Array.isArray(savedItems)) {
          initialItems = savedItems;
          if (isMounted) setItems(savedItems);
        } else if (isMounted) {
          setItems([]);
        }

        let initialOrderId: number | null = null;
        if (savedOrderIdStr) {
          const parsed = Number(savedOrderIdStr);
          if (!isNaN(parsed) && parsed > 0) {
            initialOrderId = parsed;
            if (isMounted) setCartOrderId(parsed);
          }
        }

        // 2. Perform background server reconciliation ONLY for this authenticated user
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const pid = Number(partnerId);
            if (!pid || isNaN(pid)) return;

            if (initialOrderId) {
              try {
                const detailRes = await CartService.fetchCartDetails(initialOrderId);
                const activeOrder = Array.isArray(detailRes?.result) ? detailRes.result[0] : null;
                const orderPartnerId = Array.isArray(activeOrder?.partner_id)
                  ? activeOrder.partner_id[0]
                  : activeOrder?.partner_id;

                if ((!activeOrder || (orderPartnerId && Number(orderPartnerId) !== pid)) && isMounted) {
                  setCartOrderId(null);
                  await storage.delete(oKey);
                  initialOrderId = null;
                }
              } catch (vErr) {
                console.warn('Odoo draft cart verification note:', vErr);
              }
            }
          } catch (bgErr) {
            console.warn('Background cart restore note:', bgErr);
          }
        }, 1200);
      } catch (err) {
        console.warn('CartContext restoreCart error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    restoreCart();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, partnerId]);

  // ── Helper: Save items to AsyncStorage ──────────────────────────────────
  const persistItems = async (newItems: CartItem[]) => {
    const key = getCartStorageKey(partnerId);
    await storage.setJson(key, newItems);
  };

  // ── Add to Cart (Instant Local + Background Odoo API) ────────────────────
  const addToCart = async (incomingProduct: Product, quantity = 1) => {
    const product = mapOdooProductToProduct(incomingProduct);
    const prodIdStr = String(product.id);

    // 1. Optimistic state & local storage update
    let updatedItems: CartItem[] = [];
    let existingItem: CartItem | undefined;

    setItems(prev => {
      const idx = prev.findIndex(it => String(it.product.id) === prodIdStr);
      if (idx > -1) {
        updatedItems = [...prev];
        existingItem = updatedItems[idx];
        updatedItems[idx] = {
          ...existingItem,
          quantity: existingItem.quantity + quantity,
        };
        return updatedItems;
      }
      const newItem: CartItem = { product, quantity };
      updatedItems = [...prev, newItem];
      return updatedItems;
    });

    await persistItems(updatedItems);

    // 2. Synchronize with Odoo Cart API (ONLY if authenticated)
    if (!isAuthenticated || !partnerId) {
      return;
    }

    try {
      const pid = Number(partnerId);
      let activeOrderId = cartOrderIdRef.current;

      if (activeOrderId) {
        if (existingItem?.lineId) {
          // Update line quantity (PUT Update Cart Item)
          await CartService.updateCartItem(
            existingItem.lineId,
            existingItem.quantity + quantity,
          );
        } else {
          // Add new line to existing cart (Post Add to Cart)
          const addRes = await CartService.addCartItem(
            activeOrderId,
            product.id,
            quantity,
            product.templateId,
            product.name,
            product.price,
          );
          if (addRes?.result) {
            const newLineId = Number(addRes.result);
            setItems(curr => {
              const next = curr.map(it =>
                String(it.product.id) === prodIdStr ? { ...it, lineId: newLineId } : it,
              );
              persistItems(next);
              return next;
            });
          }
        }
      } else {
        // No active session draft cart exists, create a fresh draft Sale Order (Create Sale Order)
        const createRes = await CartService.createSaleOrder({
          partnerId: pid,
          items: [
            {
              productId: Number(product.id),
              templateId: product.templateId,
              name: product.name,
              quantity,
              priceUnit: product.price,
            },
          ],
        });

        if (createRes?.result) {
          const newOrderId = Number(createRes.result);
          setCartOrderId(newOrderId);
          await storage.set(getCartOrderIdKey(pid), String(newOrderId));

          try {
            const detailRes = await CartService.fetchCartDetails(newOrderId);
            const lines = detailRes?.result?.[0]?.order_line;
            if (Array.isArray(lines) && lines.length > 0) {
              const createdLineId = Number(lines[lines.length - 1]);
              setItems(curr => {
                const next = curr.map(it =>
                  String(it.product.id) === prodIdStr ? { ...it, lineId: createdLineId } : it,
                );
                persistItems(next);
                return next;
              });
            }
          } catch (rErr) {
            console.warn('fetchCartDetails for lineId error:', rErr);
          }
        }
      }
    } catch (apiErr) {
      console.warn('Odoo addToCart API sync note:', apiErr);
    }
  };

  // ── Update Quantity (Instant Local + Background Odoo API) ────────────────
  const updateQuantity = async (productId: string, quantity: number) => {
    const prodIdStr = String(productId);

    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    let lineIdToUpdate: number | undefined;
    let updatedItems: CartItem[] = [];

    setItems(prev => {
      updatedItems = prev.map(item => {
        if (String(item.product.id) === prodIdStr) {
          lineIdToUpdate = item.lineId;
          return { ...item, quantity };
        }
        return item;
      });
      return updatedItems;
    });

    await persistItems(updatedItems);

    // Sync to Odoo API (ONLY if authenticated)
    if (!isAuthenticated || !partnerId) {
      return;
    }

    try {
      if (lineIdToUpdate) {
        // PUT Update Cart Item
        await CartService.updateCartItem(lineIdToUpdate, quantity);
      } else if (cartOrderIdRef.current) {
        // Line ID not yet linked, add item
        const addRes = await CartService.addCartItem(
          cartOrderIdRef.current,
          productId,
          quantity,
        );
        if (addRes?.result) {
          const newLineId = Number(addRes.result);
          setItems(curr => {
            const next = curr.map(it =>
              String(it.product.id) === prodIdStr ? { ...it, lineId: newLineId } : it,
            );
            persistItems(next);
            return next;
          });
        }
      }
    } catch (err) {
      console.warn('Odoo updateQuantity API sync note:', err);
    }
  };

  // ── Remove from Cart (Instant Local + Background Odoo API) ───────────────
  const removeFromCart = async (productId: string) => {
    const prodIdStr = String(productId);
    let lineIdToRemove: number | undefined;
    let updatedItems: CartItem[] = [];

    setItems(prev => {
      const target = prev.find(it => String(it.product.id) === prodIdStr);
      if (target) {
        lineIdToRemove = target.lineId;
      }
      updatedItems = prev.filter(it => String(it.product.id) !== prodIdStr);
      return updatedItems;
    });

    await persistItems(updatedItems);

    // Sync to Odoo API (DELETE Remove Cart Item - ONLY if authenticated)
    if (!isAuthenticated || !partnerId) {
      return;
    }

    if (lineIdToRemove) {
      try {
        await CartService.removeCartItem(lineIdToRemove);
      } catch (err) {
        console.warn('Odoo removeCartItem API sync note:', err);
      }
    }
  };

  // ── Clear Cart (Instant Local + Background Odoo API) ─────────────────────
  const clearCart = async (options?: { preserveServerOrder?: boolean }) => {
    const currentOrderId = cartOrderIdRef.current;
    setItems([]);
    setCartOrderId(null);
    const uKey = getCartStorageKey(partnerId);
    const oKey = getCartOrderIdKey(partnerId);
    await Promise.all([
      storage.delete(uKey),
      storage.delete(oKey),
      storage.delete('@lb_delivery_cart_items'),
      storage.delete('@lb_delivery_cart_order_id'),
    ]);

    // Sync to Odoo API (DELETE Clear Cart - ONLY if authenticated and not preserving a placed order)
    if (!options?.preserveServerOrder && isAuthenticated && partnerId && currentOrderId) {
      try {
        await CartService.clearCart(currentOrderId);
      } catch (err) {
        console.warn('Odoo clearCart API sync note:', err);
      }
    }
  };

  // ── Refresh Cart from API ───────────────────────────────────────────────
  const refreshCartFromApi = async () => {
    if (!isAuthenticated || !partnerId) {
      return;
    }

    try {
      const pid = Number(partnerId);
      const cartsRes = await CartService.fetchAllCarts(pid);
      const draftCarts = Array.isArray(cartsRes?.result) ? cartsRes.result : [];
      if (draftCarts.length > 0) {
        const activeCart = draftCarts[0];
        setCartOrderId(activeCart.id);
        await storage.set(getCartOrderIdKey(partnerId), String(activeCart.id));

        if (Array.isArray(activeCart.order_line) && activeCart.order_line.length > 0) {
          const linesRes = await CartService.fetchCartLines(activeCart.order_line);
          const lines = Array.isArray(linesRes?.result) ? linesRes.result : [];
          if (lines.length > 0) {
            const baseUrl = (API_SETTINGS?.baseUrl || 'https://9d6f-122-187-121-222.ngrok-free.app').replace(/\/+$/, '');
            const freshItems: CartItem[] = lines.map((line: any) => {
              const prodId = Array.isArray(line.product_id) ? line.product_id[0] : line.product_id;
              const prodName = Array.isArray(line.product_id)
                ? line.product_id[1]
                : line.name || 'Product';
              return {
                product: {
                  id: String(prodId),
                  name: prodName,
                  price: Number(line.price_unit) || 0,
                  originalPrice: Number(line.price_unit) || 0,
                  rating: 0,
                  reviewsCount: 0,
                  imageUrl: `${baseUrl}/web/image/product.template/${prodId}/image_512`,
                  category: 'grocery',
                  unit: '1 pc',
                  inStock: true,
                },
                quantity: Number(line.product_uom_qty) || 1,
                lineId: Number(line.id),
              };
            });
            setItems(freshItems);
            await persistItems(freshItems);
          }
        }
      }
    } catch (err) {
      console.warn('refreshCartFromApi error:', err);
    }
  };

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    const raw = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return Math.round(raw * 100) / 100;
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        totalQuantity,
        totalAmount,
        cartOrderId,
        serverMinOrderAmount,
        isLoading,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCartFromApi,
        setCartOrderId,
        validateMinimumOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

