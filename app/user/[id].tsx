import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useImageViewer } from "@/components/image-viewer/image-viewer-context";
import { InlineVideo } from "@/components/media/inline-video";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type PublicProfile = {
  id: string;
  name: string;
  username: string;
  role: string;
  userImage: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  points: number;
  totalAnswered: number;
  totalAsked: number;
  averageRating: number;
  ratingCount: number;
  teacherModeVerified: boolean;
  joinedAt: string | null;
  lastActiveAt: string | null;
  isOnline: boolean;
  followerCount?: number;
  followingCount?: number;
  favouriteCount?: number;
  uploadedAssetCount?: number;
};

type FavouriteCourse = {
  id: string;
  title: string;
  description?: string | null;
  subject?: string;
  level?: string;
  pricingModel: "FREE" | "SUBSCRIPTION_INCLUDED" | "PAID";
  thumbnailUrl?: string | null;
  instructorName?: string;
  totalDurationMinutes?: number | null;
  enrollmentCount?: number;
};

type ProfileMediaAsset = {
  url: string;
  type: "video" | "image";
  questionId?: string;
  questionTitle?: string;
};

type ProfilePost = {
  id: string;
  title: string;
  body: string;
  images: string[];
  status: "OPEN" | "ACCEPTED" | "SOLVED" | "RESET";
  subject?: string;
  level?: string;
  createdAt: string;
  answer: { content?: string; mediaUrls?: string[]; rating?: number | null } | null;
};

const PAGE_SIZE = 15;

