import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { C } from "@/constants/colors";

const VIDEO_URL = "https://res.cloudinary.com/damk2dpd4/video/upload/v1778893570/hero-video.mp4";
const { height } = Dimensions.get("window");

const FEATURES = [
  { emoji: "🔍", title: "Find Verified Pros",  desc: "Browse background-checked handymen near you" },
  { emoji: "📅", title: "Book in Seconds",      desc: "Schedule same-day or in advance, pay securely" },
  { emoji: "⭐", title: "Quality Guaranteed",   desc: "Live job tracking, reviews, and dispute protection" },
];

export default function LandingScreen() {
  const router = useRouter();
  const player = useVideoPlayer(VIDEO_URL, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={s.root}>
      <VideoView player={player} style={s.video} contentFit="cover" nativeControls={false} />
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          <View style={s.hero}>
            <View style={s.logoWrap}>
              <Text style={s.logoEmoji}>🔧</Text>
            </View>
            <Text style={s.brand}>Tarea</Text>
            <Text style={s.tagline}>Your trusted home service pros</Text>
          </View>

          <View style={s.features}>
            {FEATURES.map(f => (
              <View key={f.title} style={s.featureRow}>
                <View style={s.featureIcon}><Text style={s.featureEmoji}>{f.emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* AI Tools */}
          <View style={s.toolsRow}>
            <TouchableOpacity style={s.toolCard} onPress={() => router.push("/diagnose")} activeOpacity={0.85}>
              <Text style={s.toolEmoji}>🔍</Text>
              <Text style={s.toolTitle}>Diagnose Issue</Text>
              <Text style={s.toolDesc}>AI identifies what pro you need</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.toolCard} onPress={() => router.push("/instant-quote")} activeOpacity={0.85}>
              <Text style={s.toolEmoji}>⚡</Text>
              <Text style={s.toolTitle}>Instant Quote</Text>
              <Text style={s.toolDesc}>Get a price before you book</Text>
            </TouchableOpacity>
          </View>

          <View style={s.ctas}>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "CUSTOMER" } })}
            >
              <Text style={s.btnPrimaryText}>Find a Pro</Text>
              <Text style={s.btnPrimarySubtext}>I need home services</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnSecondary}
              onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "HANDYMAN" } })}
            >
              <Text style={s.btnSecondaryText}>Become a Pro</Text>
              <Text style={s.btnSecondarySubtext}>I offer home services</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.signIn} onPress={() => router.push("/(auth)/login" as any)}>
            <Text style={s.signInText}>Already have an account? <Text style={s.signInBold}>Sign in</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#0F172A" },
  video:              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlay:            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.72)" },
  safe:               { flex: 1 },
  scroll:             { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, minHeight: height },

  hero:               { alignItems: "center", paddingTop: 60, paddingBottom: 48 },
  logoWrap:           { width: 88, height: 88, borderRadius: 28, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)" },
  logoEmoji:          { fontSize: 42 },
  brand:              { fontSize: 52, fontWeight: "900", color: C.white, letterSpacing: -2 },
  tagline:            { color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8, textAlign: "center" },

  features:           { gap: 16, marginBottom: 48 },
  featureRow:         { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "rgba(30,41,59,0.75)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  featureIcon:        { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" },
  featureEmoji:       { fontSize: 22 },
  featureTitle:       { color: C.white, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDesc:        { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },

  ctas:               { gap: 12, marginBottom: 28 },
  btnPrimary:         { backgroundColor: C.sky, borderRadius: 18, paddingVertical: 18, alignItems: "center" },
  btnPrimaryText:     { color: C.ink, fontSize: 18, fontWeight: "900" },
  btnPrimarySubtext:  { color: "rgba(15,23,42,0.6)", fontSize: 12, marginTop: 3, fontWeight: "600" },
  btnSecondary:       { backgroundColor: "rgba(30,41,59,0.8)", borderRadius: 18, paddingVertical: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)" },
  btnSecondaryText:   { color: C.white, fontSize: 18, fontWeight: "900" },
  btnSecondarySubtext:{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 3, fontWeight: "600" },

  signIn:             { alignItems: "center" },
  signInText:         { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  signInBold:         { color: C.sky, fontWeight: "700" },

  toolsRow:           { flexDirection: "row", gap: 12, marginBottom: 24 },
  toolCard:           { flex: 1, backgroundColor: "rgba(30,41,59,0.85)", borderRadius: 18, padding: 16, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  toolEmoji:          { fontSize: 28 },
  toolTitle:          { color: "#fff", fontSize: 13, fontWeight: "800", textAlign: "center" },
  toolDesc:           { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", lineHeight: 15 },
});
