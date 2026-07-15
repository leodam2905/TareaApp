import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { getToken, getRole } from "@/lib/storage";

const APP_VARIANT = (Constants.expoConfig?.extra?.appVariant ?? "customer") as "customer" | "handyman";
const IS_HANDYMAN = APP_VARIANT === "handyman";

// The native splash (assets/splash-pro.png / splash-home.png — the house + slogan)
// is the ONLY splash. Keep it up until we've decided where to route.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Keep the splash readable for a brief beat.
      const minDelay = new Promise((r) => setTimeout(r, 1600));
      const decide = (async (): Promise<string> => {
        try {
          const token = await getToken();
          if (!token) return "/(auth)/landing";
          // One account works in both apps. The app you opened decides the mode:
          //  • Home → always the customer (hire) experience — anyone can book.
          //  • Pro  → the handyman (work) experience; a customer who opens Pro
          //    is offered the "Become a Pro" onboarding on the same account.
          if (!IS_HANDYMAN) return "/(customer)/tabs/dashboard";
          const role = await getRole();
          return role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(handyman)/become-pro";
        } catch {
          return "/(auth)/landing";
        }
      })();

      const [, dest] = await Promise.all([minDelay, decide]);
      router.replace(dest as any);
      // Hide the native splash once the destination screen is mounting.
      setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120);
    })();
  }, []);

  // Sits under the native splash; white matches it so there's no flash.
  return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
}
