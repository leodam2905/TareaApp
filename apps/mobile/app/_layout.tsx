
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "@/constants/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken() {
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === "granted"
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await api.post("/push-token", { token }).catch(() => {});
}

function useNotificationDeepLink() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Handle taps on notifications received while app is closed or backgrounded
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { type?: string; refId?: string } | undefined;
      if (!data) return;

      switch (data.type) {
        case "booking_request":
        case "booking_accepted":
        case "booking_cancelled":
        case "booking_completed":
        case "booking_reminder":
          if (data.refId) router.push(`/booking/${data.refId}` as never);
          break;
        case "message":
          if (data.refId) router.push(`/chat/${data.refId}` as never);
          break;
        default:
          break;
      }
    });

    return () => {
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [router]);
}

export default function RootLayout() {
  useNotificationDeepLink();

  useEffect(() => {
    registerPushToken();
  }, []);

  const stripeKey = process.env["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "";

  return (
    <StripeProvider publishableKey={stripeKey}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(handyman)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="booking" />
            <Stack.Screen name="service/[id]" />
            <Stack.Screen name="post-job/index" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StripeProvider>
  );
}
