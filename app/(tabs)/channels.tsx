import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  setChannels,
  setChannelsLoading,
  setChannelsRefreshing,
  setChannelsError,
  selectIsChannelsStale,
} from "@/store/slices/channelsSlice";
import type { ChannelListItem } from "@/store/slices/channelsSlice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

// ─── Time formatter ───────────────────────────────────────────
function formatChannelTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

// ─── Active users bar ─────────────────────────────────────────
interface Counterpart {
  id: string;
  name: string;
  image?: string;
  lastChannelId: string; // most-recent channel — used for tap navigation
}

function ActiveUsersBar({
  counterparts,
  onlineIds,
  primaryColor,
  primarySoftColor,
  borderColor,
  isDark,
}: {
  counterparts: Counterpart[];
  onlineIds: Set<string>;
  primaryColor: string;
  primarySoftColor: string;
  borderColor: string;
  isDark: boolean;
}) {
  if (counterparts.length === 0) return null;

  const bg = isDark ? "#0f172a" : "#ffffff";

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: borderColor,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {counterparts.map((user) => {
          const online = onlineIds.has(user.id);
          return (
            <TouchableOpacity
              key={user.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/workspace/${user.lastChannelId}` as any)}
              style={{ alignItems: "center", marginRight: 18, width: 56 }}
            >
              {/* Avatar */}
              <View style={{ width: 52, height: 52 }}>
                {user.image ? (
                  <Image
                    source={{ uri: user.image }}
                    style={{ width: 52, height: 52, borderRadius: 26 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: primarySoftColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 19, fontWeight: "700", color: primaryColor }}
                    >
                      {(user.name ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Green online dot — only if actually online */}
                {online && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 1,
                      right: 1,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: "#22c55e",
                      borderWidth: 2.5,
                      borderColor: bg,
                    }}
                  />
                )}
              </View>

              {/* First name */}
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  marginTop: 5,
                  textAlign: "center",
                  width: 56,
                  color: isDark ? "#cbd5e1" : "#374151",
                  fontWeight: "500",
                }}
              >
                {user.name.split(" ")[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Channel row (messenger style) ───────────────────────────
function ChannelRow({
  item,
  primaryColor,
  primarySoftColor,
  mutedIconColor,
  borderColor,
  isDark,
}: {
  item: ChannelListItem;
  primaryColor: string;
  primarySoftColor: string;
  mutedIconColor: string;
  borderColor: string;
  isDark: boolean;
}) {
  const timeStr = formatChannelTime(item.lastMessageAt ?? item.timerDeadline);
  const hasUnread = item.unreadCount > 0;
  const isActive = item.status === "ACTIVE";

  // Preview line: last message or fallback
  const preview = item.lastMessagePreview
    ? item.lastMessagePreview
    : isActive
      ? "Channel opened"
      : item.status === "CLOSED"
        ? "Channel closed"
        : "Channel expired";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/workspace/${item.id}` as any)}
      activeOpacity={0.55}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      {/* Avatar */}
      <View style={{ width: 54, height: 54, marginRight: 13 }}>
        {item.counterpartImage ? (
          <Image
            source={{ uri: item.counterpartImage }}
            style={{ width: 54, height: 54, borderRadius: 27 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: primarySoftColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: primaryColor }}>
              {(item.counterpartName ?? "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        {/* Active channel = green dot on list row too */}
        {isActive && (
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: "#22c55e",
              borderWidth: 2,
              borderColor: isDark ? "#0f172a" : "#ffffff",
            }}
          />
        )}
      </View>

      {/* Text block */}
      <View style={{ flex: 1 }}>
        {/* Row 1: name + timestamp */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: hasUnread ? "700" : "600",
              color: isDark ? "#f1f5f9" : "#0f172a",
              marginRight: 8,
            }}
          >
            {item.counterpartName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: hasUnread ? primaryColor : mutedIconColor,
              fontWeight: hasUnread ? "600" : "400",
            }}
          >
            {timeStr}
          </Text>
        </View>

        {/* Row 2: question title */}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            fontWeight: "500",
            color: isDark ? "#64748b" : "#64748b",
            marginBottom: 2,
          }}
        >
          {item.questionTitle}
        </Text>

        {/* Row 3: preview + status badges */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 13,
              color: hasUnread ? (isDark ? "#e2e8f0" : "#111827") : mutedIconColor,
              fontWeight: hasUnread ? "500" : "400",
              marginRight: 8,
            }}
          >
            {preview}
          </Text>

          {/* Right-side badges */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {/* Non-active status pill */}
            {!isActive && (
              <View
                style={{
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: item.status === "CLOSED" ? "#10b98118" : "#ef444418",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: item.status === "CLOSED" ? "#10b981" : "#ef4444",
                  }}
                >
                  {item.status === "CLOSED" ? "Closed" : "Expired"}
                </Text>
              </View>
            )}

            {/* Unread badge */}
            {hasUnread ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: primaryColor,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 5,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Separator ────────────────────────────────────────────────
function Separator({ borderColor }: { borderColor: string }) {
  return (
    <View
      style={{ height: 0.5, marginLeft: 83, backgroundColor: borderColor, opacity: 0.5 }}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function ChannelsScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);
  const { list, isLoading, isRefreshing, lastFetchedAt, loadedForUserId } =
    useAppSelector((s) => s.channels);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    borderColor,
    isDark,
  } = useAppTheme();

  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const cacheMatchesUser = loadedForUserId === userId;
  const channels = cacheMatchesUser ? list : [];
  const shouldUseCache = cacheMatchesUser && !selectIsChannelsStale(lastFetchedAt);
  const showInitialSpinner = isLoading && channels.length === 0;

  const loadChannels = useCallback(
    async (force = false) => {
      if (!force && (isLoading || shouldUseCache)) return;
      if (list.length === 0) dispatch(setChannelsLoading(true));
      try {
        const res = await api.get("/channels");
        dispatch(
          setChannels({ channels: Array.isArray(res.data) ? res.data : [], userId }),
        );
      } catch {
        dispatch(setChannelsLoading(false));
        dispatch(setChannelsRefreshing(false));
      }
    },
    [dispatch, isLoading, shouldUseCache, userId, list.length],
  );

  const loadOnlineUsers = useCallback(async () => {
    try {
      const res = await api.get("/users/online");
      if (Array.isArray(res.data)) setOnlineIds(new Set<string>(res.data));
    } catch {
      // silently ignore — dots just won't show
    }
  }, []);

  useEffect(() => {
    void loadChannels();
    void loadOnlineUsers();
  }, [loadChannels, loadOnlineUsers]);

  const handleRefresh = useCallback(async () => {
    dispatch(setChannelsRefreshing(true));
    await Promise.all([loadChannels(true), loadOnlineUsers()]);
  }, [dispatch, loadChannels, loadOnlineUsers]);

  const activeCount = channels.filter((c) => c.status === "ACTIVE").length;

  const filteredChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.counterpartName.toLowerCase().includes(q) ||
        c.questionTitle.toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  // Build unique counterparts from ALL channels (not just active).
  // Keep track of their most-recent channel ID for tap navigation.
  // Channels are sorted newest-first from the API, so first-seen = most recent.
  const counterparts = useMemo<Counterpart[]>(() => {
    const seen = new Map<string, Counterpart>();
    for (const ch of channels) {
      if (!ch.counterpartId) continue;
      if (!seen.has(ch.counterpartId)) {
        seen.set(ch.counterpartId, {
          id: ch.counterpartId,
          name: ch.counterpartName,
          image: ch.counterpartImage,
          lastChannelId: ch.id,
        });
      }
    }
    return Array.from(seen.values());
  }, [channels]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* ── Header ───────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 14,
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
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "700",
                color: isDark ? "#f1f5f9" : "#0f172a",
              }}
            >
              Messages
            </Text>
            {activeCount > 0 && (
              <Text
                style={{
                  fontSize: 12,
                  color: primaryColor,
                  fontWeight: "500",
                  marginTop: 1,
                }}
              >
                {activeCount} active
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              dispatch(setChannelsRefreshing(true));
              void loadChannels(true);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: primarySoftColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="refresh-outline" size={18} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ───────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color={mutedIconColor}
            style={{ marginRight: 8 }}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor={mutedIconColor}
            style={{
              flex: 1,
              fontSize: 15,
              color: isDark ? "#f1f5f9" : "#0f172a",
              paddingVertical: 0,
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={mutedIconColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Active users bar ─────────────────────────────── */}
      <ActiveUsersBar
        counterparts={counterparts}
        onlineIds={onlineIds}
        primaryColor={primaryColor}
        primarySoftColor={primarySoftColor}
        borderColor={borderColor}
        isDark={isDark}
      />

      {/* ── Content ──────────────────────────────────────── */}
      {showInitialSpinner ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : filteredChannels.length === 0 ? (
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
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: primarySoftColor,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={32} color={primaryColor} />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: isDark ? "#f1f5f9" : "#0f172a",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            No messages yet
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: mutedIconColor,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {searchQuery
              ? "No channels match your search."
              : "Channels open when a teacher accepts your question. They appear here instantly."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChannels}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <ChannelRow
              item={item}
              primaryColor={primaryColor}
              primarySoftColor={primarySoftColor}
              mutedIconColor={mutedIconColor}
              borderColor={borderColor}
              isDark={isDark}
            />
          )}
          ItemSeparatorComponent={() => <Separator borderColor={borderColor} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
            />
          }
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
