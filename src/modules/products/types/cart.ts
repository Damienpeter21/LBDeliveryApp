import { Product } from './product';

export interface CartItem {
  product: Product;
  quantity: number;
  lineId?: number;
}

export interface CartContextType {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  cartOrderId: number | null;
  serverMinOrderAmount?: number | null;
  isLoading: boolean;
  addToCart: (product: Product, quantity?: number) => Promise<void> | void;
  removeFromCart: (productId: string) => Promise<void> | void;
  updateQuantity: (productId: string, quantity: number) => Promise<void> | void;
  clearCart: (options?: { preserveServerOrder?: boolean }) => Promise<void> | void;
  refreshCartFromApi: () => Promise<void>;
  setCartOrderId?: (id: number | null) => void;
  validateMinimumOrder?: () => Promise<{ valid: boolean; minAmount?: number; message?: string }>;
}

