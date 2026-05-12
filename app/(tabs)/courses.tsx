import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Image,
  TextInput,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import api from "@/lib/api";
import { store } from "@/store";
import {
  selectIsCoursesStale,
  setCourses,
  setCoursesError,
  setCoursesLoading,
  setCoursesRefreshing,
} from "@/store/slices/coursesSlice";
import type { Course } from "@/store/slices/coursesSlice";

function getCourseKey(item: Course | null, index: number) {
  if (!item) return `filler-${index}`;
  return `${item._id || item.slug || item.title || "course"}-${index}`;
}

function pricingLabel(model: Course["pricingModel"], price?: number | null) {
  if (model === "FREE") return { text: "Free", color: "#10b981" };
  if (model === "SUBSCRIPTION_INCLUDED")
    return { text: "Subscription", color: "#0ea5e9" };
  return { text: `NPR ${price?.toLocaleString() ?? "—"}`, color: "#f59e0b" };
}

type ViewMode = "list" | "grid";

const ENROLLED_GREEN = "#10b981";

export default function CoursesScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { list, isLoading, isRefreshing } = useAppSelector((s) => s.courses);
  const isLoggedIn = !!useAppSelector((s) => s.auth.accessToken);
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const loadCourses = useCallback(
    async (force = false) => {
      const currentCoursesState = store.getState().courses;
      const shouldUseCache = !selectIsCoursesStale(currentCoursesState.lastFetchedAt);
      if (!force && (currentCoursesState.isLoading || shouldUseCache)) return;
      dispatch(setCoursesLoading(true));
      try {
        const res = await api.get("/courses");
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

  const enrolledCourses = useMemo(
    () => list.filter((c) => typeof c.overallProgressPercent === "number"),
    [list],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.instructorName ?? "").toLowerCase().includes(q) ||
        (c.subject ?? "").toLowerCase().includes(q),
    );
  }, [list, searchQuery]);

  const gridData = useMemo(() => {
    if (filtered.length % 2 !== 0) return [...filtered, null];
    return filtered;
  }, [filtered]);

  const textColor = isDark ? "#f1f5f9" : "#0f172a";
  const subtleCardBg = isDark ? "#1e293b" : "#ffffff";
  const subtleShadow = isDark
    ? {}
    : {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      };

  const isEnrolled = useCallback(
    (item: Course) => typeof item.overallProgressPercent === "number",
    [],
  );

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => {
        dispatch(setCoursesRefreshing(true));
        void loadCourses(true);
      }}
      tintColor={primaryColor}
    />
  );

  /* ── Enrolled Courses horizontal section (rendered as list header) ─── */
  const enrolledHeader = useMemo(() => {
    if (!isLoggedIn || enrolledCourses.length === 0 || searchQuery.trim().length > 0)
      return null;

    return (
      <View style={{ marginBottom: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="play-circle" size={18} color={ENROLLED_GREEN} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: textColor }}>
              My Courses
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: mutedIconColor }}>
            {enrolledCourses.length} enrolled
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {enrolledCourses.map((item) => {
            const progress = item.overallProgressPercent ?? 0;
            return (
              <Pressable
                key={item._id}
                onPress={() => router.push(`/course/${item._id}` as any)}
                android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
                style={({ pressed }) => ({
                  width: 200,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: subtleCardBg,
                  borderWidth: 1,
                  borderColor: `${ENROLLED_GREEN}40`,
                  opacity: pressed && Platform.OS === "ios" ? 0.85 : 1,
                  transform: [{ scale: pressed && Platform.OS === "ios" ? 0.97 : 1 }],
                  ...subtleShadow,
                })}
              >
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={{ width: 200, height: 90 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 200,
                      height: 90,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${ENROLLED_GREEN}12`,
                    }}
                  >
                    <Ionicons name="book-outline" size={28} color={ENROLLED_GREEN} />
                  </View>
                )}

                <View style={{ padding: 10 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: "600", color: textColor }}
                  >
                    {item.title}
                  </Text>
                  {item.instructorName ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 10, color: mutedIconColor, marginTop: 2 }}
                    >
                      {item.instructorName}
                    </Text>
                  ) : null}

                  {/* Progress bar */}
                  <View style={{ marginTop: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{ fontSize: 10, fontWeight: "600", color: ENROLLED_GREEN }}
                      >
                        {progress > 0
                          ? `${Math.round(progress)}% complete`
                          : "Not started"}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: isDark ? "#334155" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          width: `${Math.min(100, Math.max(0, progress))}%`,
                          backgroundColor: ENROLLED_GREEN,
                        }}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Separator */}
        <View
          style={{
            height: 1,
            backgroundColor: borderColor,
            marginTop: 14,
            marginHorizontal: 16,
          }}
        />
      </View>
    );
  }, [
    isLoggedIn,
    enrolledCourses,
    searchQuery,
    textColor,
    mutedIconColor,
    subtleCardBg,
    borderColor,
    isDark,
    subtleShadow,
  ]);

  /* ── Enrolled badge helper ─── */
  const enrolledBadge = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: `${ENROLLED_GREEN}15`,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Ionicons name="checkmark-circle" size={10} color={ENROLLED_GREEN} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: ENROLLED_GREEN }}>
        Enrolled
      </Text>
    </View>
  );

  /* ── List item ─── */
  const renderListItem = useCallback(
    ({ item }: { item: Course }) => {
      const label = pricingLabel(item.pricingModel, item.price);
      const enrolled = isEnrolled(item);
      return (
        <Pressable
          onPress={() => router.push(`/course/${item._id}` as any)}
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
          style={({ pressed }) => ({
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: subtleCardBg,
            borderWidth: 1,
            borderColor: enrolled ? `${ENROLLED_GREEN}40` : borderColor,
            opacity: pressed && Platform.OS === "ios" ? 0.85 : 1,
            transform: [{ scale: pressed && Platform.OS === "ios" ? 0.98 : 1 }],
            ...subtleShadow,
          })}
        >
          <View style={{ flexDirection: "row" }}>
            {/* Thumbnail */}
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={{ width: 88, height: 88 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 88,
                  height: 88,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: primarySoftColor,
                }}
              >
                <Ionicons name="book-outline" size={26} color={primaryColor} />
              </View>
            )}

            {/* Content */}
            <View
              style={{
                flex: 1,
                paddingLeft: 14,
                paddingRight: 8,
                paddingVertical: 10,
                justifyContent: "center",
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: textColor,
                  lineHeight: 19,
                }}
              >
                {item.title}
              </Text>

              {item.instructorName ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 3,
                    gap: 4,
                  }}
                >
                  <Ionicons name="person-outline" size={11} color={mutedIconColor} />
                  <Text numberOfLines={1} style={{ fontSize: 11, color: mutedIconColor }}>
                    {item.instructorName}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 6,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {enrolled ? enrolledBadge : null}
                <View
                  style={{
                    backgroundColor: `${label.color}15`,
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: label.color }}>
                    {label.text}
                  </Text>
                </View>
                {item.subject ? (
                  <View
                    style={{
                      backgroundColor: isDark ? "#334155" : "#f1f5f9",
                      borderRadius: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{ fontSize: 10, fontWeight: "500", color: mutedIconColor }}
                    >
                      {item.subject}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Chevron */}
            <View style={{ justifyContent: "center", paddingRight: 14 }}>
              <Ionicons name="chevron-forward" size={16} color={mutedIconColor} />
            </View>
          </View>
        </Pressable>
      );
    },
    [
      textColor,
      borderColor,
      primaryColor,
      primarySoftColor,
      mutedIconColor,
      isDark,
      subtleCardBg,
      isEnrolled,
      enrolledBadge,
      subtleShadow,
    ],
  );

  /* ── Grid item ─── */
  const renderGridItem = useCallback(
    ({ item }: { item: Course | null }) => {
      if (!item) return <View style={{ flex: 1, maxWidth: "50%" }} />;
      const label = pricingLabel(item.pricingModel, item.price);
      const enrolled = isEnrolled(item);
      return (
        <Pressable
          onPress={() => router.push(`/course/${item._id}` as any)}
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
          style={({ pressed }) => ({
            flex: 1,
            maxWidth: "50%",
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: subtleCardBg,
            borderWidth: 1,
            borderColor: enrolled ? `${ENROLLED_GREEN}40` : borderColor,
            opacity: pressed && Platform.OS === "ios" ? 0.85 : 1,
            transform: [{ scale: pressed && Platform.OS === "ios" ? 0.97 : 1 }],
            ...subtleShadow,
          })}
        >
          <View>
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={{ width: "100%", height: 100 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  height: 100,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: primarySoftColor,
                }}
              >
                <Ionicons name="book-outline" size={28} color={primaryColor} />
              </View>
            )}

            {/* Enrolled overlay badge on thumbnail */}
            {enrolled ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  backgroundColor: "rgba(16,185,129,0.9)",
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Ionicons name="checkmark-circle" size={10} color="#fff" />
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                  Enrolled
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ padding: 10 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: textColor,
                lineHeight: 16,
                marginBottom: 4,
              }}
            >
              {item.title}
            </Text>
            {item.instructorName ? (
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, color: mutedIconColor, marginBottom: 6 }}
              >
                {item.instructorName}
              </Text>
            ) : null}
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: `${label.color}15`,
                borderRadius: 5,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: label.color }}>
                {label.text}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [
      textColor,
      borderColor,
      primaryColor,
      primarySoftColor,
      mutedIconColor,
      isDark,
      subtleCardBg,
      isEnrolled,
      subtleShadow,
    ],
  );

  const listSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 8,
          paddingHorizontal: 16,
          backgroundColor,
          borderBottomWidth: 0.5,
          borderBottomColor: borderColor,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <View>
            <Text style={{ fontSize: 26, fontWeight: "700", color: textColor }}>
              Courses
            </Text>
            <Text style={{ fontSize: 12, color: mutedIconColor, marginTop: 1 }}>
              Learn from expert teachers
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Notes icon button */}
            <Pressable
              onPress={() => router.push("/notes" as any)}
              android_ripple={{ color: `${primaryColor}30`, borderless: true }}
              style={({ pressed }) => ({
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? `${primaryColor}25` : primarySoftColor,
              })}
            >
              <Ionicons name="document-text-outline" size={18} color={primaryColor} />
            </Pressable>

            {/* View toggle */}
            <View
              style={{
                flexDirection: "row",
                borderRadius: 10,
                overflow: "hidden",
                borderWidth: 1,
                borderColor,
              }}
            >
              <Pressable
                onPress={() => setViewMode("list")}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  backgroundColor: viewMode === "list" ? primaryColor : "transparent",
                }}
              >
                <Ionicons
                  name="list-outline"
                  size={15}
                  color={viewMode === "list" ? "#fff" : mutedIconColor}
                />
              </Pressable>
              <Pressable
                onPress={() => setViewMode("grid")}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  backgroundColor: viewMode === "grid" ? primaryColor : "transparent",
                }}
              >
                <Ionicons
                  name="grid-outline"
                  size={15}
                  color={viewMode === "grid" ? "#fff" : mutedIconColor}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === "ios" ? 10 : 6,
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={16} color={mutedIconColor} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search courses, teachers..."
            placeholderTextColor={mutedIconColor}
            style={{ flex: 1, fontSize: 14, color: textColor, padding: 0 }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={mutedIconColor} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: primarySoftColor,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name={searchQuery ? "search-outline" : "book-outline"}
              size={28}
              color={primaryColor}
            />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: textColor,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            {searchQuery ? `No results for "${searchQuery}"` : "No courses yet"}
          </Text>
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Text style={{ fontSize: 14, color: primaryColor, fontWeight: "500" }}>
                Clear search
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontSize: 14, color: mutedIconColor, textAlign: "center" }}>
              Courses will appear here once teachers publish them.
            </Text>
          )}
        </View>
      ) : viewMode === "list" ? (
        <FlatList
          key="course-list"
          data={filtered}
          keyExtractor={(item, index) => getCourseKey(item, index)}
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
          }}
          ListHeaderComponent={enrolledHeader}
          ItemSeparatorComponent={listSeparator}
          showsVerticalScrollIndicator={false}
          renderItem={renderListItem}
        />
      ) : (
        <FlatList
          key="course-grid"
          data={gridData}
          keyExtractor={(item, index) =>
            item ? getCourseKey(item, index) : `filler-${index}`
          }
          refreshControl={refreshControl}
          numColumns={2}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
          }}
          ListHeaderComponent={enrolledHeader}
          columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderGridItem}
        />
      )}
    </View>
  );
}
