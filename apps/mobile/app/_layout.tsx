import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@schichtwerk/ui-tokens";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.foreground,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Anmelden" }} />
      </Stack>
    </>
  );
}
