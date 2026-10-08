import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Order } from '../modules/orders/types';

export type AuthStackParamList = {
  Login: { redirectTo?: keyof RootStackParamList } | undefined;
  Register: { redirectTo?: keyof RootStackParamList } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
};


export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Orders: undefined;
  OrderDetails: { order: Order };
  CashHandover: undefined;
  Attendance: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  AddressList: undefined;
  AddressForm: { addressToEdit?: any; returnTo?: keyof RootStackParamList } | undefined;
  HelpAndLegal: { initialTab?: 'support' | 'terms' | 'privacy' } | undefined;
  Auth: { screen?: keyof AuthStackParamList; params?: any } | undefined;
};


export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
