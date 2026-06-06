import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
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

type QuizTopic = {
  id: string;
  subject: string;
  topic: string;
  level: string;
  field?: string | null;
  levelCategory?: string;
  isActive: boolean;
  questionCount: number;
  sessionCount: number;
};

type GenerationStats = {
  totalQuestions: number;
  generatedToday: number;
  recentActivity: {
    id: string;
    adminName: string;
    subject: string;
    topic: string;
    level: string;
    mode: string;
    requestedCount: number;
    createdCount: number;
    createdAt: string;
  }[];
};

type QuizData = { topics: QuizTopic[]; generationStats: GenerationStats };

export default function AdminQuizManagementScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const seed = readCache<QuizData>("quiz-management");
  const [data, setData] = useState<QuizData | null>(seed ?? null);
  const [loading, setLoading] = useState(() => seed === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<null | "STARTER" | "SMART">(null);

  // create topic modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cSubject, setCSubject] = useState("");
  const [cTopic, setCTopic] = useState("");
  const [cLevel, setCLevel] = useState("");
  const [cField, setCField] = useState("");
  const [creating, setCreating] = useState(false);

  // smart seed modal
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState("");
  const [smartCount, setSmartCount] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/quiz-management");
      setData(res.data as QuizData);
      writeCache("quiz-management", res.data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load quiz topics",
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

  const stats = data?.generationStats;
  const topics = useMemo(() => data?.topics ?? [], [data]);

  const toggleActive = useCallback(
    async (topic: QuizTopic) => {
      setBusyId(topic.id);
      try {
        await api.patch(`/mobile/admin/quiz-management/${topic.id}`, {
          isActive: !topic.isActive,
        });
        await load();
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Update failed",
          text2: getRequestErrorMessage(err, "Please try again."),
          position: "bottom",
        });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const deleteTopic = useCallback(
    (topic: QuizTopic) => {
      Alert.alert(
        "Delete topic?",
        `"${topic.subject} · ${topic.topic}" will be removed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setBusyId(topic.id);
              try {
                await api.delete(`/mobile/admin/quiz-management/${topic.id}`);
                Toast.show({ type: "success", text1: "Deleted", position: "bottom" });
                await load();
              } catch (err) {
                Toast.show({
                  type: "error",
                  text1: "Delete failed",
                  text2: getRequestErrorMessage(err, "Deactivate it instead."),
                  position: "bottom",
                });
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [load],
  );

  const generateForTopic = useCallback(
    async (topic: QuizTopic) => {
      setBusyId(topic.id);
      try {
        await api.post("/mobile/admin/quiz-management", {
          mode: "TOPIC_SEED",
          topicId: topic.id,
        });
        Toast.show({ type: "success", text1: "Questions generated", position: "bottom" });
        await load();
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Generation failed",
          text2: getRequestErrorMessage(err, "Please try again."),
          position: "bottom",
        });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const runStarter = useCallback(async () => {
    setSeeding("STARTER");
    try {
      await api.post("/mobile/admin/quiz-management", { mode: "STARTER" });
      Toast.show({ type: "success", text1: "Starter set seeded", position: "bottom" });
      await load();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Seed failed",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSeeding(null);
    }
  }, [load]);

  const runSmart = useCallback(async () => {
    if (!smartPrompt.trim()) {
      Toast.show({ type: "error", text1: "Enter a prompt", position: "bottom" });
      return;
    }
    setSeeding("SMART");
    try {
      await api.post("/mobile/admin/quiz-management", {
        mode: "SMART",
        prompt: smartPrompt.trim(),
        count: Number(smartCount) || undefined,
      });
      Toast.show({ type: "success", text1: "Smart seed complete", position: "bottom" });
      setSmartOpen(false);
      setSmartPrompt("");
      setSmartCount("");
      await load();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Smart seed failed",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSeeding(null);
    }
  }, [smartPrompt, smartCount, load]);

  const createTopic = useCallback(async () => {
    if (!cSubject.trim() || !cTopic.trim() || !cLevel.trim()) {
      Toast.show({
        type: "error",
        text1: "Subject, topic and level required",
        position: "bottom",
      });
      return;
    }
    setCreating(true);
    try {
      await api.post("/mobile/admin/quiz-management", {
        subject: cSubject.trim(),
        topic: cTopic.trim(),
        level: cLevel.trim(),
        field: cField.trim() || null,
      });
      Toast.show({ type: "success", text1: "Topic created", position: "bottom" });
      setCreateOpen(false);
      setCSubject("");
      setCTopic("");
      setCLevel("");
      setCField("");
      await load();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Create failed",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setCreating(false);
    }
  }, [cSubject, cTopic, cLevel, cField, load]);

  const renderItem = useCallback(
    ({ item }: { item: QuizTopic }) => {
      const busy = busyId === item.id;
      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {item.topic}
              </Text>
              <Text className="text-[12px] text-muted-foreground">
                {item.subject} · {item.level}
                {item.field ? ` · ${item.field}` : ""}
              </Text>
            </View>
            <Switch
              value={item.isActive}
              disabled={busy}
              onValueChange={() => toggleActive(item)}
              trackColor={{ true: primaryColor }}
            />
          </View>

          <View className="mt-2 flex-row items-center gap-4">
            <Text className="text-[12px] text-muted-foreground">
              {item.questionCount} questions
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {item.sessionCount} sessions
            </Text>
          </View>

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={() => generateForTopic(item)}
              disabled={busy}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
              style={{ backgroundColor: `${primaryColor}1A` }}
            >
              {busy ? (
                <ActivityIndicator color={primaryColor} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={15} color={primaryColor} />
                  <Text
                    className="text-[12px] font-semibold"
                    style={{ color: primaryColor }}
                  >
                    Generate
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteTopic(item)}
              disabled={busy}
              activeOpacity={0.85}
              className="flex-row items-center justify-center gap-1.5 rounded-full px-4 py-2.5"
              style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [busyId, primaryColor, toggleActive, generateForTopic, deleteTopic],
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
                Quiz Management
              </Text>
              <Text className="text-[12px] text-muted-foreground">
                {topics.length} topics
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: primaryColor }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(item) => item.id}
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
          ListHeaderComponent={
            <View className="mb-4">
              {/* Stats + seed actions */}
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-[22px] font-bold text-foreground">
                    {stats?.totalQuestions ?? 0}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Total questions
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl border border-border bg-card p-4">
                  <Text className="text-[22px] font-bold text-foreground">
                    {stats?.generatedToday ?? 0}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Generated today
                  </Text>
                </View>
              </View>

              <View className="mt-3 flex-row gap-2">
                <TouchableOpacity
                  onPress={runStarter}
                  disabled={seeding !== null}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-3"
                >
                  {seeding === "STARTER" ? (
                    <ActivityIndicator color={primaryColor} />
                  ) : (
                    <>
                      <Ionicons name="rocket-outline" size={16} color={iconColor} />
                      <Text className="text-[13px] font-semibold text-foreground">
                        Starter seed
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSmartOpen(true)}
                  disabled={seeding !== null}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-3"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Ionicons name="sparkles-outline" size={16} color="#fff" />
                  <Text className="text-[13px] font-semibold text-white">Smart seed</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="school-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No quiz topics yet.
              </Text>
            </View>
          }
        />
      )}

      {/* Create topic modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card p-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-foreground">New topic</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={cSubject}
              onChangeText={setCSubject}
              placeholder="Subject (e.g. Physics)"
              placeholderTextColor="#6B7280"
              className="mb-2 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TextInput
              value={cTopic}
              onChangeText={setCTopic}
              placeholder="Topic (e.g. Kinematics)"
              placeholderTextColor="#6B7280"
              className="mb-2 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TextInput
              value={cLevel}
              onChangeText={setCLevel}
              placeholder="Level (e.g. Grade 11)"
              placeholderTextColor="#6B7280"
              className="mb-2 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TextInput
              value={cField}
              onChangeText={setCField}
              placeholder="Field (optional)"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TouchableOpacity
              onPress={createTopic}
              disabled={creating}
              activeOpacity={0.85}
              className="mt-4 items-center rounded-full py-3.5"
              style={{ backgroundColor: primaryColor }}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[14px] font-semibold text-white">Create topic</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Smart seed modal */}
      <Modal
        visible={smartOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSmartOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card p-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-foreground">Smart seed</Text>
              <TouchableOpacity onPress={() => setSmartOpen(false)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>
            <Text className="mb-3 text-[12px] text-muted-foreground">
              Describe what to generate. The AI will create matching topics and questions.
            </Text>
            <TextInput
              value={smartPrompt}
              onChangeText={setSmartPrompt}
              placeholder="e.g. Grade 12 organic chemistry reactions"
              placeholderTextColor="#6B7280"
              multiline
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <TextInput
              value={smartCount}
              onChangeText={setSmartCount}
              placeholder="Questions per topic (optional)"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="mt-2 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TouchableOpacity
              onPress={runSmart}
              disabled={seeding === "SMART"}
              activeOpacity={0.85}
              className="mt-4 items-center rounded-full py-3.5"
              style={{ backgroundColor: primaryColor }}
            >
              {seeding === "SMART" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[14px] font-semibold text-white">Generate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
