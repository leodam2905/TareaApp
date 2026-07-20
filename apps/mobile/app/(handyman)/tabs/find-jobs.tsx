import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Job as DetailJob } from "@/components/JobDetailsScreen";

type Job = { id: string; title: string; category: string; description: string; city: string; budgetMin: number; budgetMax: number; scheduledAt: string; distanceKm: number | null; applications: { id: string }[]; customer: { name: string } };
type Checklist = { ica: boolean; profile: boolean; services: boolean; availability: boolean; backgroundCheck: boolean; stripe: boolean };

const STEPS = [
  { key: "ica",             label: "Sign Agreement",     href: "/(handyman)/ica" },
  { key: "profile",         label: "Complete Profile",   href: "/(handyman)/onboarding-profile" },
  { key: "services",        label: "Add Services",       href: "/(handyman)/onboarding-services" },
  { key: "availability",    label: "Set Availability",   href: "/(handyman)/onboarding-availability" },
  { key: "backgroundCheck", label: "Background Check",  href: "/(handyman)/background-check" },
  { key: "stripe",          label: "Connect Payout",    href: "/(handyman)/tabs/earnings" },
] as const;

// Map an open job request to the JobDetailsScreen shape.
function toDetailJob(j: Job): DetailJob {
  return {
    id: j.id,
    title: j.title,
    category: (j.category || "General").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    description: j.description,
    price: j.budgetMax || j.budgetMin,
    currency: "USD",
    pricingType: "fixed",
    distanceMiles: j.distanceKm != null ? Math.round(j.distanceKm * 0.621371 * 10) / 10 : 0,
    address: j.city,
    preferredDate: new Date(j.scheduledAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    preferredTime: new Date(j.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    estimatedDuration: "To be discussed",
    customerProvides: [],
    customer: {
      id: "",
      name: j.customer?.name || "Customer",
      initials: (j.customer?.name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(),
      rating: 0, reviewCount: 0, verified: false, joinedDate: "",
    },
    status: "available",
  };
}

export default function FindJobsScreen() {
  const router = useRouter();
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [cRes, jRes] = await Promise.all([
      api.get("/handyman/checklist"),
      api.get("/job-requests"),
    ]);
    if (cRes.ok) setChecklist(await cRes.json());
    if (jRes.ok) { const d = await jRes.json(); if (Array.isArray(d)) setJobs(d); }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openJob = (job: Job) =>
    router.push({ pathname: "/(handyman)/job-request-detail" as any, params: { job: JSON.stringify(toDetailJob(job)) } });

  const setupDone = checklist ? Object.values(checklist).every(Boolean) : false;
  const completedCount = checklist ? Object.values(checklist).filter(Boolean).length : 0;

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <Text style={s.title}>Find Jobs</Text>
          <Text style={s.sub}>Browse open job requests near you</Text>
        </View>

        {/* Checklist gate */}
        {checklist && !setupDone && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Complete setup to browse jobs</Text>
            <Text style={s.cardSub}>{completedCount}/6 steps done</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(completedCount / 6) * 100}%` as any }]} />
            </View>
            {STEPS.map(step => {
              const done = checklist[step.key as keyof Checklist];
              return (
                <TouchableOpacity key={step.key} style={[s.stepRow, done && s.stepDone]}
                  onPress={() => !done && router.push(step.href as any)}>
                  <Text style={s.stepEmoji}>{done ? "✅" : "⭕"}</Text>
                  <Text style={[s.stepLabel, done && s.stepLabelDone]}>{step.label}</Text>
                  {!done && <Text style={s.stepArrow}>›</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Jobs */}
        {setupDone && jobs.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🎉</Text>
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptySub}>No new job requests right now. Check back soon.</Text>
          </View>
        )}

        {setupDone && jobs.map((job, i) => (
          <TouchableOpacity key={job.id} style={[s.jobCard, i === 0 && s.jobCardTop]} activeOpacity={0.85} onPress={() => openJob(job)}>
            {i === 0 && <Text style={s.bestMatch}>⭐ Best match</Text>}
            <View style={s.jobHeader}>
              <View style={s.jobInfo}>
                <Text style={s.jobTitle}>{job.title}</Text>
                <Text style={s.jobCity}>📍 {job.city}{job.distanceKm != null ? ` · ${job.distanceKm.toFixed(0)} km` : ""}</Text>
              </View>
              <Text style={s.jobBudget}>${job.budgetMin}–${job.budgetMax}</Text>
            </View>
            <Text style={s.jobDesc} numberOfLines={2}>{job.description}</Text>
            {job.applications.length > 0 && <Text style={s.jobApps}>⚡ {job.applications.length} applied</Text>}
            <View style={s.jobActions}>
              <View style={s.viewBtn}><Text style={s.viewBtnText}>View details →</Text></View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1 },
  center:         { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  header:         { padding: 24, paddingBottom: 12 },
  title:          { color: C.text, fontSize: 28, fontWeight: "900" },
  sub:            { color: C.textMuted, fontSize: 14, marginTop: 2 },
  card:           { margin: 16, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line },
  cardTitle:      { color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 2 },
  cardSub:        { color: C.textMuted, fontSize: 13, marginBottom: 12 },
  progressTrack:  { height: 5, backgroundColor: C.surface, borderRadius: 3, marginBottom: 14 },
  progressFill:   { height: 5, backgroundColor: C.orange, borderRadius: 3 },
  stepRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  stepDone:       {},
  stepEmoji:      { fontSize: 16 },
  stepLabel:      { flex: 1, color: C.text, fontSize: 14, fontWeight: "600" },
  stepLabelDone:  { color: C.slate500, textDecorationLine: "line-through" },
  stepArrow:      { color: C.sky, fontSize: 20, fontWeight: "300" },
  empty:          { alignItems: "center", padding: 48, gap: 8 },
  emptyEmoji:     { fontSize: 40 },
  emptyTitle:     { color: C.text, fontSize: 18, fontWeight: "800" },
  emptySub:       { color: C.textMuted, textAlign: "center", fontSize: 14 },
  jobCard:        { margin: 16, marginBottom: 0, backgroundColor: C.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line },
  jobCardTop:     { borderColor: C.orange },
  bestMatch:      { color: C.orange, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  jobHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  jobInfo:        { flex: 1 },
  jobTitle:       { color: C.text, fontWeight: "800", fontSize: 16 },
  jobCity:        { color: C.textMuted, fontSize: 12, marginTop: 2 },
  jobBudget:      { color: C.emerald, fontWeight: "800", fontSize: 15 },
  jobDesc:        { color: C.textMuted, fontSize: 13, lineHeight: 19 },
  jobApps:        { color: C.amber, fontSize: 12, marginTop: 6 },
  jobActions:     { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn:        { flex: 1, backgroundColor: "#EFF5FF", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  viewBtnText:    { color: "#2563EB", fontWeight: "800", fontSize: 14 },
});
