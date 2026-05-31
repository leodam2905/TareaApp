import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Share, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

export default function ReferEarnScreen() {
  const [code,          setCode]          = useState("");
  const [referredCount, setReferredCount] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [copied,        setCopied]        = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/referrals/my-code");
    if (res.ok) {
      const data = await res.json();
      setCode(data.code ?? "");
      setReferredCount(data.referredCount ?? 0);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Use my code ${code} on Tarea to get a discount on your first booking! Download the app at https://taptarea.com`,
        title: "Join Tarea — Handyman App",
      });
    } catch {
      Alert.alert("Error", "Could not open share sheet.");
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🎁</Text>
          <Text style={s.heroTitle}>Refer & Earn</Text>
          <Text style={s.heroSub}>Share your code with friends. Every time someone signs up using your code, you both win.</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{referredCount}</Text>
            <Text style={s.statLabel}>Friends Referred</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: C.emerald }]}>${(referredCount * 10).toFixed(0)}</Text>
            <Text style={s.statLabel}>Credits Earned</Text>
          </View>
        </View>

        {/* Code */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>Your Referral Code</Text>
          <View style={s.codeBox}>
            <Text style={s.codeText}>{code || "Loading…"}</Text>
          </View>
          <View style={s.codeActions}>
            <TouchableOpacity style={[s.actionBtn, copied && s.actionBtnDone]} onPress={copy}>
              <Text style={s.actionBtnText}>{copied ? "✓ Copied!" : "📋 Copy"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.shareBtn]} onPress={shareCode}>
              <Text style={[s.actionBtnText, { color: C.ink }]}>🔗 Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How it works */}
        <View style={s.howCard}>
          <Text style={s.howTitle}>How it works</Text>
          {[
            { step: "1", text: "Share your unique referral code with friends" },
            { step: "2", text: "They sign up on Tarea using your code" },
            { step: "3", text: "You both get $10 credit on your next booking" },
          ].map(({ step, text }) => (
            <View key={step} style={s.howRow}>
              <View style={s.stepBadge}><Text style={s.stepNum}>{step}</Text></View>
              <Text style={s.howText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  scroll:        { padding: 20 },
  hero:          { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroEmoji:     { fontSize: 56 },
  heroTitle:     { color: C.white, fontSize: 28, fontWeight: "900" },
  heroSub:       { color: C.slate400, fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  statsRow:      { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard:      { flex: 1, backgroundColor: "#1E293B", borderRadius: 16, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  statValue:     { color: C.sky, fontSize: 32, fontWeight: "900" },
  statLabel:     { color: C.slate400, fontSize: 12, marginTop: 4 },
  codeCard:      { backgroundColor: "#1E293B", borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 16 },
  codeLabel:     { color: C.slate400, fontSize: 13, fontWeight: "700" },
  codeBox:       { backgroundColor: "rgba(56,189,248,0.08)", borderRadius: 14, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", borderStyle: "dashed" },
  codeText:      { color: C.sky, fontSize: 30, fontWeight: "900", letterSpacing: 6 },
  codeActions:   { flexDirection: "row", gap: 10 },
  actionBtn:     { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  actionBtnDone: { backgroundColor: C.emerald + "22" },
  shareBtn:      { backgroundColor: C.sky },
  actionBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },
  howCard:       { backgroundColor: "#1E293B", borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  howTitle:      { color: C.white, fontWeight: "800", fontSize: 16 },
  howRow:        { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBadge:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" },
  stepNum:       { color: C.ink, fontWeight: "900", fontSize: 15 },
  howText:       { color: C.slate300, fontSize: 14, flex: 1, lineHeight: 20 },
});
