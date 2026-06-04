import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@schichtwerk/ui-tokens";

export default function AvailabilityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verfügbarkeit</Text>
      <Text style={styles.text}>
        Markiere Tage, an denen du kannst oder nicht kannst. Die
        Kalender-Eingabe wird als Nächstes angebunden.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  text: { fontSize: 14, color: colors.muted, lineHeight: 22 },
});
