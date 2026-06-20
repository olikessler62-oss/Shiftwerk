import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TABLET_MIN_WIDTH } from "@/lib/responsive-layout";
import {
  PendingConfirmationsProvider,
  usePendingConfirmations,
} from "@/lib/pending-confirmations-context";
import { colors } from "@schichtwerk/ui-tokens";

function TabsLayoutInner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { count } = usePendingConfirmations();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const bottomInset = Math.max(insets.bottom, Platform.OS === "web" ? 12 : 6);
  const tabBarHeight = Platform.OS === "web" ? (isTablet ? 92 : 84) : 52 + bottomInset;
  const tabIconSize = isTablet ? 26 : Platform.OS === "web" ? 22 : 24;
  const badge =
    count > 0 ? (count > 99 ? "99+" : String(count)) : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.foreground,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: isTablet ? 8 : 6,
          paddingBottom: bottomInset,
          ...(isTablet && Platform.OS === "web"
            ? { maxWidth: 920, alignSelf: "center", width: "100%" }
            : null),
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: Platform.OS === "web" ? 4 : 0,
        },
        tabBarLabelStyle: {
          fontSize: isTablet ? 13 : 11,
          fontWeight: "500",
          lineHeight: isTablet ? 16 : 14,
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mein Plan",
          headerShown: false,
          tabBarLabel: "Woche",
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Schicht-Anfragen",
          tabBarLabel: "Anfragen",
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: colors.destructive,
            color: "#fff",
            fontSize: 11,
            minWidth: 18,
          },
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications-outline" size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: "Verfügbarkeit",
          tabBarLabel: "Verfügbar",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time-outline" size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarLabel: "Profil",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={tabIconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <PendingConfirmationsProvider>
      <TabsLayoutInner />
    </PendingConfirmationsProvider>
  );
}
