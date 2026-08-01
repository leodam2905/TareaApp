import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import BackBar from "@/components/ui/BackBar";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Application = {
  id: string;
  message: string | null;
  proposedPrice: number | null;
  status: string;
  user: { name: string; avatarUrl: string | null };
  handyman: { rating: number; totalJobs: number; bio: string | null };
};
type JobRequest = {
  id: string;
  title: string;
  category: string;
  city: string;
  status: string; // OPEN, ASSIGNED, CLOSED
  budgetMin: number;
  budgetMax: number;
  scheduledAt: string;
  applications: Application[];
};

const STATUS_COLOR: Record<string, string> = { OPEN: C.sky, ASSIGNED: C.emerald, CLOSED: "#64748B" };

export default function MyRequests() {
  const [requests, setRequests]   = useState<JobRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]           = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get("/job-requests");
      if (res.ok) setRequests(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const choose = (req: JobRequest, app: Application) => {
    Alert.alert(
      "Choose this pro?",
      `Assign "${req.title}" to ${app.user.name}? This creates a booking and declines the other applicants.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose",
          onPress: async () => {
            setBusy(app.id);
            try {
              const res = await api.patch(`/job-requests/${req.id}/applications/${app.id}`, { action: "accept" });
              if (res.ok) {
                Alert.alert("Booked!", `${app.user.name} has been assigned to your job.`);
                await load();
              } else {
                const e = await res.json().catch(() => ({}));
                Alert.alert("Couldn't assign", e.error ?? "Please try again.");
              }
            } catch {
              Alert.alert("Error", "Network error. Check your connection.");
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  const renderApp = (req: JobRequest, app: Application) => (
    <View key={app.id} style={s.appRow}>
      <View style={s.avatar}>
        {app.user.avatarUrl
          ? <Image source={{ uri: app.user.avatarUrl }} style={s.avatarImg} />
          : <Text style={s.avatarTxt}>{app.user.name?.[0]?.toUpperCase() ?? "?"}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.appName}>{app.user.name}</Text>
        <View style={s.appMetaRow}>
          <Text style={s.stars}>{"★".repeat(Math.round(app.handyman?.rating || 0)) || "—"}</Text>
          <Text style={s.appMeta}>{app.handyman?.totalJobs ?? 0} jobs</Text>
          {app.proposedPrice != null && <Text style={s.appPrice}>${app.proposedPrice}</Text>}
        </View>
        {!!app.message && <Text style={s.appMsg} numberOfLines={2}>{app.message}</Text>}
      </View>
      {req.status === "OPEN" && app.status !== "REJECTED" && (
        <TouchableOpacity style={s.chooseBtn} onPress={() => choose(req, app)} disabled={busy === app.id}>
          {busy === app.id ? <ActivityIndicator size="small" color={C.ink} /> : <Text style={s.chooseTxt}>Choose</Text>}
        </TouchableOpacity>
      )}
      {app.status === "ACCEPTED" && (
        <View style={s.hiredTag}><Text style={s.hiredTxt}>Hired</Text></View>
      )}
    </View>
  );

  const renderItem = ({ item: req }: { item: JobRequest }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={s.cardTitle}>{req.title}</Text>
          <Text style={s.meta}>{req.category.replace(/_/g, " ")} · {req.city}</Text>
          <Text style={s.meta}>
            Budget ${req.budgetMin}–${req.budgetMax} · {new Date(req.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: (STATUS_COLOR[req.status] ?? "#64748B") + "22" }]}>
          <Text style={[s.badgeTxt, { color: STATUS_COLOR[req.status] ?? "#64748B" }]}>{req.status}</Text>
        </View>
      </View>
      <Text style={s.appsHeader}>
        {req.applications.length} {req.applications.length === 1 ? "application" : "applications"}
      </Text>
      {req.applications.length === 0
        ? <Text style={s.emptyApps}>No applications yet — nearby pros have been notified.</Text>
        : req.applications.map(app => renderApp(req, app))}
    </View>
  );

  if (loading) {
    return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 64 }} color={C.sky} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <BackBar fallback="/(customer)/tabs/dashboard" />
      <View style={s.header}><Text style={s.h1}>My Requests</Text></View>
      <FlatList
        data={requests}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />
        }
        ListEmptyComponent={<Text style={s.emptyBig}>You haven't posted any jobs yet.</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#FFFFFF" },
  header:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  h1:          { color: "#0F172A", fontSize: 24, fontWeight: "900" },
  card:        { backgroundColor: "#F1F5F9", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cardTitle:   { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  meta:        { color: "#64748B", fontSize: 12, marginTop: 2 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start" },
  badgeTxt:    { fontSize: 11, fontWeight: "800" },
  appsHeader:  { color: "#334155", fontSize: 12, fontWeight: "700", marginTop: 6, marginBottom: 4 },
  emptyApps:   { color: "#94A3B8", fontSize: 13, fontStyle: "italic", paddingVertical: 6 },
  emptyBig:    { color: "#64748B", textAlign: "center", marginTop: 64, fontSize: 15 },
  appRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.sky, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg:   { width: 40, height: 40 },
  avatarTxt:   { color: C.ink, fontWeight: "800", fontSize: 16 },
  appName:     { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  appMetaRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  stars:       { color: C.amber, fontSize: 12 },
  appMeta:     { color: "#64748B", fontSize: 12 },
  appPrice:    { color: C.emerald, fontSize: 12, fontWeight: "800" },
  appMsg:      { color: "#64748B", fontSize: 12, marginTop: 3 },
  chooseBtn:   { backgroundColor: C.sky, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, minWidth: 78, alignItems: "center" },
  chooseTxt:   { color: C.ink, fontWeight: "800", fontSize: 13 },
  hiredTag:    { backgroundColor: C.emerald + "22", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  hiredTxt:    { color: C.emerald, fontWeight: "800", fontSize: 12 },
});
