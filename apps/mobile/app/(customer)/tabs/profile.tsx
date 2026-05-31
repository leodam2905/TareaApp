import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, API_BASE } from "@/lib/api";
import { getToken, clearAuth } from "@/lib/storage";
import { C } from "@/constants/colors";

export default function CustomerProfileScreen() {
  const router = useRouter();
  const [name, setName]           = useState("");
  const [phone, setPhone]         = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/profile");
      if (res.ok) { const p = await res.json(); setName(p.name ?? ""); setPhone(p.phone ?? ""); setAvatarUrl(p.avatarUrl ?? ""); }
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo Access Required",
        "Please allow Tarea to access your photos in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", { uri: result.assets[0].uri, name: "avatar.jpg", type: "image/jpeg" } as any);
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/upload/avatar`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setAvatarUrl(d.url); }
    else Alert.alert("Upload failed", "Please try again");
    setUploading(false);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter your name"); return; }
    setSaving(true);
    const res = await api.patch("/profile", { name: name.trim(), phone: phone.trim(), avatarUrl });
    if (res.ok) Alert.alert("Saved", "Profile updated successfully");
    else Alert.alert("Error", "Could not save profile");
    setSaving(false);
  };

  const logout = async () => { await clearAuth(); router.replace("/(auth)/login" as any); };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={s.header}><Text style={s.title}>My Profile</Text></View>

        <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar} disabled={uploading}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{name[0] ?? "?"}</Text></View>}
          <View style={s.avatarEdit}>
            {uploading ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.avatarEditText}>✏️</Text>}
          </View>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={C.slate500} />

          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+1 (555) 000-0000" placeholderTextColor={C.slate500} keyboardType="phone-pad" />

          <TouchableOpacity style={[s.btn, (saving || uploading) && s.btnDisabled]} onPress={save} disabled={saving || uploading}>
            {saving ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:        { padding: 24, paddingBottom: 8 },
  title:         { color: C.white, fontSize: 24, fontWeight: "800" },
  avatarWrap:    { alignSelf: "center", marginVertical: 16 },
  avatar:        { width: 96, height: 96, borderRadius: 48 },
  avatarFallback:{ backgroundColor: C.sky + "33", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: C.sky, fontSize: 36, fontWeight: "800" },
  avatarEdit:    { position: "absolute", bottom: 0, right: 0, backgroundColor: C.sky, borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  avatarEditText:{ fontSize: 14 },
  card:          { margin: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  label:         { color: C.slate400, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input:         { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.white, fontSize: 15 },
  btn:           { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  btnDisabled:   { opacity: 0.5 },
  btnText:       { color: C.ink, fontWeight: "800", fontSize: 16 },
  logoutBtn:     { margin: 16, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  logoutText:    { color: C.red, fontWeight: "700", fontSize: 15 },
});