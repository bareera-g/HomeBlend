import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RoomCodeScreen from './src/screens/RoomCodeScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { B } from './src/lib/theme';

const Stack = createNativeStackNavigator();

const WarmTheme = {
  dark: false,
  colors: {
    primary: B.gold,
    background: B.bg,
    card: B.bgPanel,
    text: B.ink,
    border: B.border,
    notification: B.error,
  },
};

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={B.gold} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: B.bg },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="RoomCode" component={RoomCodeScreen} />
          <Stack.Screen name="Swipe" component={SwipeScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={WarmTheme}>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: B.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
