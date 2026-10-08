declare module 'react-native-vector-icons/Ionicons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export default class Ionicons extends Component<IconProps> {}
}

declare module 'react-native-vector-icons/MaterialIcons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export default class MaterialIcons extends Component<IconProps> {}
}

declare module 'react-native-device-info' {
  const DeviceInfo: {
    getUniqueId: () => Promise<string>;
    getVersion: () => string;
    getBuildNumber: () => string;
    getModel: () => string;
    getSystemVersion: () => string;
    isEmulator: () => Promise<boolean>;
    hasNotch: () => boolean;
    isLocationEnabled: () => Promise<boolean>;
  };
  export default DeviceInfo;
}

declare module 'react-native-razorpay' {
  const RazorpayCheckout: {
    open: (options: any) => Promise<any>;
  };
  export default RazorpayCheckout;
}

declare module 'react-native-toast-message' {
  export interface BaseToastProps {
    text1?: string;
    text2?: string;
    [key: string]: any;
  }
  export type ToastConfig = Record<string, (props: any) => any>;
  const Toast: any;
  export default Toast;
}


declare module '@react-native-community/geolocation' {
  const Geolocation: {
    getCurrentPosition: (
      success: (position: any) => void,
      error?: (error: any) => void,
      options?: any,
    ) => void;
    watchPosition: (
      success: (position: any) => void,
      error?: (error: any) => void,
      options?: any,
    ) => number;
    clearWatch: (watchId: number) => void;
    stopObserving: () => void;
    requestAuthorization: (success?: () => void, error?: (error: any) => void) => void;
    setRNConfiguration: (config: any) => void;
  };
  export default Geolocation;

}
