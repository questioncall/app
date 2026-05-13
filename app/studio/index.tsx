import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type CourseStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
type PricingModel = "FREE" | "SUBSCRIPTION_INCLUDED" | "PAID";

export type Course = {
  _id: string;
  title: string;
  subject: string;
  level: string;
  status: CourseStatus;
  pricingModel: PricingModel;
  price: number | null;
  enrollmentCount: number;
  totalDurationMinutes: number;
  thumbnailUrl: string | null;
  instructorId: string;
  slug: string;
  description: string;
  startDate?: string | null;
  expectedEndDate?: string | null;
};

function StatusPill({ status }: { status: CourseStatus }) {
  const colors: Record<CourseStatus, { bg: string; text: string }> = {
    DRAFT: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
    ACTIVE: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
    COMPLETED: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    ARCHIVED: { bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
  };
  const c = colors[status] ?? colors.DRAFT;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.text }}>{status}</Text>
    </View>
  );
}

function PricingBadge({ model, price }: { model: PricingModel; price: number | null }) {
  const label =
    model === "FREE"
      ? "Free"
      : model === "SUBSCRIPTION_INCLUDED"
        ? "Subscription"
        : `NPR ${price ?? "—"}`;
  const color =
    model === "FREE"
      ? "#10b981"
      : model === "SUBSCRIPTION_INCLUDED"
        ? "#8b5cf6"
        : "#f59e0b";
  return (
    <View
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

export default function StudioScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/courses", {
        params: { limit: 50, page: 1, instructor: "me" },
      });
      const all: Course[] = res.data?.courses ?? [];
      setCourses(all);
    } catch {
      Toast.show({ type: "error", text1: "Failed to load courses" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchCourses(true);
  };

  // Stats
  const totalStudents = courses.reduce((s, c) => s + (c.enrollmentCount ?? 0), 0);
  const activeCourses = courses.filter((c) => c.status === "ACTIVE").length;

  const renderCourse = ({ item }: { item: Course }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/studio/[courseId]" as any,
          params: { courseId: item._id },
        })
      }
      style={{
        backgroundColor: cardColor,
        borderRadius: 16,
        borderWidth: 1,
        borderColor,
        marginBottom: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: "700",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <StatusPill status={item.status} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <PricingBadge model={item.pricingModel} price={item.price} />
        <Text style={{ fontSize: 12, color: mutedIconColor }}>{item.subject}</Text>
        {item.level ? (
          <>
            <Text style={{ fontSize: 12, color: mutedIconColor }}>·</Text>
            <Text style={{ fontSize: 12, color: mutedIconColor }}>{item.level}</Text>
          </>
        ) : null}
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="people-outline" size={14} color={mutedIconColor} />
          <Text style={{ fontSize: 12, color: mutedIconColor }}>
            {item.enrollmentCount} enrolled
          </Text>
        </View>
        {item.totalDurationMinutes > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="time-outline" size={14} color={mutedIconColor} />
            <Text style={{ fontSize: 12, color: mutedIconColor }}>
              {item.totalDurationMinutes} min
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Ionicons name="chevron-forward" size={16} color={mutedIconColor} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: 24,
            fontWeight: "700",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Course Studio
        </Text>
        <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 8 }}>
          <Ionicons name="refresh-outline" size={22} color={mutedIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/studio/create" as any)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: primaryColor,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      {courses.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 16,
            marginBottom: 8,
          }}
        >
          {[
            { label: "Total", value: courses.length, icon: "book-outline" as const },
            {
              label: "Active",
              value: activeCourses,
              icon: "checkmark-circle-outline" as const,
            },
            { label: "Students", value: totalStudents, icon: "people-outline" as const },
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                backgroundColor: primarySoftColor,
                borderRadius: 12,
                padding: 10,
                alignItems: "center",
              }}
            >
              <Ionicons name={stat.icon} size={16} color={primaryColor} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: primaryColor,
                  marginTop: 2,
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ fontSize: 11, color: mutedIconColor }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item._id}
          renderItem={renderCourse}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: primarySoftColor,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons name="videocam-outline" size={36} color={primaryColor} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: isDark ? "#f1f5f9" : "#0f172a",
                  marginBottom: 8,
                }}
              >
                No courses yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: mutedIconColor,
                  textAlign: "center",
                  marginBottom: 24,
                  paddingHorizontal: 32,
                }}
              >
                Create your first course to start sharing your knowledge with students.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/studio/create" as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: primaryColor,
                  borderRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  Create Course
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}
