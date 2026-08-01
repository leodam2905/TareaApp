import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePushNotifications } from "@/lib/usePushNotifications";

const ACTIVE   = "#2563EB";
const INACTIVE = "#334155";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, label, focused }: { name: IconName; label: string; focused: boolean }) {
  const color = focused ? ACTIVE : INACTIVE;
  return (
    <View style={{ alignItems: "center", gap: 4, width: 76, paddingTop: 6 }}>
      <Ionicons name={name} size={26} color={color} />
      <Text style={{ fontSize: 12, color, fontWeight: focused ? "700" : "500" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function HandymanTabs() {
  usePushNotifications();
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: "#FFFFFF",
        borderTopWidth: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: 68 + insets.bottom,
        paddingTop: 8,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        shadowColor: "#0F172A",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 12,
      },
    }}>
      <Tabs.Screen name="dashboard" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home-outline"      label="Home"      focused={focused} /> }} />
      <Tabs.Screen name="find-jobs" options={{ tabBarIcon: ({ focused }) => <TabIcon name="search-outline"    label="Find Jobs" focused={focused} /> }} />
      <Tabs.Screen name="jobs"      options={{ tabBarIcon: ({ focused }) => <TabIcon name="clipboard-outline" label="My Jobs"   focused={focused} /> }} />
      <Tabs.Screen name="earnings"  options={{ tabBarIcon: ({ focused }) => <TabIcon name="wallet-outline"    label="Earnings"  focused={focused} /> }} />
      {/* Alerts live in the top header (bell), not the bottom bar */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile"       options={{ href: null }} />
    </Tabs>
  );
}
