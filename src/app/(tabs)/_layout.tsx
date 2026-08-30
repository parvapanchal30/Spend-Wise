import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icons: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  transactions: { active: 'receipt', inactive: 'receipt-outline' },
  guardian: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => {
          const icon = icons[route.name] ?? icons.index!;
          return <Ionicons color={color} name={focused ? icon.active : icon.inactive} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="guardian" options={{ title: 'Guardian' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
