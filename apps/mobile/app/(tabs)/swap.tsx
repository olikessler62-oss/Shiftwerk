import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@schichtwerk/ui-tokens";

export default function SwapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schicht tauschen</Text>
      <Text style={styles.text}>
        Wähle eine Schicht und sende eine Tausch-Anfrage. Dein Manager
        genehmigt sie in der Web-App.
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
