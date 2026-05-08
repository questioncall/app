import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { publicApi } from "@/lib/api";
import { store } from "@/store";
import {
  selectIsCoursesStale,
  setCourses,
  setCoursesError,
  setCoursesLoading,
  setCoursesRefreshing,
} from "@/store/slices/coursesSlice";
import type { Course } from "@/store/slices/coursesSlice";

function getCourseKey(item: Course, index: number) {
  return `${item._id || item.slug || item.title || "course"}-${index}`;
}

export default function CoursesScreen() {
  const dispatch = useAppDispatch();
  const { list, isLoading, isRefreshing } = useAppSelector((s) => s.courses);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();

  const loadCourses = useCallback(
    async (force = false) => {
      const currentCoursesState = store.getState().courses;
      const shouldUseCache = !selectIsCoursesStale(currentCoursesState.lastFetchedAt);

      if (!force && (currentCoursesState.isLoading || shouldUseCache)) {
        return;
      }

      dispatch(setCoursesLoading(true));
      try {
        const res = await publicApi.get("/courses");
        const courses = Array.isArray(res.data?.courses)
          ? res.data.courses
          : Array.isArray(res.data)
            ? res.data
            : [];
        dispatch(setCourses(courses));
      } catch {
        dispatch(setCoursesError("Unable to load courses right now."));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const pricingLabel = (model: Course["pricingModel"], price?: number | null) => {
    if (model === "FREE") {
      return {
        text: "Free",
        color: "text-emerald-600 dark:text-emerald-300",
      };
    }

    if (model === "SUBSCRIPTION_INCLUDED")
      return { text: "Subscription", color: "text-sky-600 dark:text-sky-300" };

    return {
      text: `NPR ${price?.toLocaleString() ?? "—"}`,
      color: "text-amber-600 dark:text-amber-300",
    };
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="px-6 pb-4 pt-14">
        <Text className="text-[28px] font-bold tracking-tight text-foreground">
          Courses
        </Text>
        <Text className="mt-1 text-sm leading-6 text-muted-foreground">
          Learn from expert teachers
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={iconColor} size="large" />
        </View>
      ) : list.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
            <Ionicons name="book-outline" size={32} color={iconColor} />
          </View>
          <Text className="mb-2 text-center text-[18px] font-semibold text-foreground">
            No courses yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={getCourseKey}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                dispatch(setCoursesRefreshing(true));
                void loadCourses(true);
              }}
              tintColor={iconColor}
            />
          }
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
          renderItem={({ item }) => {
            const label = pricingLabel(item.pricingModel, item.price);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/course/${item._id}` as any)}
                className="flex-1 overflow-hidden rounded-2xl border border-border bg-card"
                activeOpacity={0.8}
              >
                <View
                  className="h-32 items-center justify-center border-b border-border"
                  style={{ backgroundColor: primarySoftColor }}
                >
                  <Ionicons name="book-outline" size={34} color={primaryColor} />
                </View>
                <View className="p-3">
                  <Text
                    className="mb-1 text-sm font-semibold text-card-foreground"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.instructorName ? (
                    <Text
                      className="mb-2 text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      by {item.instructorName}
                    </Text>
                  ) : null}
                  <Text className={`text-xs font-semibold ${label.color}`}>
                    {label.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
