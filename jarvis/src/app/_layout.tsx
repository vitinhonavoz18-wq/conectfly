import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import type { ColorValue } from 'react-native';
import { JarvisProvider } from '../state/JarvisProvider';
import { ConfirmModal } from '../ui/ConfirmModal';
import { colors } from '../ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function RootLayout() {
  return (
    <JarvisProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.cyan,
          tabBarInactiveTintColor: colors.textDim,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('radio-button-on') }} />
        <Tabs.Screen name="chat" options={{ title: 'Conversa', tabBarIcon: icon('chatbubbles-outline') }} />
        <Tabs.Screen name="actions" options={{ title: 'Ações', tabBarIcon: icon('flash-outline') }} />
        <Tabs.Screen name="devices" options={{ title: 'Dispositivos', tabBarIcon: icon('bluetooth') }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
      </Tabs>
      <ConfirmModal />
    </JarvisProvider>
  );
}
