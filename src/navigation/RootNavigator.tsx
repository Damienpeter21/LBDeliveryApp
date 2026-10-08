import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AttendanceScreen } from '../modules/delivery/screens/AttendanceScreen';
import { CashHandoverScreen } from '../modules/delivery/screens/CashHandoverScreen';
import { HomeScreen } from '../modules/home';
import { OrderDetailsScreen, OrdersScreen } from '../modules/orders';
import {
  AddressFormScreen,
  AddressListScreen,
  EditProfileScreen,
  HelpAndLegalScreen,
  NotificationsScreen,
  ProfileScreen,
} from '../modules/profile';

import { SplashScreen } from '../modules/splash';
import { AuthNavigator } from './AuthNavigator';
import { RootScreenProps, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* 0. Brand Splash Screen */}
        <RootStack.Screen name="Splash">
          {(props: RootScreenProps<'Splash'>) => (
            <SplashScreen
              onFinish={() => props.navigation.replace('Home')}
            />
          )}
        </RootStack.Screen>

        {/* 1. Delivery Partner Dashboard */}
        <RootStack.Screen name="Home">
          {(props: RootScreenProps<'Home'>) => (
            <HomeScreen
              onNavigateToOrderDetails={order =>
                props.navigation.navigate('OrderDetails', { order })
              }
              onNavigateToOrders={() => props.navigation.navigate('Orders')}
              onNavigateToAttendance={() => props.navigation.navigate('Attendance')}
              onNavigateToCashHandover={() => props.navigation.navigate('CashHandover')}
              onNavigateToProfile={() => props.navigation.navigate('Profile')}
              onRequireAuth={() =>
                props.navigation.navigate('Auth', { screen: 'Login' })
              }
            />
          )}
        </RootStack.Screen>

        {/* 2. Delivery Orders (Tabs: Available, Active, Delivered, Cancelled) */}
        <RootStack.Screen name="Orders">
          {(props: RootScreenProps<'Orders'>) => (
            <OrdersScreen
              onBack={() => props.navigation.goBack()}
              onNavigateToOrderDetails={order =>
                props.navigation.navigate('OrderDetails', { order })
              }
              onNavigateToLogin={() =>
                props.navigation.navigate('Auth', { screen: 'Login' })
              }
            />
          )}
        </RootStack.Screen>

        {/* 3. Delivery Order Details & Lifecycle Workflow */}
        <RootStack.Screen name="OrderDetails">
          {(props: RootScreenProps<'OrderDetails'>) => (
            <OrderDetailsScreen
              order={props.route.params.order}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 4. Cash Handover & COD Reconciliation */}
        <RootStack.Screen name="CashHandover">
          {(props: RootScreenProps<'CashHandover'>) => (
            <CashHandoverScreen
              onBack={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 5. Shift Attendance & Checkin / Checkout */}
        <RootStack.Screen name="Attendance">
          {(props: RootScreenProps<'Attendance'>) => (
            <AttendanceScreen
              onBack={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 6. Driver Profile */}
        <RootStack.Screen name="Profile">
          {(props: RootScreenProps<'Profile'>) => (
            <ProfileScreen
              onBack={() => props.navigation.goBack()}
              onNavigateToLogin={() =>
                props.navigation.navigate('Auth', { screen: 'Login' })
              }
              onNavigateToOrders={() => props.navigation.navigate('Orders')}
              onNavigateToSavedAddresses={() => {}}
              onNavigateToWishlist={() => props.navigation.navigate('CashHandover')}
              onNavigateToEditProfile={() =>
                props.navigation.navigate('EditProfile')
              }
              onNavigateToNotifications={() =>
                props.navigation.navigate('Notifications')
              }
              onNavigateToHelpAndLegal={initialTab =>
                props.navigation.navigate('HelpAndLegal', { initialTab })
              }
            />
          )}
        </RootStack.Screen>

        {/* 7. Edit Profile */}
        <RootStack.Screen name="EditProfile">
          {(props: RootScreenProps<'EditProfile'>) => (
            <EditProfileScreen
              onBack={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 8. Notifications */}
        <RootStack.Screen name="Notifications">
          {(props: RootScreenProps<'Notifications'>) => (
            <NotificationsScreen
              onBack={() => props.navigation.goBack()}
              onNavigateToOrders={() => props.navigation.navigate('Orders')}
            />
          )}
        </RootStack.Screen>

        {/* 8.5 Saved Address List */}
        <RootStack.Screen name="AddressList">
          {(props: RootScreenProps<'AddressList'>) => (
            <AddressListScreen
              onBack={() => props.navigation.goBack()}
              onNavigateToAddAddress={() => props.navigation.navigate('AddressForm')}
              onNavigateToEditAddress={address => props.navigation.navigate('AddressForm', { addressToEdit: address })}
              onSelectAndReturn={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 8.6 Address Form */}
        <RootStack.Screen name="AddressForm">
          {(props: RootScreenProps<'AddressForm'>) => (
            <AddressFormScreen
              addressToEdit={props.route.params?.addressToEdit}
              onBack={() => props.navigation.goBack()}
              onAddressSaved={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 9. Help & Legal */}

        <RootStack.Screen name="HelpAndLegal">
          {(props: RootScreenProps<'HelpAndLegal'>) => (
            <HelpAndLegalScreen
              initialTab={props.route.params?.initialTab}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </RootStack.Screen>

        {/* 10. Auth Stack */}
        <RootStack.Screen
          name="Auth"
          options={{
            presentation: 'modal',
          }}
        >
          {(props: RootScreenProps<'Auth'>) => (
            <AuthNavigator
              onClose={() => props.navigation.goBack()}
              onFinishAuth={() => {
                props.navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
