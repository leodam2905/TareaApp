import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { colors, fontSize, radius, spacing } from "../constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();

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
      <Text style={styles.brand}>Tarea</Text>
      <Text style={styles.tagline}>Your trusted handyman platform</Text>

      <Pressable style={styles.btnPrimary} onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.btnPrimaryText}>Get Started</Text>
      </Pressable>

      <Pressable style={styles.btnOutline} onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.btnOutlineText}>I already have an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F2560", alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  brand: { fontSize: 52, fontWeight: "900", color: colors.white },
  tagline: { fontSize: fontSize.base, color: colors.skyBlue, textAlign: "center", marginBottom: spacing.lg },
  btnPrimary: { width: "100%", backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
  btnPrimaryText: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  btnOutline: { width: "100%", borderRadius: radius.lg, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 16, alignItems: "center" },
  btnOutlineText: { fontSize: fontSize.base, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
});
