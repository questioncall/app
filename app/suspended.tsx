import { View, Text, TouchableOpacity, Linking } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { useAppDispatch } from "@/hooks/redux";
import { clearAuth } from "@/store/slices/authSlice";
import { clearUser } from "@/store/slices/userSlice";
import { SECURE_STORE_KEYS } from "@/lib/api";

export default function SuspendedScreen() {
  const dispatch = useAppDispatch();

  async function handleSignOut() {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    dispatch(clearAuth());
    dispatch(clearUser());
    router.replace("/");
  }

  return (
    <View className="flex-1 bg-red-950 items-center justify-center px-8">
      <Text className="text-6xl mb-6">🚫</Text>
      <Text className="text-white text-2xl font-bold mb-3 text-center">
        Account Suspended
      </Text>
      <Text className="text-red-200 text-base text-center leading-relaxed mb-10 max-w-xs">
        Your account has been suspended. If you believe this is a mistake,
        please contact support.
      </Text>

      <TouchableOpacity
        className="bg-white rounded-2xl py-4 px-8 mb-4 w-full items-center"
        onPress={() =>
          Linking.openURL("mailto:support@questioncall.com?subject=Account%20Suspended")
        }
      >
        <Text className="text-red-900 font-semibold text-base">
          Contact Support
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-red-400 rounded-2xl py-4 px-8 w-full items-center"
        onPress={handleSignOut}
      >
        <Text className="text-red-300 font-semibold text-base">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
