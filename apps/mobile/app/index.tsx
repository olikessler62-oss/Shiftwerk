import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/lib/db";
import { colors } from "@schichtwerk/ui-tokens";

export default function Index() {
  useEffect(() => {
    (async () => {
      const db = getDatabase();
      const session = await db.authGetSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const profile = await db.getCurrentUserProfile();
      if (!profile || profile.role !== "basic") {
        await db.authSignOut();
        router.replace("/login");
        return;
      }

      router.replace("/(tabs)");
    })();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
