import { useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  addMyQuestion,
  markOptimistic,
  normalizeFeedQuestion,
  prependQuestion,
  removeQuestion,
  unmarkOptimistic,
} from "@/store/slices/feedSlice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { api } from "@/lib/api";
import {
  buildAnswerFormatFromSelection,
  toggleSelectableAnswerFormat,
  type SelectableAnswerFormat,
} from "@/lib/question-format";

type Visibility = "PUBLIC" | "PRIVATE";
type IoniconName = ComponentProps<typeof Ionicons>["name"];

type PendingImage = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

const FORMAT_OPTIONS: {
  value: SelectableAnswerFormat;
  label: string;
  icon: IoniconName;
  description: string;
}[] = [
  {
    value: "ANY",
    label: "Any",
    icon: "sparkles-outline",
    description: "Let the answerer choose",
  },
  {
    value: "TEXT",
    label: "Text",
    icon: "text-outline",
    description: "Written explanation",
  },
  {
    value: "PHOTO",
    label: "Photo",
    icon: "image-outline",
    description: "Photo-based answer",
  },
  {
    value: "VIDEO",
    label: "Video",
    icon: "videocam-outline",
    description: "Video walkthrough",
  },
];

const MAX_IMAGES = 4;
const TITLE_MIN = 6;
const TITLE_MAX = 180;
const BODY_MAX = 5000;

export default function AskScreen() {
  const user = useAppSelector((s) => s.user.data);
  const isTeacher = user?.role === "TEACHER";

  if (isTeacher) return <TeacherActionsScreen />;
  return <StudentAskScreen />;
}

function StudentAskScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const { options: filterOptions } = useFilterOptions();
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    mutedIconColor,
    primaryColor,
    primarySoftColor,
  } = useAppTheme();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<SelectableAnswerFormat[]>([
    "ANY",
  ]);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [subject, setSubject] = useState<string>("");
  const [stream, setStream] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const effectiveLimit = (user?.maxQuestions ?? 0) + (user?.bonusQuestions ?? 0);
  const quotaUsed = user?.questionsAsked ?? 0;
  const quotaLeft = Math.max(0, effectiveLimit - quotaUsed);
  const quotaExhausted = quotaLeft <= 0;

  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;
  const isTitleValid = titleLen >= TITLE_MIN && titleLen <= TITLE_MAX;
  const canSubmit = isTitleValid && !isPosting && !quotaExhausted;

  function toggleFormat(next: SelectableAnswerFormat) {
    setSelectedFormats((prev) => toggleSelectableAnswerFormat(prev, next));
  }

  async function pickFromGallery() {
    if (pendingImages.length >= MAX_IMAGES) {
      Toast.show({ type: "info", text1: `You can attach up to ${MAX_IMAGES} images.` });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Photo library permission is required to attach images.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - pendingImages.length,
      quality: 0.85,
    });

    if (result.canceled) return;
    addAssets(result.assets);
  }

  async function captureFromCamera() {
    if (pendingImages.length >= MAX_IMAGES) {
      Toast.show({ type: "info", text1: `You can attach up to ${MAX_IMAGES} images.` });
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Camera permission is required to capture a photo.",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled) return;
    addAssets(result.assets);
  }

  function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setPendingImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      const next = assets.slice(0, remaining).map<PendingImage>((asset) => ({
        id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
        uri: asset.uri,
        fileName: asset.fileName ?? `question-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      }));
      return [...prev, ...next];
    });
  }

  function removeImage(id: string) {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function uploadPendingImages(): Promise<string[]> {
    if (pendingImages.length === 0) return [];

    const uploaded: string[] = [];
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      setUploadStatus(`Uploading image ${i + 1} of ${pendingImages.length}…`);

      const form = new FormData();
      form.append("file", {
        uri: img.uri,
        name: img.fileName,
        type: img.mimeType,
      } as unknown as Blob);

      const res = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });

      const url = res.data?.secure_url ?? res.data?.url;
      if (typeof url === "string" && url) uploaded.push(url);
    }

    setUploadStatus(null);
    return uploaded;
  }

  async function handlePost() {
    if (!isTitleValid) {
      Toast.show({
        type: "error",
        text1: `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`,
      });
      return;
    }

    setIsPosting(true);
    const tempId = `temp_${Date.now()}`;
    const now = new Date().toISOString();
    const answerFormat = buildAnswerFormatFromSelection(selectedFormats);

    const optimistic = normalizeFeedQuestion({
      id: tempId,
      title: title.trim(),
      body: body.trim(),
      answerFormat,
      answerVisibility: visibility,
      subject: subject || undefined,
      stream: stream || undefined,
      level: level || undefined,
      status: "OPEN",
      resetCount: 0,
      askerId: user?._id ?? "",
      askerName: user?.name ?? "You",
      askerUsername: user?.username,
      askerImage: user?.image,
      images: pendingImages.map((img) => img.uri),
      reactions: [],
      answerCount: 0,
      reactionCount: 0,
      commentCount: 0,
      channelId: null,
      acceptedById: null,
      acceptedAt: null,
      acceptedByName: null,
      createdAt: now,
      updatedAt: now,
    });
    dispatch(prependQuestion(optimistic));
    dispatch(addMyQuestion(optimistic));
    dispatch(markOptimistic(tempId));

    try {
      const imageUrls = await uploadPendingImages();

      const res = await api.post("/questions", {
        title: title.trim(),
        body: body.trim() || undefined,
        answerFormat,
        answerVisibility: visibility,
        subject: subject || undefined,
        stream: stream || undefined,
        level: level || undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });

      const created = normalizeFeedQuestion(res.data);
      dispatch(unmarkOptimistic(tempId));
      dispatch(removeQuestion(tempId));
      dispatch(prependQuestion(created));
      dispatch(addMyQuestion(created));

      // Reset
      setTitle("");
      setBody("");
      setSelectedFormats(["ANY"]);
      setVisibility("PUBLIC");
      setSubject("");
      setStream("");
      setLevel("");
      setPendingImages([]);
      Toast.show({ type: "success", text1: "Question posted." });
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      dispatch(unmarkOptimistic(tempId));
      dispatch(removeQuestion(tempId));
      const status = err?.response?.status;
      const apiMessage = err?.response?.data?.error ?? err?.response?.data?.message;
      const message =
        status === 401 && pendingImages.length > 0
          ? "Image upload isn't enabled for the mobile app yet. Try posting without images."
          : (apiMessage ?? "Failed to post question.");
      Toast.show({ type: "error", text1: message });
    } finally {
      setIsPosting(false);
      setUploadStatus(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Sticky Header */}
      <View
        className="flex-row items-center justify-between px-5 pb-3 pt-14"
        style={{ borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor }}
      >
        <View className="flex-1">
          <Text className="text-[22px] font-bold tracking-tight text-foreground">
            Ask a question
          </Text>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Ionicons
              name={quotaExhausted ? "alert-circle" : "flash-outline"}
              size={13}
              color={quotaExhausted ? "#ef4444" : primaryColor}
            />
            <Text
              className="text-[12px] font-medium"
              style={{ color: quotaExhausted ? "#ef4444" : primaryColor }}
            >
              {quotaExhausted
                ? "Quota used"
                : `${quotaLeft} of ${effectiveLimit} questions left`}
            </Text>
          </View>
        </View>
        {quotaExhausted ? (
          <TouchableOpacity
            onPress={() => router.push("/payment/plans" as any)}
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: primaryColor }}
            activeOpacity={0.85}
          >
            <Text className="text-xs font-semibold text-white">Upgrade</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 px-5 pt-5">
          {/* Title */}
          <Field
            label="Question title"
            required
            counter={`${titleLen}/${TITLE_MAX}`}
            counterTone={titleLen === 0 ? "muted" : isTitleValid ? "success" : "warn"}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What's your doubt? Keep it short and clear."
              placeholderTextColor={mutedIconColor}
              maxLength={TITLE_MAX}
              multiline
              editable={!quotaExhausted}
              className="text-[16px] leading-6 text-card-foreground"
              style={{ minHeight: 56, textAlignVertical: "top" }}
            />
          </Field>

          {/* Body */}
          <Field
            label="Add details"
            optional
            counter={`${bodyLen}/${BODY_MAX}`}
            counterTone="muted"
          >
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Provide context, what you've tried, or where you're stuck."
              placeholderTextColor={mutedIconColor}
              maxLength={BODY_MAX}
              multiline
              editable={!quotaExhausted}
              className="text-[15px] leading-6 text-card-foreground"
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
          </Field>

          {/* Image attachments */}
          <View>
            <View className="mb-2 flex-row items-end justify-between">
              <View>
                <Text className="text-[13px] font-semibold text-foreground">
                  Attach photos
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  Up to {MAX_IMAGES} images. Capture or pick from gallery.
                </Text>
              </View>
              <Text className="text-[11px] font-medium text-muted-foreground">
                {pendingImages.length}/{MAX_IMAGES}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              <AttachButton
                icon="camera-outline"
                label="Camera"
                onPress={captureFromCamera}
                disabled={pendingImages.length >= MAX_IMAGES || quotaExhausted}
                primaryColor={primaryColor}
                primarySoftColor={primarySoftColor}
                borderColor={borderColor}
              />
              <AttachButton
                icon="images-outline"
                label="Gallery"
                onPress={pickFromGallery}
                disabled={pendingImages.length >= MAX_IMAGES || quotaExhausted}
                primaryColor={primaryColor}
                primarySoftColor={primarySoftColor}
                borderColor={borderColor}
              />

              {pendingImages.map((img) => (
                <View
                  key={img.id}
                  className="overflow-hidden rounded-2xl border"
                  style={{ width: 92, height: 92, borderColor }}
                >
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 92, height: 92 }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => removeImage(img.id)}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Answer format (multi-select, mirrors web) */}
          <View>
            <Text className="mb-2 text-[13px] font-semibold text-foreground">
              Preferred answer format
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const active = selectedFormats.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleFormat(opt.value)}
                    activeOpacity={0.85}
                    disabled={quotaExhausted}
                    className="flex-row items-center gap-1.5 rounded-full border px-3 py-2"
                    style={{
                      borderColor: active ? primaryColor : borderColor,
                      backgroundColor: active ? primarySoftColor : cardColor,
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={active ? primaryColor : mutedIconColor}
                    />
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: active ? primaryColor : mutedIconColor }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Visibility */}
          <View>
            <Text className="mb-2 text-[13px] font-semibold text-foreground">
              Who can see the answer
            </Text>
            <View className="flex-row gap-2">
              <VisibilityButton
                label="Public"
                description="Anyone in the feed"
                icon="globe-outline"
                active={visibility === "PUBLIC"}
                onPress={() => setVisibility("PUBLIC")}
                primaryColor={primaryColor}
                primarySoftColor={primarySoftColor}
                borderColor={borderColor}
                cardColor={cardColor}
                mutedIconColor={mutedIconColor}
              />
              <VisibilityButton
                label="Private"
                description="Only you & teacher"
                icon="lock-closed-outline"
                active={visibility === "PRIVATE"}
                onPress={() => setVisibility("PRIVATE")}
                primaryColor={primaryColor}
                primarySoftColor={primarySoftColor}
                borderColor={borderColor}
                cardColor={cardColor}
                mutedIconColor={mutedIconColor}
              />
            </View>
          </View>

          {/* Subject / Stream / Level */}
          <ChipGroup
            label="Subject (optional)"
            options={filterOptions.subjects}
            value={subject}
            onChange={setSubject}
            primaryColor={primaryColor}
            primarySoftColor={primarySoftColor}
            borderColor={borderColor}
            cardColor={cardColor}
            mutedIconColor={mutedIconColor}
          />
          <ChipGroup
            label="Stream"
            options={filterOptions.streams}
            value={stream}
            onChange={setStream}
            primaryColor={primaryColor}
            primarySoftColor={primarySoftColor}
            borderColor={borderColor}
            cardColor={cardColor}
            mutedIconColor={mutedIconColor}
          />
          <ChipGroup
            label="Level"
            options={filterOptions.levels}
            value={level}
            onChange={setLevel}
            primaryColor={primaryColor}
            primarySoftColor={primarySoftColor}
            borderColor={borderColor}
            cardColor={cardColor}
            mutedIconColor={mutedIconColor}
          />

          {uploadStatus ? (
            <View
              className="flex-row items-center gap-2 rounded-2xl border px-4 py-3"
              style={{ borderColor, backgroundColor: cardColor }}
            >
              <ActivityIndicator color={primaryColor} />
              <Text className="text-[13px] text-foreground">{uploadStatus}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky Submit Footer */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor,
          borderTopWidth: 1,
          borderTopColor: borderColor,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 28 : 16,
        }}
      >
        {quotaExhausted ? (
          <TouchableOpacity
            onPress={() => router.push("/payment/plans" as any)}
            className="items-center justify-center rounded-2xl"
            style={{ backgroundColor: primaryColor, height: 52 }}
            activeOpacity={0.85}
          >
            <Text className="text-base font-bold text-white">
              Upgrade plan to ask more
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handlePost}
            disabled={!canSubmit}
            className="items-center justify-center rounded-2xl"
            style={{
              backgroundColor: canSubmit ? primaryColor : `${primaryColor}55`,
              height: 52,
            }}
            activeOpacity={0.85}
          >
            {isPosting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Post question</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function Field({
  label,
  required,
  optional,
  counter,
  counterTone,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  counter?: string;
  counterTone?: "muted" | "success" | "warn";
  children: React.ReactNode;
}) {
  const { borderColor, cardColor } = useAppTheme();
  const counterColor =
    counterTone === "success"
      ? "#10b981"
      : counterTone === "warn"
        ? "#f59e0b"
        : undefined;

  return (
    <View>
      <View className="mb-2 flex-row items-end justify-between">
        <Text className="text-[13px] font-semibold text-foreground">
          {label}
          {required ? <Text style={{ color: "#ef4444" }}> *</Text> : null}
          {optional ? (
            <Text className="text-[11px] font-normal text-muted-foreground">
              {"  "}optional
            </Text>
          ) : null}
        </Text>
        {counter ? (
          <Text
            className="text-[11px] font-medium"
            style={counterColor ? { color: counterColor } : undefined}
          >
            {counter}
          </Text>
        ) : null}
      </View>
      <View
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor, backgroundColor: cardColor }}
      >
        {children}
      </View>
    </View>
  );
}

function AttachButton({
  icon,
  label,
  onPress,
  disabled,
  primaryColor,
  primarySoftColor,
  borderColor,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
  primaryColor: string;
  primarySoftColor: string;
  borderColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={{
        width: 92,
        height: 92,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: disabled ? borderColor : `${primaryColor}55`,
        borderStyle: "dashed",
        backgroundColor: primarySoftColor,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={22} color={primaryColor} />
      <Text className="text-[11px] font-semibold" style={{ color: primaryColor }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function VisibilityButton({
  label,
  description,
  icon,
  active,
  onPress,
  primaryColor,
  primarySoftColor,
  borderColor,
  cardColor,
  mutedIconColor,
}: {
  label: string;
  description: string;
  icon: IoniconName;
  active: boolean;
  onPress: () => void;
  primaryColor: string;
  primarySoftColor: string;
  borderColor: string;
  cardColor: string;
  mutedIconColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 rounded-2xl border px-3 py-3"
      style={{
        borderColor: active ? primaryColor : borderColor,
        backgroundColor: active ? primarySoftColor : cardColor,
      }}
    >
      <View className="mb-1 flex-row items-center gap-1.5">
        <Ionicons name={icon} size={15} color={active ? primaryColor : mutedIconColor} />
        <Text
          className="text-[13px] font-semibold"
          style={{ color: active ? primaryColor : mutedIconColor }}
        >
          {label}
        </Text>
      </View>
      <Text className="text-[11px] text-muted-foreground">{description}</Text>
    </TouchableOpacity>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  primaryColor,
  primarySoftColor,
  borderColor,
  cardColor,
  mutedIconColor,
}: {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (next: string) => void;
  primaryColor: string;
  primarySoftColor: string;
  borderColor: string;
  cardColor: string;
  mutedIconColor: string;
}) {
  return (
    <View>
      <Text className="mb-2 text-[13px] font-semibold text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(active ? "" : opt)}
              activeOpacity={0.85}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor: active ? primaryColor : borderColor,
                backgroundColor: active ? primarySoftColor : cardColor,
              }}
            >
              <Text
                className="text-[12px] font-medium"
                style={{ color: active ? primaryColor : mutedIconColor }}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Teacher Actions ───────────────────────────────────────────────────

function TeacherActionsScreen() {
  const { statusBarStyle, backgroundColor } = useAppTheme();

  return (
    <View className="flex-1 bg-background px-6 pt-14">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <Text className="mb-1 text-[28px] font-bold tracking-tight text-foreground">
        Actions
      </Text>
      <Text className="mb-8 text-sm leading-6 text-muted-foreground">
        Quick teacher actions
      </Text>

      <View className="gap-3">
        <ActionCard
          iconName="list-outline"
          title="View Question Feed"
          subtitle="See all open questions"
          onPress={() => router.push("/(tabs)/feed" as any)}
        />
        <ActionCard
          iconName="book-outline"
          title="Course Studio"
          subtitle="Manage your courses"
          onPress={() => router.push("/studio" as any)}
        />
        <ActionCard
          iconName="trophy-outline"
          title="Leaderboard"
          subtitle="See top rated teachers"
          onPress={() => router.push("/leaderboard" as any)}
        />
      </View>
    </View>
  );
}

function ActionCard({
  iconName,
  title,
  subtitle,
  onPress,
}: {
  iconName: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { primaryColor, primarySoftColor, mutedIconColor } = useAppTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-border bg-card p-4"
      activeOpacity={0.8}
    >
      <View
        className="mr-4 h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: primarySoftColor }}
      >
        <Ionicons name={iconName} size={22} color={primaryColor} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-card-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={mutedIconColor} />
    </TouchableOpacity>
  );
}
