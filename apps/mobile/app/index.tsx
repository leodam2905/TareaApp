import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withDelay, withRepeat, withSequence, withTiming, FadeInDown,
} from "react-native-reanimated";
import { colors, fontSize, radius, spacing } from "../constants/theme";

const { width, height } = Dimensions.get("window");

// Animated floating orb
function FloatingOrb({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-12, { duration: 2000 }),
      withTiming(12, { duration: 2000 }),
    ), -1, true));
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.6, { duration: 1800 }),
      withTiming(0.2, { duration: 1800 }),
    ), -1, true));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />
  );
}

// Animated wrench icon
function AnimatedWrench() {
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotate.value = withRepeat(withSequence(
      withTiming(-20, { duration: 400 }),
      withTiming(20, { duration: 400 }),
      withTiming(0, { duration: 200 }),
    ), -1, false);
    scale.value = withRepeat(withSequence(
      withTiming(1.15, { duration: 800 }),
      withTiming(1, { duration: 800 }),
    ), -1, true);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.iconWrap, style]}>
      <Ionicons name="construct" size={44} color={colors.skyBlue} />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Auto-navigate if already logged in
    SecureStore.getItemAsync("tarea_token").then((token) => {
      SecureStore.getItemAsync("tarea_role").then((role) => {
        if (token && role) {
          router.replace(role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
        }
      });
    });
  }, []);

  return (
    <LinearGradient colors={["#0F2560", "#1E3A8A", "#0F172A"]} style={styles.container} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}>
      {/* Background orbs */}
      <FloatingOrb x={-60} y={height * 0.1} size={200} color={colors.skyBlue} delay={0} />
      <FloatingOrb x={width - 80} y={height * 0.4} size={160} color={colors.darkBlue} delay={500} />
      <FloatingOrb x={width * 0.3} y={height * 0.7} size={120} color={colors.skyDark} delay={1000} />

      {/* Grid lines */}
      <View style={styles.gridOverlay} />

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <AnimatedWrench />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.brand}>
          Tarea
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.tagline}>
          Your trusted handyman platform
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.subtitle}>
          Book skilled professionals for any home repair — fast, reliable, and affordable.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.btnOutlineText}>I already have an account</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800)} style={styles.trust}>
          <View style={styles.avatars}>
            {["A", "B", "C"].map((l) => (
              <View key={l} style={styles.avatar}>
                <Text style={styles.avatarText}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.trustText}>10K+ happy customers</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gridOverlay: {
    position: "absolute", inset: 0,
    opacity: 0.04,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: "rgba(56,189,248,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(56,189,248,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 52,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.skyBlue,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: spacing.xxl,
  },
  buttons: { width: "100%", gap: spacing.md },
  btnPrimary: {
    backgroundColor: colors.skyBlue,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.skyBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  btnPrimaryText: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.ink,
  },
  btnOutline: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 16,
    alignItems: "center",
  },
  btnOutlineText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  trust: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  avatars: { flexDirection: "row" },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.darkBlue,
    borderWidth: 2, borderColor: colors.skyBlue,
    alignItems: "center", justifyContent: "center",
    marginLeft: -8,
  },
  avatarText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  trustText: { color: "rgba(255,255,255,0.45)", fontSize: fontSize.sm },
});
