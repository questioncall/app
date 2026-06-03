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

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Nepali",
  "Computer Science",
  "Economics",
  "Web Development",
  "Mobile Development",
  "Management",
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

export default function CreateChapterScreen() {
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
  const [pricingModel, setPricingModel] = useState<PricingModel>("FREE");
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const canProceed = () => {
    if (step === 1) return pricingModel !== "PAID" || Number(price) > 0;
    if (step === 2) {
      return title.trim() && description.trim() && subject && level;
    }
    return !isUploadingThumb;
  };

  const pickThumbnail = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow gallery access to choose a thumbnail.");
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
      const filename = asset.uri.split("/").pop() ?? "chapter-thumbnail.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      formData.append("file", {
        uri: asset.uri,
        name: filename,
        type: ext === "png" ? "image/png" : "image/jpeg",
      } as any);
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      setThumbnailUrl(res.data.secure_url);
      Toast.show({ type: "success", text1: "Thumbnail uploaded" });
    } catch {
      setThumbnailUri(null);
      Toast.show({ type: "error", text1: "Thumbnail upload failed" });
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const createChapter = async () => {
    if (isUploadingThumb) return;
    setIsProcessing(true);
    try {
      const res = await api.post("/chapters", {
        title: title.trim(),
        description: description.trim(),
        subject,
        level,
        pricingModel,
        price: pricingModel === "PAID" ? Number(price) : null,
        thumbnailUrl,
        status: "DRAFT",
      });
      Toast.show({ type: "success", text1: "Chapter created" });
      router.replace({
        pathname: "/studio/chapter/[chapterId]" as any,
        params: { chapterId: res.data._id },
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to create chapter",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const textColor = isDark ? "#f1f5f9" : "#0f172a";

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
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
        <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : router.back())}>
          <Ionicons
            name={step > 1 ? "chevron-back" : "close"}
            size={24}
            color={primaryColor}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>
            Create Chapter
          </Text>
          <Text style={{ fontSize: 12, color: mutedIconColor }}>Step {step} of 4</Text>
        </View>
        {step < 4 ? (
          <TouchableOpacity
            onPress={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{
              backgroundColor: canProceed() ? primaryColor : `${primaryColor}40`,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void createChapter()}
            disabled={isProcessing}
            style={{
              minWidth: 88,
              alignItems: "center",
              backgroundColor: isProcessing ? `${primaryColor}60` : primaryColor,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>Create</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 6, padding: 16 }}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 3,
              backgroundColor: s <= step ? primaryColor : borderColor,
            }}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>
                Chapter access
              </Text>
              {(["FREE", "SUBSCRIPTION_INCLUDED", "PAID"] as PricingModel[]).map(
                (model) => {
                  const selected = pricingModel === model;
                  const label =
                    model === "FREE"
                      ? "Free"
                      : model === "SUBSCRIPTION_INCLUDED"
                        ? "Subscription"
                        : "Paid";
                  return (
                    <TouchableOpacity
                      key={model}
                      onPress={() => setPricingModel(model)}
                      style={{
                        borderWidth: 2,
                        borderColor: selected ? primaryColor : borderColor,
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: selected ? primarySoftColor : cardColor,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>
                        {label}
                      </Text>
                      <Text style={{ marginTop: 4, fontSize: 13, color: mutedIconColor }}>
                        {model === "FREE"
                          ? "Anyone can open it"
                          : model === "SUBSCRIPTION_INCLUDED"
                            ? "Included for subscribers"
                            : "One-time purchase"}
                      </Text>
                      {selected && model === "PAID" ? (
                        <TextInput
                          value={price}
                          onChangeText={setPrice}
                          keyboardType="numeric"
                          placeholder="Price in NPR"
                          placeholderTextColor={mutedIconColor}
                          style={{
                            marginTop: 12,
                            borderWidth: 1,
                            borderColor,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: textColor,
                            backgroundColor: cardColor,
                          }}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                },
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>
                Chapter details
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Chapter title"
                placeholderTextColor={mutedIconColor}
                style={{
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: textColor,
                  backgroundColor: cardColor,
                }}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Short description"
                placeholderTextColor={mutedIconColor}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 110,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: textColor,
                  backgroundColor: cardColor,
                }}
              />
              <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                Subject
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SUBJECTS.map((item) => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setSubject(item)}
                      style={{
                        borderWidth: 1,
                        borderColor: subject === item ? primaryColor : borderColor,
                        backgroundColor: subject === item ? primaryColor : "transparent",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: subject === item ? "#fff" : mutedIconColor,
                          fontWeight: "600",
                        }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                Level
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LEVELS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setLevel(item)}
                    style={{
                      borderWidth: 1,
                      borderColor: level === item ? primaryColor : borderColor,
                      backgroundColor: level === item ? primaryColor : "transparent",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: level === item ? "#fff" : mutedIconColor,
                        fontWeight: "600",
                      }}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>
                Thumbnail
              </Text>
              <TouchableOpacity
                onPress={() => void pickThumbnail()}
                disabled={isUploadingThumb}
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
                  <View style={{ alignItems: "center", gap: 10 }}>
                    <Ionicons name="image-outline" size={32} color={primaryColor} />
                    <Text style={{ color: mutedIconColor }}>Tap to choose an image</Text>
                  </View>
                )}
                {isUploadingThumb ? (
                  <View
                    style={{
                      position: "absolute",
                      inset: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0,0,0,0.45)",
                    }}
                  >
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </TouchableOpacity>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>
                Review
              </Text>
              {[
                ["Title", title || "-"],
                [
                  "Pricing",
                  pricingModel === "PAID"
                    ? `NPR ${Number(price).toLocaleString()}`
                    : pricingModel,
                ],
                ["Subject", subject || "-"],
                ["Level", level || "-"],
                ["Thumbnail", thumbnailUrl ? "Uploaded" : "None"],
              ].map(([label, value]) => (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: mutedIconColor }}>{label}</Text>
                  <Text
                    style={{
                      color: textColor,
                      fontWeight: "700",
                      maxWidth: "62%",
                      textAlign: "right",
                    }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
