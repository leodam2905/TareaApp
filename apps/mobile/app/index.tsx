import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { getToken, getRole, clearAuth } from "@/lib/storage";
import { C } from "@/constants/colors";

const APP_VARIANT = (Constants.expoConfig?.extra?.appVariant ?? "customer") as "customer" | "handyman";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const role  = await getRole();
        if (!token) {
          router.replace("/(auth)/landing" as any);
          return;
        }
        if (APP_VARIANT === "handyman" && role === "HANDYMAN") {
          router.replace("/(handyman)/tabs/dashboard" as any);
        } else if (APP_VARIANT === "customer" && role === "CUSTOMER") {
          router.replace("/(customer)/tabs/dashboard" as any);
        } else {
          // Wrong app for this role — clear auth and send to landing
          await clearAuth();
          router.replace("/(auth)/landing" as any);
        }
      } catch {
        router.replace("/(auth)/landing" as any);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.sky} size="large" />
    </View>
  );
}
