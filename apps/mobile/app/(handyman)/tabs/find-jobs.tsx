import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function FindJobsScreen() {
  const router = useRouter();
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [applied, setApplied]     = useState<Set<string>>(new Set());
  const [message, setMessage]     = useState("");
  const [price, setPrice]         = useState("");
  const [sending, setSending]     = useState(false);

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

  const apply = async (jobId: string) => {
    setSending(true);
    const res = await api.post(`/job-requests/${jobId}/apply`, { message: message.trim() || null, proposedPrice: price || null });
    if (res.ok) {
      setApplied(p => new Set([...p, jobId]));
      setJobs(p => p.filter(j => j.id !== jobId));
      setExpanded(null); setMessage(""); setPrice("");
    } else {
      const b = await res.json();
      Alert.alert("Error", b.error || "Failed to apply");
    }
    setSending(false);
  };

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

        {setupDone && jobs.map((job, i) => {
          const isExpanded = expanded === job.id;
          const wasApplied = applied.has(job.id);
          return (
            <View key={job.id} style={[s.jobCard, i === 0 && s.jobCardTop]}>
              {i === 0 && <Text style={s.bestMatch}>⭐ Best match</Text>}
              <View style={s.jobHeader}>
                <View style={s.jobInfo}>
                  <Text style={s.jobTitle}>{job.title}</Text>
                  <Text style={s.jobCity}>📍 {job.city}{job.distanceKm != null ? ` · ${job.distanceKm.toFixed(0)} km` : ""}</Text>
                </View>
                <Text style={s.jobBudget}>${job.budgetMin}–${job.budgetMax}</Text>
              </View>
              <Text style={s.jobDesc} numberOfLines={isExpanded ? undefined : 2}>{job.description}</Text>
              {job.applications.length > 0 && <Text style={s.jobApps}>⚡ {job.applications.length} applied</Text>}

              <View style={s.jobActions}>
                <TouchableOpacity style={s.detailBtn} onPress={() => setExpanded(isExpanded ? null : job.id)}>
                  <Text style={s.detailBtnText}>{isExpanded ? "Less" : "Details"}</Text>
                </TouchableOpacity>
                {!wasApplied && !isExpanded && (
                  <TouchableOpacity style={s.applyBtn} onPress={() => setExpanded(job.id)}>
                    <Text style={s.applyBtnText}>Apply →</Text>
                  </TouchableOpacity>
                )}
                {wasApplied && <View style={s.appliedBadge}><Text style={s.appliedText}>✓ Applied</Text></View>}
              </View>

              {isExpanded && !wasApplied && (
                <View style={s.applyForm}>
                  <Text style={s.formLabel}>Message (optional)</Text>
                  <TextInput style={s.formInput} value={message} onChangeText={setMessage}
                    placeholder="Describe your approach…" placeholderTextColor={C.slate500} multiline numberOfLines={3} />
                  <Text style={s.formLabel}>Your price offer $ (optional)</Text>
                  <TextInput style={s.formInput} value={price} onChangeText={setPrice}
                    placeholder="Leave blank to accept budget" placeholderTextColor={C.slate500} keyboardType="numeric" />
                  <View style={s.formBtns}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setExpanded(null)}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.sendBtn, sending && s.sendBtnDisabled]} onPress={() => apply(job.id)} disabled={sending}>
                      <Text style={s.sendBtnText}>{sending ? "Sending…" : "Send Application"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
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
  detailBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.line },
  detailBtnText:  { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  applyBtn:       { flex: 1, backgroundColor: C.sky, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  applyBtnText:   { color: C.ink, fontWeight: "800", fontSize: 14 },
  appliedBadge:   { flex: 1, backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 10, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(16,185,129,0.2)" },
  appliedText:    { color: C.emerald, fontWeight: "700", fontSize: 14 },
  applyForm:      { marginTop: 14, gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  formLabel:      { color: C.textMuted, fontSize: 12, fontWeight: "600" },
  formInput:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, color: C.text, fontSize: 14 },
  formBtns:       { flexDirection: "row", gap: 8, marginTop: 4 },
  cancelBtn:      { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  cancelBtnText:  { color: C.textMuted, fontWeight: "600" },
  sendBtn:        { flex: 2, backgroundColor: C.sky, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  sendBtnDisabled:{ opacity: 0.5 },
  sendBtnText:    { color: C.ink, fontWeight: "800", fontSize: 14 },
});
