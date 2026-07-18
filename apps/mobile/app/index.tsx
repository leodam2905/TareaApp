import { useEffect } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { getToken, getRole } from "@/lib/storage";

const APP_VARIANT = (Constants.expoConfig?.extra?.appVariant ?? "customer") as "customer" | "handyman";
const IS_HANDYMAN = APP_VARIANT === "handyman";

const BRAND  = IS_HANDYMAN ? "Tarea Pro" : "Tarea";
const SLOGAN = IS_HANDYMAN ? "Grow your business,\non your schedule" : "Your trusted home\nservice pros";

// A brief native splash (the app icon on white) shows first; this full-screen
// in-app splash then holds with a big logo + slogan while we decide where to route.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Hide the tiny native splash so our big in-app splash is what's seen.
      SplashScreen.hideAsync().catch(() => {});
      // Keep the branded splash readable for a beat.
      const minDelay = new Promise((r) => setTimeout(r, 1800));
      const decide = (async (): Promise<string> => {
        try {
          const token = await getToken();
          if (!token) return "/(auth)/landing";
          // One account works in both apps. The app you opened decides the mode.
          if (!IS_HANDYMAN) return "/(customer)/tabs/dashboard";
          const role = await getRole();
          return role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(handyman)/become-pro";
        } catch {
          return "/(auth)/landing";
        }
      })();

      const [, dest] = await Promise.all([minDelay, decide]);
      router.replace(dest as any);
    })();
  }, []);

  return (
    <View style={s.container}>
      <Image source={require("../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
      <Text style={s.brand}>{BRAND}</Text>
      <Text style={s.slogan}>{SLOGAN}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo:      { width: 260, height: 260, marginBottom: 12 },
  brand:     { color: "#0F172A", fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  slogan:    { color: "#475569", fontSize: 22, fontWeight: "700", textAlign: "center", lineHeight: 30, marginTop: 10 },
});
