import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../modules/auth/hooks/useAuth';
import {
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
  ResetPasswordScreen,
} from '../modules/auth/screens';
import { AuthScreenProps, AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  onFinishAuth?: (redirectTo?: string) => void;
  onClose?: () => void;
}

export const AuthNavigator: React.FC<AuthNavigatorProps> = ({
  onFinishAuth,
  onClose,
}) => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8F9FA' },
      }}
    >
      <Stack.Screen name="Login">
        {(props: AuthScreenProps<'Login'>) => (
          <LoginScreen
            onNavigateToRegister={() =>
              props.navigation.navigate('Register', props.route.params)
            }
            onNavigateToForgotPassword={() =>
              props.navigation.navigate('ForgotPassword')
            }
            onLoginSuccess={() => {
              if (onFinishAuth) {
                onFinishAuth(props.route.params?.redirectTo);
              } else if (props.navigation.canGoBack()) {
                props.navigation.goBack();
              }
            }}
            onBack={
              isAuthenticated && (onClose || props.navigation.canGoBack())
                ? () => {
                    if (onClose) onClose();
                    else if (props.navigation.canGoBack()) props.navigation.goBack();
                  }
                : undefined
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {(props: AuthScreenProps<'Register'>) => (
          <RegisterScreen
            onNavigateToLogin={() =>
              props.navigation.navigate('Login', props.route.params)
            }
            onRegisterSuccess={() => {
              if (onFinishAuth) {
                onFinishAuth(props.route.params?.redirectTo);
              } else if (props.navigation.canGoBack()) {
                props.navigation.goBack();
              }
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ForgotPassword">
        {(props: AuthScreenProps<'ForgotPassword'>) => (
          <ForgotPasswordScreen
            onNavigateToLogin={() => props.navigation.navigate('Login')}
            onNavigateToResetPassword={(email?: string) =>
              props.navigation.navigate('ResetPassword', { email })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ResetPassword">
        {(props: AuthScreenProps<'ResetPassword'>) => (
          <ResetPasswordScreen
            initialEmail={props.route.params?.email}
            onNavigateToLogin={() => props.navigation.navigate('Login')}
            onResetSuccess={() => props.navigation.navigate('Login')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
