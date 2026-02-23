// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  Home,
  PlusCircle,
  User,
} from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

function TabIcon({
  Icon,
  color,
  focused,
}: {
  Icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused ? styles.iconWrapActive : null]}>
      <Icon color={color} size={18} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tint = colors.primary;
  const bg = '#020617';
  const border = 'rgba(15,23,42,1)';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 7,
        },
        tabBarItemStyle: {
          marginHorizontal: 3,
          borderRadius: radii.button,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Home} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="add-workout"
        options={{
          title: t('tabs.add'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={PlusCircle} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tabs.calendar'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CalendarDays} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={BarChart3} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={User} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    minWidth: 34,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
  },
  iconWrapActive: {
    backgroundColor: '#1f1438',
    borderWidth: 1,
    borderColor: '#4c1d95',
  },
});
