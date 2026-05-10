import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import {
  ActionSheetIOS,
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
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import { updateUser } from "@/store/slices/userSlice";

function toCommaValue(values?: string[]) {
  return Array.isArray(values) ? values.join(", ") : "";
}

function toList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function EditProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    iconColor,
  } = useAppTheme();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setBio(user?.bio ?? "");
    setImageUrl(user?.image ?? "");
    setSkills(toCommaValue(user?.skills));
    setInterests(toCommaValue(user?.interests));
  }, [user]);

  async function pickAndUploadImage(source: "camera" | "gallery") {
    const permResult =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Toast.show({ type: "error", text1: "Permission denied." });
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const filename = uri.split("/").pop() ?? "avatar.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      const form = new FormData();
      form.append("file", { uri, name: filename, type } as any);

      const uploadRes = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded: string = uploadRes.data?.url ?? uploadRes.data?.secure_url ?? "";
      if (uploaded) setImageUrl(uploaded);
    } catch {
      Toast.show({ type: "error", text1: "Failed to upload image." });
    } finally {
      setUploadingImage(false);
    }
  }

  function handleAvatarPress() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) void pickAndUploadImage("camera");
          if (idx === 2) void pickAndUploadImage("gallery");
        },
      );
    } else {
      Alert.alert("Change Photo", "Select a source", [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: () => void pickAndUploadImage("camera") },
        { text: "Gallery", onPress: () => void pickAndUploadImage("gallery") },
      ]);
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      Toast.show({ type: "error", text1: "Name must be at least 2 characters." });
      return;
    }

    if (bio.length > 500) {
      Toast.show({ type: "error", text1: "Bio can be up to 500 characters." });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: trimmedName,
        bio: bio.trim(),
        userImage: imageUrl.trim(),
        skills: toList(skills),
        interests: toList(interests),
      };

      const res = await api.patch("/users/profile", payload);
      const updated = res.data?.user ?? payload;

      dispatch(
        updateUser({
          name: updated.name ?? payload.name,
          bio: updated.bio ?? payload.bio,
          image: updated.userImage ?? payload.userImage,
          skills: updated.skills ?? payload.skills,
          interests: updated.interests ?? payload.interests,
        }),
      );
      Toast.show({ type: "success", text1: "Profile updated." });
      router.back();
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Unable to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const initials = (name || user?.name || "U").slice(0, 2).toUpperCase();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-14">
          <View className="mb-7 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">Edit Profile</Text>
            <View className="h-11 w-11" />
          </View>

          <View className="items-center">
            {/* Explicit 112×112 container so the absolute camera badge has a real parent */}
            <View style={{ width: 112, height: 112 }}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.8}
                disabled={uploadingImage}
                style={{ width: 112, height: 112, borderRadius: 56, overflow: "hidden" }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: 112, height: 112 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 56,
                      backgroundColor: primaryColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text className="text-3xl font-bold text-white">{initials}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Camera badge — its own touch target */}
              <TouchableOpacity
                onPress={handleAvatarPress}
                disabled={uploadingImage}
                activeOpacity={0.8}
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: primaryColor,
                  borderWidth: 3,
                  borderColor: backgroundColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            <Text className="mt-4 text-xl font-bold text-foreground">
              {user?.name ?? "Your profile"}
            </Text>
            <View
              className="mt-2 rounded-full px-3 py-1"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
                {user?.role ?? "USER"}
              </Text>
            </View>
          </View>

          <View className="mt-8 overflow-hidden rounded-[24px] border border-border bg-card">
            <ProfileInput
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              mutedColor={mutedIconColor}
            />
            <Divider />
            <ProfileInput
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell students and teachers about you"
              mutedColor={mutedIconColor}
              multiline
              maxLength={500}
            />
            <Divider />
            <ProfileInput
              label="Skills"
              value={skills}
              onChangeText={setSkills}
              placeholder="Physics, Calculus, AI"
              mutedColor={mutedIconColor}
            />
            <Divider />
            <ProfileInput
              label="Interests"
              value={interests}
              onChangeText={setInterests}
              placeholder="Robotics, Literature"
              mutedColor={mutedIconColor}
            />
          </View>

          <Text className="mt-3 text-right text-xs text-muted-foreground">
            {bio.length}/500
          </Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="mt-8 items-center justify-center rounded-full"
            style={{ backgroundColor: primaryColor, height: 54 }}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Divider() {
  return <View className="h-px bg-border" />;
}

function ProfileInput({
  label,
  mutedColor,
  ...props
}: ComponentProps<typeof TextInput> & {
  label: string;
  mutedColor: string;
}) {
  return (
    <View className="px-4 py-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={mutedColor}
        className="text-[16px] text-card-foreground"
        style={[
          props.multiline ? { minHeight: 74, textAlignVertical: "top" } : null,
          props.style,
        ]}
      />
    </View>
  );
}
