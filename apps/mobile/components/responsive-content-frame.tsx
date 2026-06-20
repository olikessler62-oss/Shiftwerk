import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useWeekPlanLayout } from "@/lib/responsive-layout";

type ResponsiveContentFrameProps = {
  children: ReactNode;
};

/** Zentriert den Wochenplan auf Tablet/Desktop mit begrenzter Maximalbreite. */
export function ResponsiveContentFrame({ children }: ResponsiveContentFrameProps) {
  const layout = useWeekPlanLayout();

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.inner,
          layout.contentMaxWidth != null ? { maxWidth: layout.contentMaxWidth } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
});
