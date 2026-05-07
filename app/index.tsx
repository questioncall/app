import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function LandingScreen() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading = useAppSelector((s) => s.auth.isLoading);
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)/feed");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || isAuthenticated) return null;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingBottom: Math.max(insets.bottom + 28, 44),
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 24, 56),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card shadow-sm">
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: 42, height: 42 }}
              resizeMode="contain"
            />
          </View>
          <Text className="text-center text-[34px] font-bold tracking-tight text-foreground">
            QuestionCall
          </Text>
          <Text className="mt-4 max-w-sm text-center text-[24px] font-bold leading-8 tracking-tight text-foreground">
            Ask your question. Get a teacher working on them fast.
          </Text>
          <Text className="mt-4 max-w-sm text-center text-[15px] leading-6 text-muted-foreground">
            Students post academic questions, teachers accept them live, and a private answer screen opens right away.
          </Text>
          <Text className="mt-3 max-w-sm text-center text-[15px] leading-6 text-muted-foreground">
            Get help within minutes using chat, audio or video calls, and file sharing while the answer is being solved.
          </Text>
        </View>

        <View className="gap-3 pt-8">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-4 shadow-lg"
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(auth)/register",
                params: { role: "STUDENT" },
              })
            }
          >
            <Ionicons name="school-outline" size={18} color="#FFFFFF" />
            <Text className="text-[16px] font-semibold text-primary-foreground">
              I&apos;m a Student
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(auth)/register",
                params: { role: "TEACHER" },
              })
            }
          >
            <Ionicons name="person-outline" size={18} color={iconColor} />
            <Text className="text-[16px] font-semibold text-card-foreground">
              I&apos;m a Teacher
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center py-2"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-[15px] font-semibold text-foreground">
              Sign in
            </Text>
          </TouchableOpacity>

          <Text className="px-2 pt-2 text-center text-[12px] leading-5 text-muted-foreground">
            By continuing, you agree to our{" "}
            <Text
              className="font-bold text-foreground underline"
              onPress={() => router.push("/legal")}
            >
              Terms of Use
            </Text>{" "}
            and{" "}
            <Text
              className="font-bold text-foreground underline"
              onPress={() => router.push("/legal")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
