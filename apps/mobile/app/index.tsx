import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { getToken, getRole, clearAuth } from "@/lib/storage";
import { C } from "@/constants/colors";

const APP_VARIANT = (Constants.expoConfig?.extra?.appVariant ?? "customer") as "customer" | "handyman";
const IS_HANDYMAN = APP_VARIANT === "handyman";
const APP_NAME = IS_HANDYMAN ? "Tarea Pro" : "Tarea Home";
const SLOGAN = IS_HANDYMAN ? "Grow your business, on your schedule" : "Your trusted home service pros";

export default function Index() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    (async () => {
      // Keep the branded splash visible for a beat, even if the auth check is instant.
      const minDelay = new Promise((r) => setTimeout(r, 2200));
      const decide = (async (): Promise<string> => {
        try {
          const token = await getToken();
          const role = await getRole();
          if (!token) return "/(auth)/landing";
          if (IS_HANDYMAN && role === "HANDYMAN") return "/(handyman)/tabs/dashboard";
          if (!IS_HANDYMAN && role === "CUSTOMER") return "/(customer)/tabs/dashboard";
          // Wrong app for this role — clear auth and send to landing
          await clearAuth();
          return "/(auth)/landing";
        } catch {
          return "/(auth)/landing";
        }
      })();

      const [, dest] = await Promise.all([minDelay, decide]);
      router.replace(dest as any);
    })();
  }, []);

  return (
    <View style={s.root}>
      <Animated.View style={[s.center, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🔧</Text></View>
        <Text style={s.name}>{APP_NAME}</Text>
        <Text style={s.slogan}>{SLOGAN}</Text>
      </Animated.View>
      <ActivityIndicator color={C.sky} style={s.spinner} />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  center:   { alignItems: "center" },
  logoWrap: { width: 92, height: 92, borderRadius: 26, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.35)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoEmoji:{ fontSize: 46 },
  name:     { color: C.white, fontSize: 36, fontWeight: "900", letterSpacing: 0.5 },
  slogan:   { color: C.slate400, fontSize: 15, marginTop: 10, textAlign: "center" },
  spinner:  { position: "absolute", bottom: 64 },
});
