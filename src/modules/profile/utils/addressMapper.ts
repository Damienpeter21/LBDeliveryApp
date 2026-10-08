// src/modules/profile/utils/addressMapper.ts
import { API_SETTINGS } from '../../../app/config';
import { AddressType, SavedAddress } from '../types/address';
import { CustomerAddressPayload } from '../services/customerService';

/**
 * Checks whether an Odoo partner record contains a genuine delivery street address.
 * Bare customer contact profiles (with no street/flat address) are not delivery addresses.
 */
export const isRealDeliveryAddress = (rawPartner: any): boolean => {
  if (!rawPartner) return false;
  const flatNo = String(rawPartner.street || '').trim();
  const streetArea = String(rawPartner.street2 || '').trim();
  return Boolean(flatNo || streetArea);
};

/**
 * Maps an Odoo `res.partner` record into a `SavedAddress` object.
 */
export const mapOdooPartnerToSavedAddress = (
  rawPartner: any,
  isDefault = false,
): SavedAddress => {
  if (!rawPartner) {
    return {
      id: '0',
      name: 'User',
      phone: '',
      pincode: '',
      flatNo: '',
      streetArea: '',
      city: '',
      state: '',
      type: 'HOME',
      isDefault: false,
    };
  }

  const id = String(rawPartner.id || rawPartner.address_id || rawPartner.partner_id || '');
  const name = String(rawPartner.name || rawPartner.contact_name || 'My Address');
  const phone = String(rawPartner.phone || rawPartner.mobile || '');
  const flatNo = String(rawPartner.street || rawPartner.house_no || rawPartner.flat_no || '').trim();
  const streetArea = String(rawPartner.street2 || rawPartner.area || rawPartner.locality || '').trim();
  const landmark = rawPartner.landmark || undefined;
  const city = String(rawPartner.city || '');
  const pincode = String(rawPartner.zip || rawPartner.pincode || rawPartner.postal_code || '');

  let state = '';
  if (Array.isArray(rawPartner.state_id) && rawPartner.state_id[1]) {
    state = String(rawPartner.state_id[1]);
  } else if (typeof rawPartner.state === 'string') {
    state = rawPartner.state;
  }

  const isVerified = Boolean(
    rawPartner.is_verified ||
    rawPartner.verified ||
    rawPartner.is_deliverable ||
    rawPartner.delivery_verified ||
    rawPartner.state === 'verified',
  );

  const latitude = typeof rawPartner.partner_latitude === 'number'
    ? rawPartner.partner_latitude
    : typeof rawPartner.latitude === 'number'
    ? rawPartner.latitude
    : undefined;

  const longitude = typeof rawPartner.partner_longitude === 'number'
    ? rawPartner.partner_longitude
    : typeof rawPartner.longitude === 'number'
    ? rawPartner.longitude
    : undefined;

  let type: AddressType = 'HOME';
  const nameLower = name.toLowerCase();
  if (nameLower.includes('work') || nameLower.includes('office')) {
    type = 'WORK';
  } else if (rawPartner.type === 'other') {
    type = 'OTHER';
  }

  return {
    id,
    name,
    phone,
    pincode,
    flatNo,
    streetArea,
    landmark,
    city,
    state,
    type,
    isDefault: Boolean(isDefault || rawPartner.is_default),
    isVerified,
    latitude,
    longitude,
  };
};

/**
 * Converts a `SavedAddress` or partial address into a `CustomerAddressPayload` for Odoo API.
 */
export const mapSavedAddressToOdooPayload = (
  addr: Partial<SavedAddress>,
): CustomerAddressPayload => {
  return {
    name: addr.name || 'Delivery Address',
    phone: addr.phone,
    mobile: addr.phone,
    street: addr.flatNo || addr.streetArea || '',
    street2: addr.streetArea || addr.landmark || undefined,
    city: addr.city || API_SETTINGS.defaultCity,
    zip: addr.pincode || API_SETTINGS.defaultPostalCode,
    type: 'delivery',
  };
};
