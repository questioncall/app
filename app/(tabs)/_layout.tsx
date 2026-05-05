import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useAppSelector } from "@/hooks/redux";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

function CenterTabButton({ children, onPress }: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        top: -16,
        alignItems: "center",
        justifyContent: "center",
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#3B82F6",
        shadowColor: "#3B82F6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View className="items-center gap-0.5">
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          color: focused ? "#3B82F6" : "#6B7280",
          fontWeight: focused ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const userRole = useAppSelector((s) => s.user.data?.role);
  const isTeacher = userRole === "TEACHER";
  const centerLabel = isTeacher ? "Actions" : "Ask";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#0F172A",
          borderTopColor: "#1E293B",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 80 : 65,
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" label="Feed" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📢" label="Channels" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          tabBarButton: (props) => <CenterTabButton {...props} />,
          tabBarIcon: () => (
            <View className="items-center">
              <Text style={{ fontSize: 28, color: "#FFFFFF" }}>+</Text>
            </View>
          ),
          tabBarLabel: centerLabel,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📚" label="Courses" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="☰" label="Menu" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
