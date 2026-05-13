import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type PricingModel = "FREE" | "SUBSCRIPTION_INCLUDED" | "PAID";

const STEPS = [
  { id: 1, title: "Pricing", icon: "card-outline" as const },
  { id: 2, title: "Details", icon: "document-text-outline" as const },
  { id: 3, title: "Media", icon: "image-outline" as const },
  { id: 4, title: "Schedule", icon: "calendar-outline" as const },
  { id: 5, title: "Review", icon: "checkmark-circle-outline" as const },
];

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Nepali",
  "Computer Science",
  "History",
  "Geography",
  "Economics",
  "Accountancy",
  "Business Studies",
  "Information Technology",
  "Data Science",
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Statistics",
  "Management",
  "Finance",
  "Others",
];

const LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Undergraduate",
  "Graduate",
  "Professional",
];

export default function CreateCourseScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);

  // Form state
  const [pricingModel, setPricingModel] = useState<PricingModel>("FREE");
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");

  const canProceed = () => {
    if (step === 1) return pricingModel !== "PAID" || Number(price) > 0;
    if (step === 2)
      return (
        title.trim().length > 0 &&
        description.trim().length > 0 &&
        subject.length > 0 &&
        level.length > 0
      );
    if (step === 3) return !isUploadingThumb;
    return true;
  };

  const handlePickThumbnail = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow access to your photo library to pick a thumbnail.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setThumbnailUri(asset.uri);
    setThumbnailUrl(null);
    setIsUploadingThumb(true);

    try {
      const formData = new FormData();
      const filename = asset.uri.split("/").pop() ?? "thumbnail.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      formData.append("file", { uri: asset.uri, name: filename, type: mime } as any);

      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      setThumbnailUrl(res.data.secure_url);
      Toast.show({ type: "success", text1: "Thumbnail uploaded" });
    } catch {
      setThumbnailUri(null);
      setThumbnailUrl(null);
      Toast.show({ type: "error", text1: "Thumbnail upload failed" });
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleCreate = async () => {
    if (isUploadingThumb) {
      Toast.show({ type: "error", text1: "Wait for thumbnail to finish uploading" });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await api.post("/courses", {
        title: title.trim(),
        description: description.trim(),
        subject,
        level,
        pricingModel,
        price: pricingModel === "PAID" ? Number(price) : null,
        thumbnailUrl: thumbnailUrl ?? null,
        startDate: startDate.trim() || null,
        expectedEndDate: expectedEndDate.trim() || null,
        status: "DRAFT",
      });
      const created = res.data;
      Toast.show({
        type: "success",
        text1: "Course created!",
        text2: "It's saved as a draft.",
      });
      router.replace({
        pathname: "/studio/[courseId]" as any,
        params: { courseId: created._id },
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to create course",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const goNext = () => {
    if (step < 5) setStep(step + 1);
    else void handleCreate();
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          How should students access your course?
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: mutedIconColor,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          Choose the pricing model
        </Text>
      </View>

      {(
        [
          {
            key: "FREE" as const,
            label: "Free",
            desc: "Anyone can enroll",
            icon: "book-outline" as const,
            accent: "#10b981",
            note: "No revenue",
          },
          {
            key: "SUBSCRIPTION_INCLUDED" as const,
            label: "Subscription",
            desc: "For active subscribers",
            icon: "checkmark-circle-outline" as const,
            accent: "#3b82f6",
            note: "In subscription",
          },
          {
            key: "PAID" as const,
            label: "Paid",
            desc: "One-time purchase",
            icon: "cash-outline" as const,
            accent: "#f59e0b",
            note: "You get 80%",
          },
        ] as const
      ).map((opt) => {
        const selected = pricingModel === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setPricingModel(opt.key)}
            activeOpacity={0.8}
            style={{
              borderWidth: 2,
              borderColor: selected ? opt.accent : borderColor,
              borderRadius: 16,
              padding: 16,
              backgroundColor: selected ? `${opt.accent}10` : cardColor,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: `${opt.accent}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={opt.icon} size={22} color={opt.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                  }}
                >
                  {opt.label}
                </Text>
                <Text style={{ fontSize: 13, color: mutedIconColor, marginTop: 2 }}>
                  {opt.desc}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${opt.accent}18`,
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: opt.accent }}>
                  {opt.note}
                </Text>
              </View>
            </View>

            {opt.key === "PAID" && selected ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 12, color: mutedIconColor, marginBottom: 6 }}>
                  Price (NPR)
                </Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="e.g. 999"
                  placeholderTextColor={mutedIconColor}
                  style={{
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    backgroundColor: isDark ? "#1e293b" : "#fff",
                  }}
                />
                {Number(price) > 0 ? (
                  <Text style={{ fontSize: 12, color: mutedIconColor, marginTop: 6 }}>
                    You receive: NPR {Math.round(Number(price) * 0.8).toLocaleString()}{" "}
                    per sale (80%)
                  </Text>
                ) : null}
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Course Details
        </Text>
        <Text style={{ fontSize: 14, color: mutedIconColor, marginTop: 4 }}>
          Tell students what they&apos;ll learn
        </Text>
      </View>

      <View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: isDark ? "#cbd5e1" : "#475569",
            marginBottom: 6,
          }}
        >
          Course Title *
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Complete Mathematics for Grade 10"
          placeholderTextColor={mutedIconColor}
          style={{
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: isDark ? "#f1f5f9" : "#0f172a",
            backgroundColor: cardColor,
          }}
        />
      </View>

      <View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: isDark ? "#cbd5e1" : "#475569",
            marginBottom: 6,
          }}
        >
          Description *
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What will students learn in this course?"
          placeholderTextColor={mutedIconColor}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: isDark ? "#f1f5f9" : "#0f172a",
            minHeight: 100,
            backgroundColor: cardColor,
          }}
        />
      </View>

      <View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: isDark ? "#cbd5e1" : "#475569",
            marginBottom: 8,
          }}
        >
          Subject *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {SUBJECTS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSubject(s)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: subject === s ? primaryColor : borderColor,
                  backgroundColor: subject === s ? primaryColor : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: subject === s ? "#fff" : mutedIconColor,
                  }}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: isDark ? "#cbd5e1" : "#475569",
            marginBottom: 8,
          }}
        >
          Level *
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLevel(l)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: level === l ? primaryColor : borderColor,
                backgroundColor: level === l ? primaryColor : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: level === l ? "#fff" : mutedIconColor,
                }}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Course Media
        </Text>
        <Text style={{ fontSize: 14, color: mutedIconColor, marginTop: 4 }}>
          Add a thumbnail (optional)
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => void handlePickThumbnail()}
        disabled={isUploadingThumb}
        activeOpacity={0.8}
        style={{
          aspectRatio: 16 / 9,
          borderWidth: 2,
          borderStyle: thumbnailUri ? "solid" : "dashed",
          borderColor: thumbnailUri ? primaryColor : borderColor,
          borderRadius: 16,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cardColor,
        }}
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: primarySoftColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="image-outline" size={28} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 14, color: mutedIconColor }}>
              Tap to pick from gallery
            </Text>
            <Text style={{ fontSize: 12, color: mutedIconColor }}>
              Recommended: 1280 × 720
            </Text>
          </View>
        )}
        {isUploadingThumb ? (
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: "#fff", marginTop: 8, fontSize: 13 }}>Uploading…</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {thumbnailUri && !isUploadingThumb ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => void handlePickThumbnail()}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderWidth: 1,
              borderColor,
              borderRadius: 10,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="refresh-outline" size={16} color={primaryColor} />
            <Text style={{ fontSize: 13, color: primaryColor, fontWeight: "600" }}>
              Replace
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setThumbnailUri(null);
              setThumbnailUrl(null);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: "#ef4444",
              borderRadius: 10,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {thumbnailUrl ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(34,197,94,0.1)",
            borderRadius: 10,
            padding: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={{ fontSize: 13, color: "#22c55e", fontWeight: "600" }}>
            Thumbnail uploaded successfully
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderStep4 = () => (
    <View style={{ gap: 20 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Course Schedule
        </Text>
        <Text style={{ fontSize: 14, color: mutedIconColor, marginTop: 4 }}>
          Set dates (optional)
        </Text>
      </View>

      <View
        style={{
          backgroundColor: primarySoftColor,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          gap: 10,
        }}
      >
        <Ionicons name="information-circle-outline" size={18} color={primaryColor} />
        <Text style={{ flex: 1, fontSize: 13, color: mutedIconColor, lineHeight: 20 }}>
          Leave blank if you don&apos;t have specific dates. You can update these later
          from course settings.
        </Text>
      </View>

      {[
        {
          label: "Start Date",
          value: startDate,
          onChange: setStartDate,
          placeholder: "YYYY-MM-DD",
        },
        {
          label: "Expected End Date",
          value: expectedEndDate,
          onChange: setExpectedEndDate,
          placeholder: "YYYY-MM-DD",
        },
      ].map((field) => (
        <View key={field.label}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isDark ? "#cbd5e1" : "#475569",
              marginBottom: 6,
            }}
          >
            {field.label}
          </Text>
          <TextInput
            value={field.value}
            onChangeText={field.onChange}
            placeholder={field.placeholder}
            placeholderTextColor={mutedIconColor}
            style={{
              borderWidth: 1,
              borderColor,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: isDark ? "#f1f5f9" : "#0f172a",
              backgroundColor: cardColor,
            }}
          />
        </View>
      ))}
    </View>
  );

  const renderStep5 = () => {
    const pricingLabel =
      pricingModel === "FREE"
        ? "Free"
        : pricingModel === "SUBSCRIPTION_INCLUDED"
          ? "Subscription"
          : `NPR ${Number(price).toLocaleString()}`;
    const rows = [
      { label: "Pricing", value: pricingLabel },
      { label: "Title", value: title.trim() || "—" },
      { label: "Subject", value: subject || "—" },
      { label: "Level", value: level || "—" },
      { label: "Thumbnail", value: thumbnailUrl ? "✓ Uploaded" : "None (optional)" },
      { label: "Start Date", value: startDate.trim() || "Not set" },
      { label: "End Date", value: expectedEndDate.trim() || "Not set" },
    ];

    return (
      <View style={{ gap: 16 }}>
        <View style={{ alignItems: "center", marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: isDark ? "#f1f5f9" : "#0f172a",
            }}
          >
            Review & Create
          </Text>
          <Text style={{ fontSize: 14, color: mutedIconColor, marginTop: 4 }}>
            Check everything before creating
          </Text>
        </View>

        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            overflow: "hidden",
          }}
        >
          {rows.map((row, i) => (
            <View key={row.label}>
              <View
                style={{
                  flexDirection: "row",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ flex: 1, fontSize: 13, color: mutedIconColor }}>
                  {row.label}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    textAlign: "right",
                    maxWidth: "60%",
                  }}
                  numberOfLines={2}
                >
                  {row.value}
                </Text>
              </View>
              {i < rows.length - 1 ? (
                <View
                  style={{
                    height: 1,
                    marginHorizontal: 16,
                    backgroundColor: borderColor,
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>

        <View
          style={{
            backgroundColor: primarySoftColor,
            borderRadius: 12,
            padding: 14,
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={primaryColor} />
          <Text style={{ flex: 1, fontSize: 13, color: mutedIconColor, lineHeight: 20 }}>
            The course will be created as a Draft. You can add sections and videos from
            the Course Studio, then publish when ready.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity onPress={goBack} style={{ marginRight: 12 }}>
          <Ionicons
            name={step > 1 ? "chevron-back" : "close"}
            size={24}
            color={primaryColor}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: isDark ? "#f1f5f9" : "#0f172a",
            }}
          >
            {STEPS[step - 1]?.title}
          </Text>
          <Text style={{ fontSize: 12, color: mutedIconColor }}>
            Step {step} of {STEPS.length}
          </Text>
        </View>
        {step < 5 ? (
          <TouchableOpacity
            onPress={goNext}
            disabled={!canProceed() || isUploadingThumb}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor:
                canProceed() && !isUploadingThumb ? primaryColor : `${primaryColor}40`,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void handleCreate()}
            disabled={isProcessing}
            style={{
              backgroundColor: isProcessing ? `${primaryColor}60` : primaryColor,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
              minWidth: 90,
              alignItems: "center",
            }}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Step indicator */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        {STEPS.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => {
              if (s.id < step) setStep(s.id);
            }}
            style={{ flex: 1, alignItems: "center", gap: 4 }}
            disabled={s.id > step}
          >
            <View
              style={{
                width: "100%",
                height: 3,
                borderRadius: 3,
                backgroundColor: s.id <= step ? primaryColor : borderColor,
              }}
            />
            <Ionicons
              name={s.icon}
              size={14}
              color={
                s.id === step
                  ? primaryColor
                  : s.id < step
                    ? `${primaryColor}80`
                    : mutedIconColor
              }
            />
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
