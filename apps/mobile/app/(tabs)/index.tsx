import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getDatabase } from "@/lib/db";
import type { Shift } from "@schichtwerk/types";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
}

export default function WeekScreen() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { from, to } = weekRange();
    try {
      const data = await getDatabase().listMyShifts(from, to);
      setShifts(data);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={shifts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <Text style={styles.heading}>Deine Schichten diese Woche</Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Noch keine Schichten geplant.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.date}>
            {new Intl.DateTimeFormat("de-DE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            }).format(new Date(item.shift_date))}
          </Text>
          <Text style={styles.time}>
            {new Intl.DateTimeFormat("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(item.starts_at))}
            {" – "}
            {new Intl.DateTimeFormat("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(item.ends_at))}
          </Text>
          {item.notes ? (
            <Text style={styles.notes}>{item.notes}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  date: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  time: { fontSize: 14, color: colors.muted, marginTop: 4 },
  notes: { fontSize: 13, color: colors.muted, marginTop: 8 },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.muted, textAlign: "center" },
});
