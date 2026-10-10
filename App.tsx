/**
 * LB Delivery Partner Application
 * Main Entry Point
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastContainer, StatusModalProvider } from './src/components';
import { AuthProvider } from './src/modules/auth';
import { LocationProvider } from './src/modules/location';
import { AddressProvider } from './src/modules/profile';
import { WishlistProvider } from './src/modules/products';
import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <AddressProvider>
              <WishlistProvider>
                <StatusModalProvider>
                  <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

                  <RootNavigator />
                  <AppToastContainer />
                </StatusModalProvider>
              </WishlistProvider>
            </AddressProvider>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
