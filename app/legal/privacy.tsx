import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function PrivacyScreen() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/legal?type=privacy")
      .then((r) => setContent(r.data.content ?? ""))
      .catch(() => setContent("Privacy Policy — please visit questioncall.com for details."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-14 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Privacy Policy</Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4">
          <Text className="text-slate-300 text-sm leading-relaxed pb-8">{content}</Text>
        </ScrollView>
      )}
    </View>
  );
}
