import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
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

type Coupon = {
  _id: string;
  code: string;
  discountPercentage: number;
  scope: "GLOBAL" | "COURSE" | string;
  courseId?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
  redemptionCount?: number;
  expiryDate?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type CourseOption = { _id: string; title: string };

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

export default function AdminCouponsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<Coupon[]>(
    () => readCache<Coupon[]>("coupons") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("coupons") === undefined);
  const [refreshing, setRefreshing] = useState(false);

  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "COURSE">("GLOBAL");

  // edit state
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editUsage, setEditUsage] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [discount, setDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiry, setExpiry] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>(() =>
    (readCache<{ _id: string; title: string }[]>("courses") ?? []).map((c) => ({
      _id: c._id,
      title: c.title,
    })),
  );
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/coupons");
      const data = Array.isArray(res.data?.coupons) ? res.data.coupons : [];
      setItems(data);
      writeCache("coupons", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load coupons",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(async () => {
    setCode("");
    setScope("GLOBAL");
    setDiscount("");
    setUsageLimit("");
    setExpiry("");
    setSelectedCourse(null);
    setCreating(true);
    if (courses.length === 0) {
      try {
        const res = await api.get("/mobile/admin/courses");
        setCourses(
          (Array.isArray(res.data) ? res.data : []).map(
            (c: { _id: string; title: string }) => ({
              _id: c._id,
              title: c.title,
            }),
          ),
        );
      } catch {
        // non-fatal; course-scoped create just won't have options
      }
    }
  }, [courses.length]);

  const submitCreate = useCallback(async () => {
    if (!code.trim() || !Number(discount)) {
      Toast.show({
        type: "error",
        text1: "Code and discount are required",
        position: "bottom",
      });
      return;
    }
    if (scope === "COURSE" && !selectedCourse) {
      Toast.show({
        type: "error",
        text1: "Pick a course for course-scoped coupon",
        position: "bottom",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/mobile/admin/coupons", {
        code: code.trim().toUpperCase(),
        scope,
        courseId: scope === "COURSE" ? selectedCourse?._id : null,
        discountPercentage: Number(discount),
        usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
        expiryDate: expiry.trim() || null,
      });
      setItems((prev) => [{ ...res.data, redemptionCount: 0 }, ...prev]);
      Toast.show({ type: "success", text1: "Coupon created", position: "bottom" });
      setCreating(false);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to create coupon",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  }, [code, discount, scope, selectedCourse, usageLimit, expiry]);

  const toggleActive = useCallback(async (coupon: Coupon) => {
    const next = !coupon.isActive;
    setItems((prev) =>
      prev.map((c) => (c._id === coupon._id ? { ...c, isActive: next } : c)),
    );
    try {
      await api.patch(`/mobile/admin/coupons/${coupon._id}`, { isActive: next });
    } catch (err) {
      setItems((prev) =>
        prev.map((c) => (c._id === coupon._id ? { ...c, isActive: !next } : c)),
      );
      Toast.show({
        type: "error",
        text1: "Failed to update",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    }
  }, []);

  const deleteCoupon = useCallback((coupon: Coupon) => {
    Alert.alert("Delete coupon?", `"${coupon.code}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/mobile/admin/coupons/${coupon._id}`);
            setItems((prev) => prev.filter((c) => c._id !== coupon._id));
            Toast.show({ type: "success", text1: "Coupon deleted", position: "bottom" });
          } catch (err) {
            Toast.show({
              type: "error",
              text1: "Failed to delete",
              text2: getRequestErrorMessage(err, "Please try again."),
              position: "bottom",
            });
          }
        },
      },
    ]);
  }, []);

  const openEdit = useCallback((coupon: Coupon) => {
    setEditTarget(coupon);
    setEditCode(coupon.code);
    setEditUsage(coupon.usageLimit ? String(coupon.usageLimit) : "");
    setEditExpiry(coupon.expiryDate ? coupon.expiryDate.slice(0, 10) : "");
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editTarget) return;
    if (!editCode.trim()) {
      Toast.show({ type: "error", text1: "Code is required", position: "bottom" });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await api.patch(`/mobile/admin/coupons/${editTarget._id}`, {
        code: editCode.trim().toUpperCase(),
        usageLimit: editUsage.trim() ? Number(editUsage) : null,
        expiryDate: editExpiry.trim() || null,
      });
      setItems((prev) =>
        prev.map((c) =>
          c._id === editTarget._id
            ? { ...c, ...res.data, redemptionCount: c.redemptionCount }
            : c,
        ),
      );
      Toast.show({ type: "success", text1: "Coupon updated", position: "bottom" });
      setEditTarget(null);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to update",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSavingEdit(false);
    }
  }, [editTarget, editCode, editUsage, editExpiry]);

  const renderItem = useCallback(
    ({ item }: { item: Coupon }) => {
      const expiryLabel = formatDate(item.expiryDate);
      const used = item.usedCount ?? item.redemptionCount ?? 0;
      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[16px] font-bold tracking-wide text-foreground">
                {item.code}
              </Text>
              <Text className="mt-0.5 text-[12px] text-muted-foreground">
                {item.discountPercentage}% off ·{" "}
                {item.scope === "GLOBAL" ? "Global" : "Course"}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: item.isActive
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(120,120,120,0.12)",
              }}
            >
              <Text
                className="text-[11px] font-bold"
                style={{ color: item.isActive ? "#10B981" : "#888" }}
              >
                {item.isActive ? "ACTIVE" : "OFF"}
              </Text>
            </View>
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text className="text-[12px] text-muted-foreground">
              Used {used}
              {item.usageLimit ? ` / ${item.usageLimit}` : ""}
            </Text>
            {expiryLabel ? (
              <Text className="text-[12px] text-muted-foreground">
                Expires {expiryLabel}
              </Text>
            ) : (
              <Text className="text-[12px] text-muted-foreground">No expiry</Text>
            )}
          </View>

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={() => openEdit(item)}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-2.5"
            >
              <Ionicons name="create-outline" size={16} color={iconColor} />
              <Text className="text-[13px] font-semibold text-foreground">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleActive(item)}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-2.5"
            >
              <Ionicons
                name={item.isActive ? "pause-outline" : "play-outline"}
                size={16}
                color={iconColor}
              />
              <Text className="text-[13px] font-semibold text-foreground">
                {item.isActive ? "Disable" : "Enable"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteCoupon(item)}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
              style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text className="text-[13px] font-semibold" style={{ color: "#EF4444" }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [iconColor, toggleActive, deleteCoupon, openEdit],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center justify-between">
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
                Coupons
              </Text>
              <Text className="text-[12px] text-muted-foreground">
                {items.length} total
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={openCreate}
            activeOpacity={0.85}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text className="text-[12px] font-semibold text-white">New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="pricetag-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No coupons yet.
              </Text>
            </View>
          }
        />
      )}

      {/* Create modal */}
      <Modal
        visible={creating}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setCreating(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card"
            style={{ maxHeight: "90%", paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
              <Text className="text-[17px] font-bold text-foreground">New coupon</Text>
              <TouchableOpacity onPress={() => !submitting && setCreating(false)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="mb-1 ml-1 text-[12px] font-medium text-foreground">
                Code
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="SAVE20"
                placeholderTextColor="#6B7280"
                autoCapitalize="characters"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-2 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Scope
              </Text>
              <View className="flex-row gap-2">
                {(["GLOBAL", "COURSE"] as const).map((s) => {
                  const active = scope === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setScope(s)}
                      activeOpacity={0.85}
                      className="rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: active ? primaryColor : "transparent",
                        backgroundColor: active
                          ? `${primaryColor}1A`
                          : "rgba(120,120,120,0.1)",
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: active ? primaryColor : iconColor }}
                      >
                        {s === "GLOBAL" ? "Global" : "Specific course"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {scope === "COURSE" ? (
                <View className="mt-3">
                  <Text className="mb-1 ml-1 text-[12px] font-medium text-foreground">
                    Course
                  </Text>
                  <View className="max-h-44 rounded-2xl border border-border">
                    <ScrollView nestedScrollEnabled>
                      {courses.length === 0 ? (
                        <Text className="p-3 text-[13px] text-muted-foreground">
                          No courses available.
                        </Text>
                      ) : (
                        courses.map((c) => {
                          const active = selectedCourse?._id === c._id;
                          return (
                            <TouchableOpacity
                              key={c._id}
                              onPress={() => setSelectedCourse(c)}
                              activeOpacity={0.8}
                              className="flex-row items-center justify-between px-3 py-2.5"
                              style={
                                active
                                  ? { backgroundColor: `${primaryColor}14` }
                                  : undefined
                              }
                            >
                              <Text
                                className="flex-1 pr-2 text-[13px] text-foreground"
                                numberOfLines={1}
                              >
                                {c.title}
                              </Text>
                              {active ? (
                                <Ionicons
                                  name="checkmark"
                                  size={16}
                                  color={primaryColor}
                                />
                              ) : null}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                </View>
              ) : null}

              <Text className="mb-1 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Discount %
              </Text>
              <TextInput
                value={discount}
                onChangeText={setDiscount}
                placeholder="1 - 100"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-1 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Usage limit (optional)
              </Text>
              <TextInput
                value={usageLimit}
                onChangeText={setUsageLimit}
                placeholder="Leave empty for unlimited"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-1 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Expiry date (optional, YYYY-MM-DD)
              </Text>
              <TextInput
                value={expiry}
                onChangeText={setExpiry}
                placeholder="2026-12-31"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <TouchableOpacity
                onPress={submitCreate}
                disabled={submitting}
                activeOpacity={0.85}
                className="mt-6 items-center rounded-full py-4"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[15px] font-semibold text-white">
                    Create coupon
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal
        visible={!!editTarget}
        transparent
        animationType="fade"
        onRequestClose={() => !savingEdit && setEditTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-6">
          <View className="w-full rounded-3xl border border-border bg-card p-5">
            <Text className="text-[17px] font-bold text-foreground">Edit coupon</Text>
            <Text className="mt-1 text-[12px] text-muted-foreground">
              {editTarget?.discountPercentage}% off ·{" "}
              {editTarget?.scope === "GLOBAL" ? "Global" : "Course"}
            </Text>

            <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
              Code
            </Text>
            <TextInput
              value={editCode}
              onChangeText={setEditCode}
              autoCapitalize="characters"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
              Usage limit (empty = unlimited)
            </Text>
            <TextInput
              value={editUsage}
              onChangeText={setEditUsage}
              keyboardType="numeric"
              placeholder="Unlimited"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
              Expiry (YYYY-MM-DD, empty = none)
            </Text>
            <TextInput
              value={editExpiry}
              onChangeText={setEditExpiry}
              autoCapitalize="none"
              placeholder="2026-12-31"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => !savingEdit && setEditTarget(null)}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full border border-border py-3"
              >
                <Text className="text-[14px] font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitEdit}
                disabled={savingEdit}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full py-3"
                style={{ backgroundColor: primaryColor }}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[14px] font-semibold text-white">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
