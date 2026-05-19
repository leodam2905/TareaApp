import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

interface JobRequest {
  id: string; category: string; title: string; description: string;
  city: string; scheduledAt: string; budgetMin: number; budgetMax: number;
  distanceKm: number | null; score: number;
  customer: { name: string };
  applications: { id: string }[];
}

export default function FindJobsScreen() {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/job-requests");
      setJobs(Array.isArray(res.data) ? res.data : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async (jobId: string) => {
    setSending(jobId);
    try {
      await api.post(`/job-requests/${jobId}/apply`, {
        message: message.trim() || null,
        proposedPrice: price || null,
      });
      setApplied(prev => new Set(Array.from(prev).concat(jobId)));
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setExpanded(null);
      setMessage(""); setPrice("");
      Alert.alert("Applied!", "The customer will be notified.");
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to apply");
    }
    setSending(null);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Jobs</Text>
        <Text style={styles.subtitle}>Open requests matching your skills</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No open requests right now. Check back soon.</Text>
          </View>
        ) : jobs.map((job, i) => {
          const isExpanded = expanded === job.id;
          return (
            <View key={job.id} entering={FadeInDown.delay(i * 50)}>
              <View style={[styles.card, i === 0 && styles.bestCard]}>
                {i === 0 && (
                  <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>⭐ Best match</Text></View>
                )}
                <View style={styles.cardRow}>
                  <Text style={styles.icon}>{CATEGORY_ICONS[job.category] || "🛠️"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.budget}>${job.budgetMin}–${job.budgetMax}</Text>
                    <Text style={styles.meta}>
                      📍 {job.city}{job.distanceKm !== null ? ` · ${job.distanceKm.toFixed(0)} km` : ""}
                      {job.applications.length > 0 ? `  ⚡ ${job.applications.length} applied` : ""}
                    </Text>
                  </View>
                </View>
                {isExpanded && (
                  <View style={styles.expandSection}>
                    <Text style={styles.desc}>{job.description}</Text>
                    <View style={styles.applyForm}>
                      <TextInput
                        style={styles.textarea}
                        placeholder="Message (optional)"
                        placeholderTextColor={colors.inkSubtle}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={2}
                      />
                      <TextInput
                        style={styles.priceInput}
                        placeholder="Your price ($) — optional"
                        placeholderTextColor={colors.inkSubtle}
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                      />
                      <Pressable style={[styles.sendBtn, sending === job.id && { opacity: 0.7 }]}
                        onPress={() => apply(job.id)} disabled={sending === job.id}>
                        <Text style={styles.sendBtnText}>{sending === job.id ? "Sending…" : "Send Application"}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <Pressable style={styles.detailBtn} onPress={() => setExpanded(isExpanded ? null : job.id)}>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.inkSubtle} />
                  <Text style={styles.detailBtnText}>{isExpanded ? "Collapse" : "Apply"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  subtitle: { color: colors.inkSubtle, fontSize: fontSize.sm, marginTop: 2 },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 60, gap: spacing.sm },
  emptyTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.lg },
  emptyText: { color: colors.inkSubtle, fontSize: fontSize.sm, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  bestCard: { borderColor: colors.skyBlue + "50", backgroundColor: colors.skyBlue + "08" },
  bestBadge: { backgroundColor: colors.skyBlue + "20", alignSelf: "flex-start", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: spacing.sm },
  bestBadgeText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: { fontSize: 28, marginTop: 2 },
  jobTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  budget: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.sm, marginTop: 2 },
  meta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 4 },
  expandSection: { marginTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md },
  desc: { color: "rgba(255,255,255,0.65)", fontSize: fontSize.sm, lineHeight: 20 },
  applyForm: { gap: spacing.sm },
  textarea: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.md, color: colors.white, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.cardBorder },
  priceInput: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.md, color: colors.white, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.cardBorder },
  sendBtn: { backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingVertical: 12, alignItems: "center" },
  sendBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.base },
  detailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.md },
  detailBtnText: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
});
