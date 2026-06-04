import { Tabs } from "expo-router";
import { colors } from "@schichtwerk/ui-tokens";

export default function TabsLayout() {
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
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Meine Woche", tabBarLabel: "Woche" }}
      />
      <Tabs.Screen
        name="availability"
        options={{ title: "Verfügbarkeit", tabBarLabel: "Verfügbar" }}
      />
      <Tabs.Screen name="swap" options={{ title: "Tausch", tabBarLabel: "Tausch" }} />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarLabel: "Profil" }}
      />
    </Tabs>
  );
}
