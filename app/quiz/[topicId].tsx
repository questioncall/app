import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function QuizScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return (
    <View className="flex-1 bg-slate-950 items-center justify-center">
      <Text className="text-white text-lg">Quiz</Text>
      <Text className="text-slate-400">Topic: {topicId}</Text>
    </View>
  );
}
