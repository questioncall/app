import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { AuthNotice } from "@/components/auth/auth-notice";
import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { publicApi } from "@/lib/api";
import type { Course } from "@/store/slices/coursesSlice";

type CourseVideo = {
  _id: string;
  title: string;
  durationMinutes?: number | null;
  thumbnailUrl?: string | null;
  order?: number;
};

type CourseSection = {
  _id: string;
  title: string;
  description?: string | null;
  order?: number;
  durationMinutes?: number | null;
  videos: CourseVideo[];
};

type CourseDetail = Course & {
  sections: CourseSection[];
  overallProgressPercent?: number;
  totalDurationMinutes?: number | null;
  enrollmentCount?: number;
  instructorRole?: string;
  tags?: string[];
};

const COURSE_FALLBACK_COLORS = ["#0A8A4B", "#0F766E", "#C2410C", "#BE123C"];

function formatCurrency(course: CourseDetail) {
  if (course.pricingModel === "FREE") {
    return "Free";
  }

  if (course.pricingModel === "SUBSCRIPTION_INCLUDED") {
    return "Subscription";
  }

  if (typeof course.price === "number" && Number.isFinite(course.price)) {
    return `NPR ${course.price.toLocaleString()}`;
  }

  return "Paid";
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) {
    return "Flexible";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const courseId = Array.isArray(id) ? id[0] : id;
  const cachedCourse = useAppSelector((state) =>
    state.courses.list.find((course) => course._id === courseId),
  );
  const userRole = useAppSelector((state) => state.user.data?.role);
  const { statusBarStyle, backgroundColor, iconColor, mutedIconColor, primaryColor } =
    useAppTheme();

  const [course, setCourse] = useState<CourseDetail | null>(
    cachedCourse ? { ...cachedCourse, sections: [] } : null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = useCallback(
    async (force = false) => {
      if (!courseId) {
        setError("Course id is missing.");
        setIsLoading(false);
        return;
      }

      if (!force) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        const res = await publicApi.get(`/courses/${courseId}`);
        setCourse(res.data as CourseDetail);
      } catch (err: any) {
        setError(
          err?.response?.data?.error ??
            err?.response?.data?.message ??
            "Unable to load this course right now.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const totalSections = course?.sections?.length ?? 0;
  const totalVideos = useMemo(
    () =>
      course?.sections?.reduce((count, section) => count + section.videos.length, 0) ?? 0,
    [course],
  );

  if (isLoading && !course) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator color={primaryColor} size="large" />
      </View>
    );
  }

  if (!course && error) {
    return (
      <View className="flex-1 bg-background px-4 pt-14">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <AuthNotice tone="error" message={error} />
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 self-start rounded-full border border-border bg-card px-4 py-2"
        >
          <Text className="text-sm font-medium text-foreground">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeCourse = course;

  if (!activeCourse) {
    return null;
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadCourse(true)}
            tintColor={primaryColor}
          />
        }
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-14">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <Ionicons name="arrow-back-outline" size={18} color={iconColor} />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <View className="rounded-full border border-border bg-card px-3 py-2">
                <Text className="text-xs font-medium text-muted-foreground">
                  {totalSections} sections
                </Text>
              </View>
              <View className="rounded-full border border-border bg-card px-3 py-2">
                <Text className="text-xs font-medium text-muted-foreground">
                  {totalVideos} videos
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 overflow-hidden rounded-[24px] border border-border bg-card">
            {activeCourse.thumbnailUrl ? (
              <ImageBackground
                source={{ uri: activeCourse.thumbnailUrl }}
                resizeMode="cover"
                style={{ minHeight: 220 }}
              >
                <View className="absolute inset-0 bg-black/35" />
                <View className="absolute inset-0 justify-between p-5">
                  <View className="flex-row flex-wrap gap-2">
                    <View className="rounded-full bg-black/30 px-3 py-1.5">
                      <Text className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        {activeCourse.subject || "Course"}
                      </Text>
                    </View>
                    <View className="rounded-full bg-white/15 px-3 py-1.5">
                      <Text className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        {activeCourse.level || "All levels"}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className="text-[26px] font-bold leading-8 text-white">
                      {activeCourse.title}
                    </Text>
                    <Text className="mt-2 text-sm leading-6 text-white/85">
                      {activeCourse.description || "Course details and lessons"}
                    </Text>
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <View
                className="justify-between p-5"
                style={{
                  minHeight: 220,
                  backgroundColor:
                    COURSE_FALLBACK_COLORS[
                      Math.abs(Number(courseId?.length || 0)) %
                        COURSE_FALLBACK_COLORS.length
                    ],
                }}
              >
                <View className="flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-black/20 px-3 py-1.5">
                    <Text className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                      {activeCourse.subject || "Course"}
                    </Text>
                  </View>
                  <View className="rounded-full bg-white/15 px-3 py-1.5">
                    <Text className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                      {activeCourse.level || "All levels"}
                    </Text>
                  </View>
                </View>

                <View>
                  <Text className="text-[26px] font-bold leading-8 text-white">
                    {activeCourse.title}
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-white/85">
                    {activeCourse.description || "Course details and lessons"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="mt-4 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row flex-wrap gap-2">
              <View className="rounded-full bg-emerald-500/10 px-3 py-1.5">
                <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(activeCourse)}
                </Text>
              </View>
              <View className="rounded-full bg-sky-500/10 px-3 py-1.5">
                <Text className="text-xs font-medium text-sky-700 dark:text-sky-300">
                  {formatDuration(activeCourse.totalDurationMinutes)}
                </Text>
              </View>
              <View className="rounded-full bg-amber-500/10 px-3 py-1.5">
                <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {activeCourse.enrollmentCount ?? 0} learners
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Instructor
                </Text>
                <Text className="mt-1 text-sm font-semibold text-foreground">
                  {activeCourse.instructorName || "QuestionCall"}
                </Text>
              </View>
              {typeof activeCourse.overallProgressPercent === "number" ? (
                <View className="items-end">
                  <Text className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Progress
                  </Text>
                  <Text className="mt-1 text-sm font-semibold text-foreground">
                    {Math.round(activeCourse.overallProgressPercent)}%
                  </Text>
                </View>
              ) : null}
            </View>

            {typeof activeCourse.overallProgressPercent === "number" ? (
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, activeCourse.overallProgressPercent))}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </View>
            ) : null}
          </View>

          {error ? <AuthNotice tone="error" message={error} /> : null}

          <View className="mt-4">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sections
            </Text>

            {activeCourse.sections.length > 0 ? (
              activeCourse.sections.map((section) => (
                <View
                  key={section._id}
                  className="mb-3 overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <View className="border-b border-border px-4 py-4">
                    <Text className="text-base font-semibold text-foreground">
                      {section.title}
                    </Text>
                    {section.description ? (
                      <Text className="mt-1 text-sm leading-6 text-muted-foreground">
                        {section.description}
                      </Text>
                    ) : null}
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <View className="rounded-full border border-border bg-background px-2.5 py-1">
                        <Text className="text-[10px] font-medium text-muted-foreground">
                          {section.videos.length} videos
                        </Text>
                      </View>
                      <View className="rounded-full border border-border bg-background px-2.5 py-1">
                        <Text className="text-[10px] font-medium text-muted-foreground">
                          {formatDuration(section.durationMinutes)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="divide-y divide-border">
                    {section.videos.length > 0 ? (
                      section.videos.map((video) => (
                        <View
                          key={video._id}
                          className="flex-row items-center gap-3 px-4 py-3"
                        >
                          <View className="bg-muted/20 h-14 w-20 overflow-hidden rounded-xl border border-border">
                            {video.thumbnailUrl ? (
                              <Image
                                source={{ uri: video.thumbnailUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="flex-1 items-center justify-center">
                                <Ionicons
                                  name="play-circle-outline"
                                  size={24}
                                  color={mutedIconColor}
                                />
                              </View>
                            )}
                          </View>

                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-sm font-medium text-foreground"
                              numberOfLines={2}
                            >
                              {video.title}
                            </Text>
                            <Text className="mt-1 text-xs text-muted-foreground">
                              {formatDuration(video.durationMinutes)}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View className="px-4 py-4">
                        <Text className="text-sm text-muted-foreground">
                          No videos in this section yet.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View className="rounded-2xl border border-dashed border-border bg-card p-5">
                <Text className="text-sm font-medium text-foreground">
                  No sections yet
                </Text>
                <Text className="mt-2 text-sm leading-6 text-muted-foreground">
                  This course is published, but the section breakdown has not been added
                  yet.
                </Text>
              </View>
            )}
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="rounded-full border border-border bg-card px-4 py-3"
            >
              <Text className="text-sm font-medium text-foreground">Back</Text>
            </TouchableOpacity>

            {userRole === "STUDENT" ? (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/courses" as any)}
                className="rounded-full bg-primary px-4 py-3"
              >
                <Text className="text-sm font-semibold text-white">Browse courses</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
