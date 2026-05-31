import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getToken, getRole } from "@/lib/storage";
import { C } from "@/constants/colors";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const role  = await getRole();
        if (!token) {
          router.replace("/(auth)/landing" as any);
        } else if (role === "HANDYMAN") {
          router.replace("/(handyman)/tabs/dashboard" as any);
        } else {
          router.replace("/(customer)/tabs/dashboard" as any);
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
