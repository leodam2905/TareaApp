import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B",
  ACCEPTED: "#38BDF8",
  IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
  DISPUTED: "#EF4444",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_START = 6;  // 6am
const HOUR_END = 22;   // 10pm
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

interface Booking {
  id: string;
  status: string;
  scheduledAt: string;
  service: { title: string };
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString(undefined, opts)} – ${sunday.toLocaleDateString(undefined, opts)}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(() => {
    setLoading(true);
    api.get("/bookings")
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data?.bookings ?? [];
        setBookings(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  // Build day columns: array of 7 Dates (Mon-Sun)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Group bookings by day (Mon=0 ... Sun=6) within this week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const bookingsByDay: Booking[][] = Array.from({ length: 7 }, () => []);
  for (const b of bookings) {
    const d = new Date(b.scheduledAt);
    if (d >= weekStart && d < weekEnd) {
      // 0=Mon, 1=Tue...6=Sun
      const dayIndex = (d.getDay() + 6) % 7;
      bookingsByDay[dayIndex].push(b);
    }
  }

  const HOUR_ROW_H = 48; // px per hour row
  const COL_W = 110;     // px per day column
  const TIME_COL_W = 40;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.navRow}>
          <Pressable onPress={prevWeek} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={nextWeek} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.skyBlue} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Day column headers */}
          <View style={[styles.dayHeaders, { paddingLeft: TIME_COL_W }]}>
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <View key={i} style={[styles.dayHeaderCell, { width: COL_W }]}>
                  <Text style={[styles.dayName, isToday && { color: colors.skyBlue }]}>
                    {DAY_LABELS[i]}
                  </Text>
                  <Text style={[styles.dayNum, isToday && { color: colors.skyBlue, fontWeight: "800" }]}>
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Grid */}
          <View style={{ flexDirection: "row" }}>
            {/* Time column */}
            <View style={{ width: TIME_COL_W }}>
              {HOURS.map((h) => (
                <View key={h} style={[styles.timeCell, { height: HOUR_ROW_H }]}>
                  <Text style={styles.timeLabel}>{h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}</Text>
                </View>
              ))}
            </View>

            {/* Day columns */}
            {days.map((_, dayIdx) => (
              <View key={dayIdx} style={{ width: COL_W, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.06)" }}>
                {HOURS.map((h) => (
                  <View key={h} style={[styles.gridCell, { height: HOUR_ROW_H }]} />
                ))}
                {/* Booking blocks — positioned absolutely over the grid */}
                {bookingsByDay[dayIdx].map((b) => {
                  const dt = new Date(b.scheduledAt);
                  const hour = dt.getHours() + dt.getMinutes() / 60;
                  const topOffset = Math.max(0, (hour - HOUR_START) * HOUR_ROW_H);
                  const blockH = HOUR_ROW_H - 4;
                  const color = STATUS_COLORS[b.status] ?? "#64748B";

                  if (hour < HOUR_START || hour >= HOUR_END) return null;

                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push(`/booking/${b.id}` as never)}
                      style={[
                        styles.bookingBlock,
                        {
                          top: topOffset,
                          height: blockH,
                          backgroundColor: color + "30",
                          borderColor: color,
                        },
                      ]}
                    >
                      <Text style={[styles.bookingText, { color }]} numberOfLines={2}>
                        {b.service?.title ?? "Booking"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.white,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    width: 36,
    alignItems: "center",
  },
  navArrow: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  weekLabel: {
    color: colors.white,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeaders: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dayHeaderCell: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.06)",
  },
  dayName: {
    color: colors.inkSubtle,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayNum: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: "600",
    marginTop: 2,
  },
  timeCell: {
    justifyContent: "flex-start",
    paddingTop: 2,
    paddingRight: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  timeLabel: {
    color: colors.inkSubtle,
    fontSize: 9,
    textAlign: "right",
  },
  gridCell: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  bookingBlock: {
    position: "absolute",
    left: 2,
    right: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
    overflow: "hidden",
  },
  bookingText: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
  },
});
