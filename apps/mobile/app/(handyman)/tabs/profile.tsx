import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { clearAuth, getToken } from "@/lib/storage";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

type Profile = { name: string; email: string; phone: string | null; avatarUrl: string | null; handymanProfile: { bio: string | null; hourlyRate: number; idFrontUrl: string | null; idBackUrl: string | null; licenseNumber: string | null; licenseDocUrl: string | null; insuranceDocUrl: string | null } | null };

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm]       = useState({ name: "", phone: "", bio: "", hourlyRate: "" });
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/profile");
    if (res.ok) {
      const d = await res.json();
      setProfile(d);
      setForm({ name: d.name || "", phone: d.phone || "", bio: d.handymanProfile?.bio || "", hourlyRate: String(d.handymanProfile?.hourlyRate || "") });
    }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const uploadPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to upload a profile picture"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    const form = new FormData();
    form.append("file", { uri: asset.uri, name: "avatar.jpg", type: "image/jpeg" } as any);
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/upload/avatar`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setProfile(p => p ? { ...p, avatarUrl: d.url } : p); Alert.alert("Success", "Photo updated!"); }
    else Alert.alert("Error", "Upload failed");
    setUploading(false);
  };

  const save = async () => {
    if (!profile?.avatarUrl) { Alert.alert("Required", "Please upload a profile photo first"); return; }
    if (!profile.handymanProfile?.idFrontUrl) { Alert.alert("Required", "Please upload your government ID (front) in the Documents section"); return; }
    if (!form.name.trim()) { Alert.alert("Required", "Name is required"); return; }
    setSaving(true);
    const res = await api.patch("/profile", form);
    if (res.ok) Alert.alert("Saved", "Profile updated!");
    else Alert.alert("Error", "Failed to save");
    setSaving(false);
  };

  const logout = async () => { await clearAuth(); router.replace("/(auth)/landing" as any); };

  const [updating, setUpdating] = useState(false);
  const checkForUpdates = async () => {
    setUpdating(true);
    try {
      // Download the latest update if the server has a newer one. If it was
      // already fetched in the background on a prior launch, this is a no-op —
      // either way we then reloadAsync() to APPLY whatever's downloaded, which
      // fixes the case where a pending update never got applied.
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setUpdating(false);
      Alert.alert("Couldn't update", "Please check your connection and try again.");
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and personal data (profile, documents, and contact info). This cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete("/account");
              if (res.ok) {
                await clearAuth();
                Alert.alert("Account Deleted", "Your account and personal data have been deleted.");
                router.replace("/(auth)/landing" as any);
              } else {
                Alert.alert("Error", "Could not delete your account. Please try again or contact support@taptarea.com.");
              }
            } catch {
              Alert.alert("Error", "Network error. Please check your connection and try again.");
            }
          },
        },
      ]
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  const hp = profile?.handymanProfile;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity style={s.avatarWrap} onPress={uploadPhoto} disabled={uploading}>
          {profile?.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}><Text style={s.avatarInitial}>{profile?.name?.[0]?.toUpperCase()}</Text></View>}
          <View style={s.avatarBadge}>
            <Text style={s.avatarBadgeText}>{uploading ? "…" : "📷"}</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.avatarHint}>Tap to change photo {!profile?.avatarUrl ? "⚠️ Required" : ""}</Text>

        {/* Form */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Personal Info</Text>
          {[
            { label: "Full Name *", key: "name", placeholder: "Your name" },
            { label: "Phone", key: "phone", placeholder: "+1 (555) 000-0000" },
            { label: "Bio", key: "bio", placeholder: "Tell customers about yourself…", multiline: true },
            { label: "Hourly Rate ($)", key: "hourlyRate", placeholder: "75", numeric: true },
          ].map(f => (
            <View key={f.key} style={s.field}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput style={[s.input, f.multiline && s.inputMulti]}
                value={form[f.key as keyof typeof form]}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                placeholder={f.placeholder} placeholderTextColor={C.slate500}
                multiline={f.multiline} keyboardType={f.numeric ? "numeric" : "default"} />
            </View>
          ))}
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={save} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save Profile"}</Text>
          </TouchableOpacity>
        </View>

        {/* Documents */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Documents</Text>
          <TouchableOpacity style={s.docBtn} onPress={() => router.push("/(handyman)/onboarding-profile")}>
            <View>
              <Text style={s.docBtnTitle}>Gov ID, License & Insurance</Text>
              <Text style={s.docBtnSub}>
                {hp?.idFrontUrl ? "✅ ID uploaded" : "⚠️ ID required"} · {hp?.licenseDocUrl ? "✅ License" : "— No license"} · {hp?.insuranceDocUrl ? "✅ Insurance" : "— No insurance"}
              </Text>
            </View>
            <Text style={s.docArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Setup checklist link */}
        <TouchableOpacity style={s.checklistBtn} onPress={() => router.push("/(handyman)/setup-checklist")}>
          <Text style={s.checklistBtnText}>📋 View Setup Checklist</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.updateBtn} onPress={checkForUpdates} disabled={updating}>
          {updating
            ? <ActivityIndicator color={C.sky} />
            : <Text style={s.updateBtnText}>⬇️  Check for Updates</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={deleteAccount}>
          <Text style={s.deleteText}>Delete Account</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  scroll:            { flex: 1 },
  center:            { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  header:            { padding: 24, paddingBottom: 12 },
  title:             { color: C.text, fontSize: 28, fontWeight: "900" },
  avatarWrap:        { alignSelf: "center", marginBottom: 6 },
  avatar:            { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(56,189,248,0.2)", alignItems: "center", justifyContent: "center" },
  avatarInitial:     { color: C.sky, fontSize: 36, fontWeight: "900" },
  avatarBadge:       { position: "absolute", bottom: 0, right: 0, backgroundColor: C.sky, borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  avatarBadgeText:   { fontSize: 12 },
  avatarHint:        { textAlign: "center", color: C.slate500, fontSize: 12, marginBottom: 16 },
  card:              { margin: 16, marginBottom: 0, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line },
  cardTitle:         { color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 14 },
  field:             { marginBottom: 12 },
  label:             { color: C.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input:             { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14 },
  inputMulti:        { minHeight: 80, textAlignVertical: "top" },
  saveBtn:           { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  saveBtnDisabled:   { opacity: 0.5 },
  saveBtnText:       { color: C.ink, fontWeight: "800", fontSize: 15 },
  docBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line },
  docBtnTitle:       { color: C.text, fontWeight: "600", fontSize: 14 },
  docBtnSub:         { color: C.textMuted, fontSize: 12, marginTop: 3 },
  docArrow:          { color: C.sky, fontSize: 22 },
  checklistBtn:      { margin: 16, marginBottom: 0, backgroundColor: "rgba(56,189,248,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  checklistBtnText:  { color: C.sky, fontWeight: "700", fontSize: 14 },
  updateBtn:         { margin: 16, marginBottom: 0, backgroundColor: "rgba(56,189,248,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  updateBtnText:     { color: C.sky, fontWeight: "700", fontSize: 14 },
  logoutBtn:         { margin: 16, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  logoutText:        { color: C.red, fontWeight: "700", fontSize: 14 },
  deleteBtn:         { marginHorizontal: 16, marginBottom: 28, paddingVertical: 14, alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.45)", backgroundColor: "rgba(239,68,68,0.06)" },
  deleteText:        { color: C.red, fontWeight: "700", fontSize: 15 },
});
