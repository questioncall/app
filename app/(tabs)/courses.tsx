import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import api from "@/lib/api";

interface Course {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  pricingModel: "FREE" | "SUBSCRIPTION_INCLUDED" | "PAID";
  price?: number;
  status: string;
  instructorName?: string;
  thumbnailUrl?: string;
}

export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      const res = await api.get("/courses");
      setCourses(res.data.courses ?? res.data);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  const pricingLabel = (model: Course["pricingModel"], price?: number) => {
    if (model === "FREE") return { text: "Free", color: "text-green-400" };
    if (model === "SUBSCRIPTION_INCLUDED")
      return { text: "Subscription", color: "text-blue-400" };
    return {
      text: `NPR ${price?.toLocaleString() ?? "—"}`,
      color: "text-yellow-400",
    };
  };

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Courses</Text>
        <Text className="text-slate-400 text-sm mt-0.5">
          Learn from expert teachers
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : courses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">📚</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            No courses yet
          </Text>
          <Text className="text-slate-400 text-sm text-center">
            Courses will appear here once available.
          </Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadCourses();
              }}
              tintColor="#3B82F6"
            />
          }
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
          renderItem={({ item }) => {
            const label = pricingLabel(item.pricingModel, item.price);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/course/${item._id}` as any)}
                className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800"
                activeOpacity={0.8}
              >
                {/* Thumbnail placeholder */}
                <View className="h-32 bg-gradient-to-br from-blue-900 to-slate-800 items-center justify-center">
                  <Text className="text-4xl">📚</Text>
                </View>
                <View className="p-3">
                  <Text
                    className="text-white font-semibold text-sm mb-1"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.instructorName ? (
                    <Text className="text-slate-400 text-xs mb-2" numberOfLines={1}>
                      by {item.instructorName}
                    </Text>
                  ) : null}
                  <Text className={`text-xs font-semibold ${label.color}`}>
                    {label.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
