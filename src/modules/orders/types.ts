export type OrderStatus =
  | 'unassigned'
  | 'confirmed'
  | 'assigned'
  | 'preparing'
  | 'arrived_store'
  | 'picked_up'
  | 'in_transit'
  | 'arrived_customer'
  | 'delivered'
  | 'cancelled';


export interface OrderItemProduct {
  id: string | number;
  name: string;
  price?: number;
  imageUrl?: string;
  unit?: string;
}

export interface OrderItem {
  id?: string | number;
  product?: OrderItemProduct;
  productName?: string;
  quantity: number;
  price: number;
}

export interface DeliveryPartner {
  name: string;
  phone: string;
  vehicle: string;
  rating?: number;
}

export interface Order {
  id: string;
  pickingId?: number;
  saleOrderId?: number;
  orderNumber: string;
  origin?: string;
  date: string;
  time: string;
  status: OrderStatus;
  items: OrderItem[];
  itemCount: number;
  totalAmount: number;
  savings?: number;
  paymentMode: string;
  paymentStatus?: string;
  isCod?: boolean;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  storeName?: string;
  storeAddress?: string;
  eta?: string;
  deliveryPartner?: DeliveryPartner;
  deliveryFee?: number;
  deliveryOtp?: string;
  cancelReason?: string;
  latitude?: number;
  longitude?: number;
  customerLatitude?: number;
  customerLongitude?: number;
  storeLatitude?: number;
  storeLongitude?: number;
}

export * from '../delivery/types';
