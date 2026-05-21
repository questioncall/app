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

// ─── Time formatter (WhatsApp style) ──────────────────────────
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
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

// ─── Status pill ───────────────────────────────────────────────
function StatusPill({ status }: { status: ChannelListItem["status"] }) {
  if (status === "ACTIVE") return null;
  return (
    <View
      className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
      style={{
        backgroundColor: status === "CLOSED" ? "#10b98115" : "#ef444415",
      }}
    >
      <Ionicons
        name={status === "CLOSED" ? "lock-closed" : "alert-circle"}
        size={9}
        color={status === "CLOSED" ? "#10b981" : "#ef4444"}
      />
      <Text
        className="text-[9px] font-semibold"
        style={{ color: status === "CLOSED" ? "#10b981" : "#ef4444" }}
      >
        {status === "CLOSED" ? "Closed" : "Expired"}
      </Text>
    </View>
  );
}

// ─── Row avatar ───────────────────────────────────────────────
function ChannelAvatar({
  name,
  image,
  status,
  primaryColor,
  primarySoftColor,
}: {
  name: string;
  image?: string;
  status: ChannelListItem["status"];
  primaryColor: string;
  primarySoftColor: string;
}) {
  return (
    <View style={{ width: 50, height: 50 }}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: 50, height: 50, borderRadius: 25 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: primarySoftColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: primaryColor }}>
            {(name ?? "?")[0].toUpperCase()}
          </Text>
        </View>
      )}
      {status === "ACTIVE" && (
        <View
          style={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: "#22c55e",
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      )}
    </View>
  );
}

// ─── Single channel row ───────────────────────────────────────
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
  const hasUnread = item.unreadCount > 0 && item.status === "ACTIVE";
  const preview =
    item.lastMessagePreview ?? (item.status === "ACTIVE" ? "Channel opened" : "");

  return (
    <TouchableOpacity
      onPress={() => router.push(`/workspace/${item.id}` as any)}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 16,
        paddingVertical: 10,
      }}
    >
      <ChannelAvatar
        name={item.counterpartName}
        image={item.counterpartImage}
        status={item.status}
        primaryColor={primaryColor}
        primarySoftColor={primarySoftColor}
      />

      <View style={{ flex: 1, marginLeft: 14 }}>
        {/* Row 1: name + time */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: "600",
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
            fontSize: 13,
            fontWeight: "500",
            color: isDark ? "#94a3b8" : "#475569",
            marginBottom: 2,
          }}
        >
          {item.questionTitle}
        </Text>

        {/* Row 3: preview + status pill + unread badge */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 13,
              color: hasUnread ? (isDark ? "#e2e8f0" : "#334155") : mutedIconColor,
              fontWeight: hasUnread ? "500" : "400",
              marginRight: 8,
            }}
          >
            {preview}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StatusPill status={item.status} />
            {hasUnread ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: primaryColor,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
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

// ─── Separator: left-indented like WhatsApp ───────────────────
function Separator({ borderColor }: { borderColor: string }) {
  return (
    <View
      style={{
        height: 0.5,
        marginLeft: 80,
        backgroundColor: borderColor,
        opacity: 0.6,
      }}
    />
  );
}

// ─── Online users bar ─────────────────────────────────────────
interface Counterpart {
  id: string;
  name: string;
  image?: string;
}

function OnlineBar({
  counterparts,
  onlineIds,
  primaryColor,
  primarySoftColor,
  mutedIconColor,
  borderColor,
  isDark,
}: {
  counterparts: Counterpart[];
  onlineIds: Set<string>;
  primaryColor: string;
  primarySoftColor: string;
  mutedIconColor: string;
  borderColor: string;
  isDark: boolean;
}) {
  if (counterparts.length === 0) return null;

  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: borderColor,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {counterparts.map((user) => {
          const isOnline = onlineIds.has(user.id);
          return (
            <View
              key={user.id}
              style={{ alignItems: "center", marginHorizontal: 6, width: 56 }}
            >
              <View style={{ width: 46, height: 46 }}>
                {user.image ? (
                  <Image
                    source={{ uri: user.image }}
                    style={{ width: 46, height: 46, borderRadius: 23 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: primarySoftColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 18, fontWeight: "700", color: primaryColor }}
                    >
                      {(user.name ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {isOnline && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 1,
                      right: 1,
                      width: 13,
                      height: 13,
                      borderRadius: 7,
                      backgroundColor: "#22c55e",
                      borderWidth: 2,
                      borderColor: isDark ? "#1e293b" : "#ffffff",
                    }}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: isOnline ? (isDark ? "#e2e8f0" : "#0f172a") : mutedIconColor,
                  fontWeight: isOnline ? "600" : "400",
                  marginTop: 4,
                  textAlign: "center",
                  width: 56,
                }}
              >
                {user.name.split(" ")[0]}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function ChannelsScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);
  const { list, isLoading, isRefreshing, lastFetchedAt, loadedForUserId, error } =
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

  const cacheMatchesUser = loadedForUserId === userId;
  const channels = cacheMatchesUser ? list : [];
  const shouldUseCache = cacheMatchesUser && !selectIsChannelsStale(lastFetchedAt);
  // True only when we have no data yet (initial blank load)
  const showInitialSpinner = isLoading && channels.length === 0;

  const loadChannels = useCallback(
    async (force = false) => {
      if (!force && (isLoading || shouldUseCache)) return;
      // Only show full-screen spinner when there is nothing cached yet
      if (list.length === 0) {
        dispatch(setChannelsLoading(true));
      }
      try {
        const res = await api.get("/channels");
        dispatch(
          setChannels({
            channels: Array.isArray(res.data) ? res.data : [],
            userId,
          }),
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
    } catch {}
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

  // Unique counterparts across all channels (deduplicated by user ID)
  const counterparts = useMemo(() => {
    const seen = new Set<string>();
    const result: Counterpart[] = [];
    for (const ch of channels) {
      if (!ch.counterpartId || seen.has(ch.counterpartId)) continue;
      seen.add(ch.counterpartId);
      result.push({
        id: ch.counterpartId,
        name: ch.counterpartName,
        image: ch.counterpartImage,
      });
    }
    return result;
  }, [channels]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* ── Header ───────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
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
              Channels
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

      {/* ── Online users ────────────────────────────────── */}
      <OnlineBar
        counterparts={counterparts}
        onlineIds={onlineIds}
        primaryColor={primaryColor}
        primarySoftColor={primarySoftColor}
        mutedIconColor={mutedIconColor}
        borderColor={borderColor}
        isDark={isDark}
      />

      {/* ── Content ──────────────────────────────────────── */}
      {showInitialSpinner ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : channels.length === 0 ? (
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
            No channels yet
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: mutedIconColor,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Channels open when a teacher accepts your question. They appear here
            instantly.
          </Text>
        </View>
      ) : (
        <FlatList
          data={channels}
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