function formatTimeAgo(value: string) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "";
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatJoined(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatLastActive(isOnline: boolean, lastActiveAt: string | null) {
  if (isOnline) return "Active now";
  if (!lastActiveAt) return null;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "Flexible";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function pricingLabel(model: FavouriteCourse["pricingModel"]) {
  if (model === "FREE") return "Free";
  if (model === "SUBSCRIPTION_INCLUDED") return "Subscription";
  return "Premium";
}

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { openImageViewer } = useImageViewer();
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    iconColor,
    isDark,
  } = useAppTheme();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favouriteCourses, setFavouriteCourses] = useState<FavouriteCourse[]>([]);
  const [mediaAssets, setMediaAssets] = useState<ProfileMediaAsset[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/users/${id}/public?limit=${PAGE_SIZE}`);
      setProfile(res.data.profile);
      setPosts(Array.isArray(res.data.posts) ? res.data.posts : []);
      setFavouriteCourses(
        Array.isArray(res.data.favouriteCourses) ? res.data.favouriteCourses : [],
      );
      setMediaAssets(Array.isArray(res.data.mediaAssets) ? res.data.mediaAssets : []);
      setHasMore(Boolean(res.data.hasMore));
    } catch (err: any) {
      setError(
        err?.response?.status === 404
          ? "This profile isn't available."
          : "Couldn't load this profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(
        `/users/${id}/public?limit=${PAGE_SIZE}&offset=${posts.length}`,
      );
      const next = Array.isArray(res.data.posts) ? res.data.posts : [];
      setPosts((prev) => [...prev, ...next]);
      setHasMore(Boolean(res.data.hasMore));
    } catch {
      // silent — user can retry by scrolling
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, hasMore, posts.length]);

  const isTeacher = profile?.role === "TEACHER";
  const presenceLabel = profile
    ? formatLastActive(profile.isOnline, profile.lastActiveAt)
    : null;
  const videoAssets = mediaAssets.filter((asset) => asset.type === "video");
  const imageAssets = mediaAssets.filter((asset) => asset.type === "image");

  const renderHeader = () => {
    if (!profile) return null;
    const joined = formatJoined(profile.joinedAt);
    return (
      <View>
        {/* Identity card */}
        <View
          style={{
            backgroundColor: cardColor,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 18,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ width: 84, height: 84 }}>
              {profile.userImage ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => openImageViewer(profile.userImage!)}
                >
                  <Image
                    source={{ uri: profile.userImage }}
                    style={{ width: 84, height: 84, borderRadius: 42 }}
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: primarySoftColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: "700", color: primaryColor }}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {profile.isOnline ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "#22c55e",
                    borderWidth: 3,
                    borderColor: cardColor,
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    flexShrink: 1,
                  }}
                >
                  {profile.name}
                </Text>
                {profile.teacherModeVerified ? (
                  <Ionicons name="checkmark-circle" size={18} color={primaryColor} />
                ) : null}
              </View>
              <Text style={{ fontSize: 13, color: mutedIconColor, marginTop: 2 }}>
                @{profile.username}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: primarySoftColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: primaryColor,
                    }}
                  >
                    {isTeacher ? "Teacher" : "Student"}
                  </Text>
                </View>
                {presenceLabel ? (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: profile.isOnline ? "600" : "400",
                      color: profile.isOnline ? "#22c55e" : mutedIconColor,
                    }}
                  >
                    {presenceLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {profile.bio ? (
            <Text
              style={{
                fontSize: 14,
                lineHeight: 21,
                color: isDark ? "#cbd5e1" : "#334155",
                marginTop: 14,
              }}
            >
              {profile.bio}
            </Text>
          ) : null}

          {/* Stats */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor,
              overflow: "hidden",
            }}
          >
            <Stat
              label={isTeacher ? "Solved" : "Asked"}
              value={String(isTeacher ? profile.totalAnswered : profile.totalAsked)}
              isDark={isDark}
              borderColor={borderColor}
              mutedIconColor={mutedIconColor}
            />
            <Stat
              label={isTeacher ? "Followers" : "Points"}
              value={String(isTeacher ? (profile.followerCount ?? 0) : profile.points)}
              isDark={isDark}
              borderColor={borderColor}
              mutedIconColor={mutedIconColor}
            />
            <Stat
              label={isTeacher ? "Assets" : "Favorites"}
              value={String(
                isTeacher
                  ? (profile.uploadedAssetCount ?? mediaAssets.length)
                  : (profile.favouriteCount ?? favouriteCourses.length),
              )}
              isDark={isDark}
              borderColor={borderColor}
              mutedIconColor={mutedIconColor}
            />
            {isTeacher ? (
              <Stat
                label="Rating"
                value={profile.ratingCount > 0 ? profile.averageRating.toFixed(1) : "—"}
                isDark={isDark}
                borderColor={borderColor}
                mutedIconColor={mutedIconColor}
                last
              />
            ) : (
              <Stat
                label="Joined"
                value={joined ? joined.split(" ")[0] : "—"}
                isDark={isDark}
                borderColor={borderColor}
                mutedIconColor={mutedIconColor}
                last
              />
            )}
          </View>

          {/* Skills / interests */}
          {profile.skills.length > 0 || profile.interests.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 14 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {[...profile.skills, ...profile.interests].map((tag, i) => (
                <View
                  key={`${tag}-${i}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor,
                    backgroundColor,
                  }}
                >
                  <Text style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569" }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {isTeacher ? (
            <View style={{ marginTop: 16 }}>
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor,
                  backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                  padding: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: isDark ? "#f1f5f9" : "#0f172a",
                      }}
                    >
                      Teaching showcase
                    </Text>
                    <Text
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        lineHeight: 17,
                        color: mutedIconColor,
                      }}
                    >
                      Public videos and images uploaded in solved answers.
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: primarySoftColor,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, fontWeight: "800", color: primaryColor }}
                    >
                      {profile.followerCount ?? 0} followers
                    </Text>
                  </View>
                </View>

                {mediaAssets.length > 0 ? (
                  <View style={{ marginTop: 14, gap: 14 }}>
                    {videoAssets.length > 0 ? (
                      <View>
                        <Text
                          style={{
                            marginBottom: 8,
                            fontSize: 12,
                            fontWeight: "800",
                            color: mutedIconColor,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                          }}
                        >
                          Videos
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 10 }}
                        >
                          {videoAssets.map((asset, index) => (
                            <View key={`${asset.url}-${index}`} style={{ width: 168 }}>
                              <InlineVideo
                                uri={asset.url}
                                width={168}
                                height={96}
                                borderColor={borderColor}
                                borderRadius={13}
                              />
                              <Text
                                numberOfLines={2}
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  lineHeight: 16,
                                  color: isDark ? "#e2e8f0" : "#334155",
                                  fontWeight: "600",
                                }}
                              >
                                {asset.questionTitle || "Answered question"}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}

                    {imageAssets.length > 0 ? (
                      <View>
                        <Text
                          style={{
                            marginBottom: 8,
                            fontSize: 12,
                            fontWeight: "800",
                            color: mutedIconColor,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                          }}
                        >
                          Images
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 10 }}
                        >
                          {imageAssets.map((asset, index) => (
                            <TouchableOpacity
                              key={`${asset.url}-${index}`}
                              activeOpacity={0.86}
                              onPress={() => openImageViewer(asset.url)}
                              style={{ width: 104 }}
                            >
                              <Image
                                source={{ uri: asset.url }}
                                style={{
                                  width: 104,
                                  height: 104,
                                  borderRadius: 13,
                                  borderWidth: 1,
                                  borderColor,
                                }}
                                resizeMode="cover"
                              />
                              <Text
                                numberOfLines={2}
                                style={{
                                  marginTop: 6,
                                  fontSize: 11.5,
                                  lineHeight: 15,
                                  color: mutedIconColor,
                                  fontWeight: "600",
                                }}
                              >
                                {asset.questionTitle || "Answer image"}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={{
                      marginTop: 14,
                      borderRadius: 13,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor,
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: mutedIconColor, fontSize: 13 }}>
                      No public uploaded answer assets yet.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor,
                  backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                  padding: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: isDark ? "#f1f5f9" : "#0f172a",
                      }}
                    >
                      Favorite courses
                    </Text>
                    <Text style={{ marginTop: 3, fontSize: 12, color: mutedIconColor }}>
                      Courses this student saved for later.
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: primarySoftColor,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, fontWeight: "800", color: primaryColor }}
                    >
                      {profile.favouriteCount ?? favouriteCourses.length}
                    </Text>
                  </View>
                </View>

                {favouriteCourses.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {favouriteCourses.map((course) => (
                      <TouchableOpacity
                        key={course.id}
                        activeOpacity={0.86}
                        onPress={() => router.push(`/course/${course.id}` as any)}
                        style={{
                          width: 164,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor,
                          backgroundColor: cardColor,
                          overflow: "hidden",
                        }}
                      >
                        {course.thumbnailUrl ? (
                          <Image
                            source={{ uri: course.thumbnailUrl }}
                            style={{ width: "100%", height: 86 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              height: 86,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: primarySoftColor,
                            }}
                          >
                            <Ionicons
                              name="book-outline"
                              size={28}
                              color={primaryColor}
                            />
                          </View>
                        )}
                        <View style={{ padding: 10 }}>
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 13,
                              lineHeight: 17,
                              fontWeight: "800",
                              color: isDark ? "#f1f5f9" : "#0f172a",
                            }}
                          >
                            {course.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ marginTop: 4, fontSize: 11, color: mutedIconColor }}
                          >
                            {pricingLabel(course.pricingModel)} ·{" "}
                            {formatDuration(course.totalDurationMinutes)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View
                    style={{
                      marginTop: 12,
                      borderRadius: 13,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor,
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: mutedIconColor, fontSize: 13 }}>
                      No favorite courses yet.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Posts section label */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
            color: mutedIconColor,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 8,
          }}
        >
          Posts
        </Text>
      </View>
    );
  };

  const renderPost = ({ item }: { item: ProfilePost }) => {
    const isSolved = item.status === "SOLVED";
    return (
      <View
        style={{
          backgroundColor: cardColor,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}
        >
          <Text style={{ fontSize: 12, color: mutedIconColor }}>
            {formatTimeAgo(item.createdAt)}
          </Text>
          {item.subject ? (
            <Text style={{ fontSize: 12, color: mutedIconColor }}>· {item.subject}</Text>
          ) : null}
          {isSolved ? (
            <View
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: "#10b98118",
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={{ fontSize: 10, fontWeight: "600", color: "#10b981" }}>
                Solved
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            lineHeight: 22,
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          {item.title}
        </Text>
        {item.body ? (
          <Text
            numberOfLines={3}
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: mutedIconColor,
              marginTop: 4,
            }}
          >
            {item.body}
          </Text>
        ) : null}

        {item.images.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {item.images.map((url, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.85}
                onPress={() => openImageViewer(url)}
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <Image source={{ uri: url }} style={{ width: 96, height: 96 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {item.answer?.content ? (
          <View
            style={{
              marginTop: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#10b98133",
              backgroundColor: "#10b9810d",
              padding: 12,
            }}
          >
            <Text
              numberOfLines={4}
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: isDark ? "#d1fae5" : "#065f46",
              }}
            >
              {item.answer.content}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor,
          borderBottomWidth: 0.5,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: isDark ? "#f1f5f9" : "#0f172a",
            flex: 1,
          }}
        >
          {profile?.name ?? "Profile"}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
            gap: 12,
          }}
        >
          <Ionicons name="person-outline" size={40} color={mutedIconColor} />
          <Text style={{ fontSize: 15, color: mutedIconColor, textAlign: "center" }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={load}
            style={{
              marginTop: 4,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: primaryColor,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View
              style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 40 }}
            >
              <Ionicons name="document-text-outline" size={32} color={mutedIconColor} />
              <Text
                style={{
                  fontSize: 14,
                  color: mutedIconColor,
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                No posts yet.
              </Text>
            </View>
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  isDark,
  borderColor,
  mutedIconColor,
  last,
}: {
  label: string;
  value: string;
  isDark: boolean;
  borderColor: string;
  mutedIconColor: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderRightWidth: last ? 0 : 1,
        borderRightColor: borderColor,
      }}
    >
      <Text
        style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#f1f5f9" : "#0f172a" }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: mutedIconColor, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
