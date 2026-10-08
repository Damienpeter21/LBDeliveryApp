/**
 * Application Navigation Route Constants
 * Standard type-safe route names for LB Delivery Partner App
 */

export const APP_ROUTES = {
  SPLASH: 'Splash',
  HOME: 'Home',
  ORDERS: 'Orders',
  ORDER_DETAILS: 'OrderDetails',
  CASH_HANDOVER: 'CashHandover',
  ATTENDANCE: 'Attendance',
  PROFILE: 'Profile',
  EDIT_PROFILE: 'EditProfile',
  NOTIFICATIONS: 'Notifications',
  HELP_AND_LEGAL: 'HelpAndLegal',
  AUTH: 'Auth',
} as const;

export const AUTH_ROUTES = {
  LOGIN: 'Login',
  REGISTER: 'Register',
  FORGOT_PASSWORD: 'ForgotPassword',
} as const;

export type AppRouteName = typeof APP_ROUTES[keyof typeof APP_ROUTES];
export type AuthRouteName = typeof AUTH_ROUTES[keyof typeof AUTH_ROUTES];
