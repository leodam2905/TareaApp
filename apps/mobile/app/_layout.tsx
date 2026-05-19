import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";

export default function RootLayout() {
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
            <Stack.Screen name="notifications" />
            <Stack.Screen name="customer/bookings/[id]/review" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StripeProvider>
  );
}
