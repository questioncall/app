import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function CenterTabButton({
  children,
  onPress,
  backgroundColor,
  borderColor,
}: BottomTabBarButtonProps & {
  backgroundColor: string;
  borderColor: string;
}) {
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
        borderWidth: 1,
        borderColor,
        backgroundColor,
        shadowColor: backgroundColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

function TabIcon({
  name,
  label,
  focused,
  activeColor,
  inactiveColor,
  badge,
}: {
  name: IoniconName;
  label: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
  badge?: number;
}) {
  const color = focused ? activeColor : inactiveColor;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 64,
        gap: 2,
      }}
    >
      <View>
        <Ionicons name={name} size={21} color={color} />
        {badge && badge > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#EF4444",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 3,
            }}
          >
            <Text
              style={{ fontSize: 9, fontWeight: "700", color: "#FFF", lineHeight: 11 }}
            >
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: 10,
          lineHeight: 12,
          color,
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
  const totalUnread = useAppSelector((s) =>
    s.channels.list.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0),
  );
  const insets = useSafeAreaInsets();
  const { cardColor, borderColor, primaryColor, mutedIconColor, isDark } = useAppTheme();
  const isTeacher = userRole === "TEACHER";
  const centerLabel = isTeacher ? "Actions" : "Ask";
  const bottomPadding = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 10);
  const inactiveColor = isDark ? "#A8A29E" : mutedIconColor;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: cardColor,
          borderTopColor: borderColor,
          borderTopWidth: 1,
          height: 56 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "list" : "list-outline"}
              label="Feed"
              focused={focused}
              activeColor={primaryColor}
              inactiveColor={inactiveColor}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              label="Channels"
              focused={focused}
              activeColor={primaryColor}
              inactiveColor={inactiveColor}
              badge={totalUnread}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          tabBarButton: (props) => (
            <CenterTabButton
              {...props}
              backgroundColor={primaryColor}
              borderColor={borderColor}
            />
          ),
          tabBarIcon: () => (
            <View className="items-center justify-center">
              <Ionicons name="add" size={27} color="#FFFFFF" />
              <Text className="text-[9px] font-semibold text-white">{centerLabel}</Text>
            </View>
          ),
          tabBarLabel: centerLabel,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "book" : "book-outline"}
              label="Courses"
              focused={focused}
              activeColor={primaryColor}
              inactiveColor={inactiveColor}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "menu" : "menu-outline"}
              label="Menu"
              focused={focused}
              activeColor={primaryColor}
              inactiveColor={inactiveColor}
            />
          ),
        }}
      />
    </Tabs>
  );
}
