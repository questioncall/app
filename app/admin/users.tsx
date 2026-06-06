import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type UserRecord = {
  _id: string;
  name: string;
  email: string;
  username?: string;
  role: "STUDENT" | "TEACHER";
  points?: number;
  pointBalance?: number;
  totalAnswered?: number;
  isSuspended?: boolean;
  createdAt: string;
};

function formatNpr(value: number): string {
  return `${Math.round(value).toLocaleString()} NPR`;
}

function formatJoined(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function RoleBadge({ role }: { role: UserRecord["role"] }) {
  const isTeacher = role === "TEACHER";
  const bg = isTeacher ? "rgba(139,92,246,0.12)" : "rgba(59,130,246,0.12)";
  const color = isTeacher ? "#8B5CF6" : "#3B82F6";
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text className="text-[11px] font-bold" style={{ color }}>
        {role}
      </Text>
    </View>
  );
}

function UserCard({
  user,
  busy,
  onToggleSuspend,
}: {
  user: UserRecord;
  busy: boolean;
  onToggleSuspend: (user: UserRecord) => void;
}) {
  const { mutedIconColor } = useAppTheme();
  const suspended = Boolean(user.isSuspended);

  return (
    <View
      className="mb-3 rounded-2xl border border-border bg-card p-4"
      style={suspended ? { backgroundColor: "rgba(239,68,68,0.06)" } : undefined}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[15px] font-semibold text-foreground">{user.name}</Text>
          <Text className="text-[12px] text-muted-foreground">{user.email}</Text>
          {user.username ? (
            <Text className="text-[12px] text-muted-foreground">@{user.username}</Text>
          ) : null}
        </View>
        <RoleBadge role={user.role} />
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {user.role === "STUDENT" ? (
          <Text className="text-[12px] text-muted-foreground">
            Amount:{" "}
            <Text className="font-semibold text-primary">
              {formatNpr(user.points ?? 0)}
            </Text>
          </Text>
        ) : (
          <>
            <Text className="text-[12px] text-muted-foreground">
              Balance:{" "}
              <Text className="font-semibold text-primary">
                {formatNpr(user.pointBalance ?? 0)}
              </Text>
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              Answers:{" "}
              <Text className="font-semibold text-foreground">
                {user.totalAnswered ?? 0}
              </Text>
            </Text>
          </>
        )}
        <Text className="text-[12px]" style={{ color: mutedIconColor }}>
          Joined {formatJoined(user.createdAt)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onToggleSuspend(user)}
        disabled={busy}
        activeOpacity={0.85}
        className="mt-3 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
        style={{
          backgroundColor: suspended ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        }}
      >
        {busy ? (
          <ActivityIndicator color={suspended ? "#10B981" : "#EF4444"} />
        ) : (
          <>
            <Ionicons
              name={suspended ? "shield-checkmark-outline" : "shield-outline"}
              size={16}
              color={suspended ? "#10B981" : "#EF4444"}
            />
            <Text
              className="text-[13px] font-semibold"
              style={{ color: suspended ? "#10B981" : "#EF4444" }}
            >
              {suspended ? "Unsuspend" : "Suspend"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [users, setUsers] = useState<UserRecord[]>(
    () => readCache<UserRecord[]>("users") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("users") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/users");
      const data = Array.isArray(res.data) ? res.data : [];
      setUsers(data);
      writeCache("users", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load users",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.username ? u.username.toLowerCase().includes(query) : false),
    );
  }, [users, search]);

  const handleToggleSuspend = useCallback((user: UserRecord) => {
    const suspend = !user.isSuspended;
    Alert.alert(
      suspend ? "Suspend User?" : "Unsuspend User?",
      suspend
        ? `${user.name} will lose access to the platform immediately.`
        : `${user.name} will regain access to the platform.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: suspend ? "Suspend" : "Unsuspend",
          style: suspend ? "destructive" : "default",
          onPress: async () => {
            setBusyId(user._id);
            try {
              const res = await api.post(`/mobile/admin/users/${user._id}/suspend`);
              const isSuspended = Boolean(res.data?.isSuspended);
              setUsers((prev) =>
                prev.map((u) => (u._id === user._id ? { ...u, isSuspended } : u)),
              );
              Toast.show({
                type: "success",
                text1: res.data?.message ?? "Updated",
                position: "bottom",
              });
            } catch (err) {
              Toast.show({
                type: "error",
                text1: "Action failed",
                text2: getRequestErrorMessage(err, "Please try again."),
                position: "bottom",
              });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }, []);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-[18px] font-bold tracking-tight text-foreground">
              Users
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {filtered.length} of {users.length}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-card px-3">
          <Ionicons name="search" size={18} color={iconColor} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email or @username"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            className="flex-1 px-2 py-3 text-[14px] text-foreground"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              busy={busyId === item._id}
              onToggleSuspend={handleToggleSuspend}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="people-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                {search ? "No matching users." : "No users found."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
