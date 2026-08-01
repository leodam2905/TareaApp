import { useEffect, useRef } from "react";
import { View, Image, Text, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { getToken, getRole } from "@/lib/storage";

const APP_VARIANT = (Constants.expoConfig?.extra?.appVariant ?? "customer") as "customer" | "handyman";
const IS_HANDYMAN = APP_VARIANT === "handyman";

const BRAND  = IS_HANDYMAN ? "Tarea Pro" : "Tarea";
const SLOGAN = IS_HANDYMAN ? "Grow your business,\non your schedule" : "Your trusted home\nservice pros";

// A brief native splash (the app icon on white) shows first; this full-screen
// in-app splash then holds while we decide where to route.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      SplashScreen.hideAsync().catch(() => {});
      const minDelay = new Promise((r) => setTimeout(r, 2200));
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

  if (!IS_HANDYMAN) return <CustomerSplash />;

  return (
    <View style={s.container}>
      <Image source={require("../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
      <Text style={s.brand}>{BRAND}</Text>
      <Text style={s.slogan}>{SLOGAN}</Text>
    </View>
  );
}

// ── Animated Tarea Home splash ───────────────────────────────────────────────
function CustomerSplash() {
  const logoScale  = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Logo: scale/fade in with a slight overshoot bounce.
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
    // Tagline: fade up, delayed.
    Animated.parallel([
      Animated.timing(tagOpacity, { toValue: 1, duration: 800, delay: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(tagY,       { toValue: 0, duration: 800, delay: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={cs.container}>
      <Animated.View style={[cs.logoGroup, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={cs.iconShadow}>
          <View style={cs.iconClip}>
            <Image source={require("../assets/tarea-home-mark.png")} style={{ width: 88, height: 88 }} />
          </View>
        </View>
        <Text style={cs.brand}>Tarea</Text>
      </Animated.View>
      <Animated.Text style={[cs.tagline, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}>
        Find trusted help, fast.
      </Animated.Text>
      <View style={cs.dots}>
        <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
      </View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1,    duration: 480, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.25, duration: 720, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, []);
  return (
    <Animated.View style={[cs.dot, {
      opacity: v,
      transform: [{ scale: v.interpolate({ inputRange: [0.25, 1], outputRange: [0.8, 1] }) }],
    }]} />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo:      { width: 260, height: 260, marginBottom: 12 },
  brand:     { color: "#0F172A", fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  slogan:    { color: "#475569", fontSize: 22, fontWeight: "700", textAlign: "center", lineHeight: 30, marginTop: 10 },
});

const cs = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logoGroup:  { alignItems: "center", gap: 18 },
  iconShadow: { shadowColor: "#263238", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  iconClip:   { width: 88, height: 88, borderRadius: 20, overflow: "hidden" },
  brand:      { fontSize: 36, fontWeight: "700", color: "#263238" },
  tagline:    { fontSize: 15, color: "#8a8f99", marginTop: 10 },
  dots:       { flexDirection: "row", gap: 8, marginTop: 56 },
  dot:        { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#263238" },
});
