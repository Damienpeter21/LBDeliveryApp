/**
 * Device identification helpers for login/device-registration payloads
 * (`getDeviceInfo`, phone permission, display version).
 */
import { Dimensions, PixelRatio, Platform } from 'react-native';

/** Snapshot of device/app attributes used by auth and diagnostics. */
export interface DeviceInfoData {
  deviceId: string;
  deviceName: string;
  brand: string;
  model: string;
  deviceModel: string;
  systemName: string;
  systemVersion: string;
  appVersion: string;
  buildNumber: string;
  screenResolution: string;
  manufacturer: string;
  deviceType: string;
  isTablet: boolean;
  os: string;
  osVersion: string;
  platform: string;
}

/**
 * Returns a static/synchronous device snapshot without requiring native third-party modules.
 */
export function getDeviceInfo(): DeviceInfoData {
  const { width, height } = Dimensions.get('window');
  const scale = PixelRatio.get();
  const isTablet = Math.min(width, height) >= 600;

  const constants: any = Platform.constants || {};
  const brand = constants.Brand || constants.Manufacturer || (Platform.OS === 'ios' ? 'Apple' : 'Android');
  const model = constants.Model || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device');

  return {
    deviceId: `dev_${Platform.OS}_${Math.floor(width)}x${Math.floor(height)}`,
    deviceName: `${brand} ${model}`,
    brand,
    model,
    deviceModel: model,
    systemName: Platform.OS === 'ios' ? 'iOS' : 'Android',
    systemVersion: String(Platform.Version),
    appVersion: '1.0.0',
    buildNumber: '42',
    screenResolution: `${Math.round(width * scale)}x${Math.round(height * scale)}`,
    manufacturer: brand,
    deviceType: isTablet ? 'Tablet' : 'Handset',
    isTablet,
    os: Platform.OS,
    osVersion: String(Platform.Version),
    platform: Platform.OS,
  };
}

export default {
  getDeviceInfo,
};
