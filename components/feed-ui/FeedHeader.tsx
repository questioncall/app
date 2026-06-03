import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AuthNotice } from "@/components/auth/auth-notice";
import type { Course } from "@/store/slices/coursesSlice";

import { COURSE_GRADIENTS, useFeedColors } from "./tokens";

type FeedView =
  | "all"
  | "waiting"
  | "solved"
  | "media"
  | "discussion"
  | "physics"
  | "maths";

export const FEED_FILTER_CHIPS: { value: FeedView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Unanswered" },
  { value: "solved", label: "Solved" },
  { value: "physics", label: "Physics" },
  { value: "maths", label: "Maths" },
];

function AppLogo() {
  const FEED_COLORS = useFeedColors();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 42, height: 30 }}
        resizeMode="contain"
      />
      <Text
        style={{
          color: FEED_COLORS.text,
          fontSize: 19,
          fontWeight: "800",
          letterSpacing: -0.4,
        }}
      >
        Question<Text style={{ color: "#13934E" }}>Call</Text>
      </Text>
    </View>
  );
}

function formatCoursePrice(course: Course) {
  if (course.pricingModel === "FREE") return "Free";
  if (course.pricingModel === "SUBSCRIPTION_INCLUDED") return "Sub";
  return "Premium";
}

function CourseTile({ course, index }: { course: Course; index: number }) {
  const FEED_COLORS = useFeedColors();
  const colors = COURSE_GRADIENTS[index % COURSE_GRADIENTS.length];
  const glyph = course.subject?.toLowerCase().includes("biology")
    ? "DNA"
    : course.subject?.toLowerCase().includes("computer")
      ? "</>"
      : course.subject?.toLowerCase().includes("math")
        ? "∫"
        : "Q";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/course/${course._id}` as any)}
      activeOpacity={0.86}
      style={{ width: 142, marginRight: 11 }}
    >
      {course.thumbnailUrl ? (
        <Image
          source={{ uri: course.thumbnailUrl }}
          style={{ height: 82, width: "100%", borderRadius: 13 }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 82,
            borderRadius: 13,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: glyph === "∫" ? 36 : 22,
              fontWeight: "900",
            }}
          >
            {glyph}
          </Text>
          <View
            style={{
              position: "absolute",
              top: 7,
              left: 7,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.22)",
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.92)",
                fontSize: 8.5,
                fontWeight: "800",
                letterSpacing: 0.7,
                textTransform: "uppercase",
              }}
            >
              {course.level || "FOUNDATIONS"}
            </Text>
          </View>
          {course.pricingModel === "PAID" ? (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                borderRadius: 20,
                backgroundColor: "#FFD43B",
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: FEED_COLORS.text, fontSize: 8.5, fontWeight: "800" }}>
                PREMIUM
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      )}
      <Text
        numberOfLines={2}
        style={{
          marginTop: 7,
          color: FEED_COLORS.text,
          fontSize: 12.5,
          fontWeight: "700",
          lineHeight: 15.5,
        }}
      >
        {course.title}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 2,
          color: FEED_COLORS.softMuted,
          fontSize: 11,
          fontWeight: "500",
        }}
      >
        {formatCoursePrice(course).replace("Premium", "")}
        {formatCoursePrice(course) === "Premium" ? "" : " · "}
        {course.subject || "Course"}
      </Text>
    </TouchableOpacity>
  );
}

export function FeedHeader({
  activeFilterCount,
  activeView,
  courses,
  coursesLoading,
  error,
  onFilterPress,
  onSearchChange,
  onViewChange,
  questionCount,
  searchValue,
  showCourses,
  unreadCount,
}: {
  activeFilterCount: number;
  activeView: FeedView;
  courses: Course[];
  coursesLoading: boolean;
  error: string | null;
  onFilterPress: () => void;
  onSearchChange: (value: string) => void;
  onViewChange: (value: FeedView) => void;
  questionCount: number;
  searchValue: string;
  showCourses: boolean;
  unreadCount: number;
}) {
  const FEED_COLORS = useFeedColors();

  return (
    <View style={{ backgroundColor: FEED_COLORS.page }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 7 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <AppLogo />
          <TouchableOpacity
            onPress={() => router.push("/notifications" as any)}
            activeOpacity={0.75}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: FEED_COLORS.subtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="notifications-outline" size={21} color={FEED_COLORS.text} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 2,
                  right: 1,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: FEED_COLORS.red,
                  borderWidth: 2,
                  borderColor: FEED_COLORS.page,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "800" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={{ marginTop: 12 }}>
            <AuthNotice tone="error" message={error} />
          </View>
        ) : null}

        <View
          style={{ marginTop: 9, flexDirection: "row", alignItems: "center", gap: 9 }}
        >
          <View
            style={{
              flex: 1,
              height: 42,
              borderRadius: 13,
              backgroundColor: FEED_COLORS.subtle,
              borderWidth: 1.5,
              borderColor: searchValue ? "#CFE9DA" : "transparent",
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              paddingHorizontal: 14,
            }}
          >
            <Ionicons name="search-outline" size={19} color="#9AA3AA" />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder="Search questions & courses..."
              placeholderTextColor="#9AA3AA"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                color: FEED_COLORS.text,
                fontSize: 14.5,
                fontWeight: "500",
                paddingVertical: 0,
              }}
            />
            {searchValue ? (
              <TouchableOpacity
                onPress={() => onSearchChange("")}
                activeOpacity={0.75}
                style={{
                  width: 19,
                  height: 19,
                  borderRadius: 9.5,
                  backgroundColor: "#D7DCE1",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13, lineHeight: 16 }}>x</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onFilterPress}
            activeOpacity={0.82}
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: FEED_COLORS.darkButton,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="options-outline" size={18} color="#fff" />
            {activeFilterCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  height: 16,
                  minWidth: 16,
                  borderRadius: 8,
                  backgroundColor: FEED_COLORS.green,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 9, paddingBottom: 0 }}
        >
          {FEED_FILTER_CHIPS.map((chip) => {
            const active = activeView === chip.value;
            return (
              <Pressable
                key={chip.value}
                onPress={() => onViewChange(chip.value)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? FEED_COLORS.darkButton : FEED_COLORS.chipBorder,
                  backgroundColor: active ? FEED_COLORS.darkButton : FEED_COLORS.page,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : FEED_COLORS.muted,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {showCourses ? (
        <View style={{ paddingTop: 8 }}>
          <View
            style={{
              paddingHorizontal: 18,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: FEED_COLORS.text, fontSize: 16, fontWeight: "800" }}>
              Continue learning
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/courses" as any)}>
              <Text style={{ color: FEED_COLORS.green, fontSize: 13, fontWeight: "700" }}>
                See all
              </Text>
            </TouchableOpacity>
          </View>
          {coursesLoading && courses.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator color={FEED_COLORS.green} />
            </View>
          ) : courses.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 1 }}
            >
              {courses.map((course, index) => (
                <CourseTile key={course._id} course={course} index={index} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          borderTopWidth: 8,
          borderTopColor: FEED_COLORS.subtle,
          marginTop: showCourses ? 9 : 0,
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: FEED_COLORS.faintMuted,
            fontSize: 12.5,
            fontWeight: "800",
            letterSpacing: 1.1,
          }}
        >
          QUESTIONS
        </Text>
        <Text
          style={{ color: FEED_COLORS.faintMuted, fontSize: 12.5, fontWeight: "700" }}
        >
          {questionCount} {questionCount === 1 ? "result" : "results"}
        </Text>
      </View>
    </View>
  );
}
