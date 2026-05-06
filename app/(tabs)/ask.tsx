import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { addMyQuestion } from "@/store/slices/feedSlice";
import api from "@/lib/api";

type AnswerFormat = "TEXT" | "PHOTO" | "VIDEO" | "ANY";
type Visibility = "PUBLIC" | "PRIVATE";

const FORMAT_OPTIONS: AnswerFormat[] = ["TEXT", "PHOTO", "VIDEO", "ANY"];
const VISIBILITY_OPTIONS: Visibility[] = ["PUBLIC", "PRIVATE"];

export default function AskScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const isTeacher = user?.role === "TEACHER";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<AnswerFormat>("ANY");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  if (isTeacher) {
    return <TeacherActionsScreen />;
  }

  const effectiveLimit = (user?.maxQuestions ?? 0) + (user?.bonusQuestions ?? 0);
  const quotaUsed = user?.questionsAsked ?? 0;
  const quotaLeft = effectiveLimit - quotaUsed;
  const quotaExhausted = quotaLeft <= 0;

  async function handlePost() {
    if (title.trim().length < 6) {
      Toast.show({ type: "error", text1: "Title must be at least 6 characters" });
      return;
    }
    if (title.trim().length > 180) {
      Toast.show({ type: "error", text1: "Title cannot exceed 180 characters" });
      return;
    }

    setLoading(true);
    // Optimistic: add to feed immediately
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      title: title.trim(),
      body: body.trim(),
      answerFormat: format,
      answerVisibility: visibility,
      subject,
      status: "OPEN" as const,
      resetCount: 0,
      askerId: user?._id ?? "",
      createdAt: new Date().toISOString(),
    };
    dispatch(addMyQuestion(optimistic));

    try {
      await api.post("/questions", {
        title: title.trim(),
        body: body.trim() || undefined,
        answerFormat: format,
        answerVisibility: visibility,
        subject: subject || undefined,
      });

      setTitle("");
      setBody("");
      Toast.show({ type: "success", text1: "Question posted!" });
      router.push("/(tabs)/feed");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to post question";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-4 pt-14 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-white text-2xl font-bold">Ask a Question</Text>
            <Text className="text-slate-400 text-sm mt-0.5">
              Quota: {Math.max(0, quotaLeft)} / {effectiveLimit} remaining
            </Text>
          </View>
          {quotaExhausted ? (
            <TouchableOpacity
              onPress={() => router.push("/payment/plans" as any)}
              className="bg-blue-500 rounded-xl px-4 py-2"
            >
              <Text className="text-white text-xs font-semibold">Upgrade</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {quotaExhausted ? (
          <View className="mx-4 bg-orange-950 border border-orange-800 rounded-2xl p-4 mb-4">
            <Text className="text-orange-300 text-sm text-center">
              You{"'"}ve used all your questions for this plan.{"\n"}Upgrade to ask
              more!
            </Text>
          </View>
        ) : null}

        <View className="px-4 gap-4">
          {/* Title */}
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Question Title *{" "}
              <Text className="text-slate-600">
                ({title.trim().length}/180)
              </Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What's your question?"
              placeholderTextColor="#475569"
              multiline
              maxLength={180}
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-base"
              style={{ minHeight: 60, textAlignVertical: "top" }}
              editable={!quotaExhausted}
            />
          </View>

          {/* Body */}
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Details{" "}
              <Text className="text-slate-600">(optional, {body.length}/5000)</Text>
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Provide more context..."
              placeholderTextColor="#475569"
              multiline
              maxLength={5000}
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-base"
              style={{ minHeight: 100, textAlignVertical: "top" }}
              editable={!quotaExhausted}
            />
          </View>

          {/* Answer Format */}
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Answer Format
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFormat(f)}
                  className={`px-4 py-2 rounded-xl ${
                    format === f
                      ? "bg-blue-500"
                      : "bg-slate-900 border border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      format === f ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Visibility */}
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Visibility
            </Text>
            <View className="flex-row gap-2">
              {VISIBILITY_OPTIONS.map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setVisibility(v)}
                  className={`px-4 py-2 rounded-xl ${
                    visibility === v
                      ? "bg-blue-500"
                      : "bg-slate-900 border border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      visibility === v ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {v === "PUBLIC" ? "🌐 Public" : "🔒 Private"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject */}
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Subject <Text className="text-slate-600">(optional)</Text>
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Mathematics, Physics..."
              placeholderTextColor="#475569"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          {/* Submit */}
          {quotaExhausted ? (
            <TouchableOpacity
              onPress={() => router.push("/payment/plans" as any)}
              className="bg-blue-500 rounded-2xl py-4 items-center mt-2 mb-8"
            >
              <Text className="text-white text-lg font-semibold">
                Upgrade Plan to Ask More
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handlePost}
              disabled={loading || title.trim().length < 6}
              className={`rounded-2xl py-4 items-center mt-2 mb-8 ${
                loading || title.trim().length < 6
                  ? "bg-slate-700"
                  : "bg-blue-500"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  Post Question
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TeacherActionsScreen() {
  return (
    <View className="flex-1 bg-slate-950 px-4 pt-14">
      <Text className="text-white text-2xl font-bold mb-1">Actions</Text>
      <Text className="text-slate-400 text-sm mb-8">Quick teacher actions</Text>

      <View className="gap-3">
        <ActionCard
          emoji="📋"
          title="View Question Feed"
          subtitle="See all open questions"
          onPress={() => router.push("/(tabs)/feed" as any)}
        />
        <ActionCard
          emoji="📚"
          title="Course Studio"
          subtitle="Manage your courses"
          onPress={() => router.push("/studio" as any)}
        />
        <ActionCard
          emoji="🏆"
          title="Leaderboard"
          subtitle="See top rated teachers"
          onPress={() => router.push("/leaderboard" as any)}
        />
      </View>
    </View>
  );
}

function ActionCard({
  emoji,
  title,
  subtitle,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-slate-900 rounded-2xl p-4 border border-slate-800"
      activeOpacity={0.8}
    >
      <Text className="text-3xl mr-4">{emoji}</Text>
      <View className="flex-1">
        <Text className="text-white font-semibold text-base">{title}</Text>
        <Text className="text-slate-400 text-sm">{subtitle}</Text>
      </View>
      <Text className="text-slate-500 text-lg">›</Text>
    </TouchableOpacity>
  );
}
