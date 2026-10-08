import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { RootStackParamList, AuthStackParamList } from '../types';

/**
 * Type-safe navigation hook for the Root Stack
 */
export const useAppNavigation = () => {
  return useNavigation<NavigationProp<RootStackParamList>>();
};

/**
 * Type-safe navigation hook for the Auth Stack
 */
export const useAuthNavigation = () => {
  return useNavigation<NavigationProp<AuthStackParamList>>();
};

/**
 * Type-safe route hook for Root Stack screens
 */
export const useAppRoute = <T extends keyof RootStackParamList>() => {
  return useRoute<RouteProp<RootStackParamList, T>>();
};

/**
 * Type-safe route hook for Auth Stack screens
 */
export const useAuthRoute = <T extends keyof AuthStackParamList>() => {
  return useRoute<RouteProp<AuthStackParamList, T>>();
};
