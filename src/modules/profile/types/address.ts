export type AddressType = 'HOME' | 'WORK' | 'OTHER';

export interface SavedAddress {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  flatNo: string;
  streetArea: string;
  landmark?: string;
  city: string;
  state: string;
  type: AddressType;
  isDefault: boolean;
  isVerified?: boolean;
  latitude?: number;
  longitude?: number;
}
