/**
 * LB Delivery Partner Application
 * Main Entry Point
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastContainer, StatusModalProvider } from './src/components';
import { AuthProvider } from './src/modules/auth';
import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusModalProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            <RootNavigator />
            <AppToastContainer />
          </StatusModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
