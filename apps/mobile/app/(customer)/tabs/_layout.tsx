import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePushNotifications } from "@/lib/usePushNotifications";

const ACTIVE   = "#2563EB";
const INACTIVE = "#94A3B8";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, label, focused }: { name: IconName; label: string; focused: boolean }) {
  const color = focused ? ACTIVE : INACTIVE;
  return (
    <View style={{ alignItems: "center", gap: 4, width: 68, paddingTop: 6 }}>
      <Ionicons name={name} size={24} color={color} />
      <Text style={{ fontSize: 11, color, fontWeight: focused ? "700" : "500" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Center "Post a Job" floating + button — opens the (stack-level) post-job flow.
function PostButton() {
  const router = useRouter();
  return (
    <TouchableOpacity style={{ flex: 1, alignItems: "center" }} activeOpacity={0.85}
      onPress={() => router.push("/(customer)/post-job" as any)}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: ACTIVE, alignItems: "center", justifyContent: "center", marginTop: -18,
        shadowColor: ACTIVE, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
        <Ionicons name="add" size={30} color="#fff" />
      </View>
      <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: 11, color: ACTIVE, fontWeight: "700", marginTop: 2 }}>Post a Job</Text>
    </TouchableOpacity>
  );
}

export default function CustomerTabs() {
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
        height: 66 + insets.bottom,
        paddingTop: 8,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        shadowColor: "#0F172A",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 12,
      },
    }}>
      <Tabs.Screen name="dashboard" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home-outline"     label="Home"     focused={focused} /> }} />
      <Tabs.Screen name="bookings"  options={{ tabBarIcon: ({ focused }) => <TabIcon name="briefcase-outline" label="My Jobs" focused={focused} /> }} />
      {/* Center action — navigates to the stack post-job screen, never itself a page */}
      <Tabs.Screen name="post-cta" options={{ tabBarButton: () => <PostButton /> }}
        listeners={{ tabPress: e => e.preventDefault() }} />
      <Tabs.Screen name="messages" options={{ tabBarIcon: ({ focused }) => <TabIcon name="chatbubble-outline" label="Messages" focused={focused} /> }} />
      <Tabs.Screen name="profile"  options={{ tabBarIcon: ({ focused }) => <TabIcon name="person-outline"    label="Profile"  focused={focused} /> }} />
      {/* Hidden (not in bar) */}
      <Tabs.Screen name="requests"      options={{ href: null }} />
      <Tabs.Screen name="favorites"     options={{ href: null }} />
      <Tabs.Screen name="refer-earn"    options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="spending"      options={{ href: null }} />
    </Tabs>
  );
}
