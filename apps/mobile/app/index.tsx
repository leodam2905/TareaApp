import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as SecureStore from "expo-secure-store";
import { colors, fontSize, radius, spacing } from "../constants/theme";

const HERO_VIDEO = "https://res.cloudinary.com/damk2dpd4/video/upload/v1778893570/hero-video.mp4";

export default function WelcomeScreen() {
  const router = useRouter();
  const player = useVideoPlayer(HERO_VIDEO, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    SecureStore.getItemAsync("tarea_token").then((token) => {
      SecureStore.getItemAsync("tarea_role").then((role) => {
        if (token && role) {
          router.replace(role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
        }
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Fullscreen video background */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.brand}>Tarea</Text>
        <Text style={styles.tagline}>Your trusted handyman platform</Text>

        <Pressable style={styles.btnPrimary} onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </Pressable>

        <Pressable style={styles.btnOutline} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.btnOutlineText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F2560" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,20,50,0.55)" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  brand: { fontSize: 52, fontWeight: "900", color: colors.white },
  tagline: { fontSize: fontSize.base, color: colors.skyBlue, textAlign: "center", marginBottom: spacing.lg },
  btnPrimary: { width: "100%", backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
  btnPrimaryText: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  btnOutline: { width: "100%", borderRadius: radius.lg, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 16, alignItems: "center" },
  btnOutlineText: { fontSize: fontSize.base, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
});
