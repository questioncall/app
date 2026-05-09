import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { usePreventScreenCapture } from "expo-screen-capture";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBiometricGate } from "@/hooks/use-biometric-gate";
import { api } from "@/lib/api";
import {
  setWithdrawing,
  setWithdrawError,
  setWalletData,
  type WalletData,
} from "@/store/slices/walletSlice";
import { updateUser } from "@/store/slices/userSlice";

export default function WithdrawScreen() {
  usePreventScreenCapture();
  const { isUnlocked } = useBiometricGate();
  const dispatch = useAppDispatch();
  const wallet = useAppSelector((s) => s.wallet);
  const user = useAppSelector((s) => s.user.data);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const data = wallet.data;
  const pointBalance = data?.pointBalance ?? 0;
  const minWithdrawal = data?.minWithdrawalPoints ?? 100;
  const nprRate = data?.pointToNprRate ?? 1;
  const savedEsewa = data?.savedEsewaNumber ?? user?.esewaNumber ?? "";
  const hasPending = (data?.pendingWithdrawal ?? 0) > 0;

  const [points, setPoints] = useState("");
  const [esewaNumber, setEsewaNumber] = useState(savedEsewa);
  const [saveNumber, setSaveNumber] = useState(true);

  const pointsNum = Number(points) || 0;
  const nprPreview = Math.round(pointsNum * nprRate * 100) / 100;

  const canSubmit =
    pointsNum >= minWithdrawal &&
    pointsNum <= pointBalance &&
    esewaNumber.trim().length >= 10 &&
    !hasPending &&
    !wallet.isWithdrawing;

  const handleWithdraw = useCallback(async () => {
    if (!canSubmit) return;

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ${pointsNum.toLocaleString()} pts (≈ NPR ${nprPreview.toLocaleString()}) to eSewa ${esewaNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          onPress: async () => {
            dispatch(setWithdrawing(true));
            try {
              await api.post("/wallet/withdraw", {
                pointsRequested: pointsNum,
                esewaNumber: esewaNumber.trim(),
                saveEsewaNumber: saveNumber,
              });

              if (saveNumber) {
                dispatch(updateUser({ esewaNumber: esewaNumber.trim() }));
              }

              Toast.show({
                type: "success",
                text1: "Withdrawal Requested",
                text2: `${pointsNum} pts submitted. We'll process it shortly.`,
              });

              // Refresh wallet data
              try {
                const res = await api.get("/wallet", {
                  params: { limit: 50, skip: 0 },
                });
                dispatch(setWalletData(res.data as WalletData));
              } catch {}

              router.back();
            } catch (err: any) {
              const msg = err?.response?.data?.error ?? "Withdrawal failed. Try again.";
              dispatch(setWithdrawError(msg));
              Toast.show({ type: "error", text1: "Withdrawal Failed", text2: msg });
            }
          },
        },
      ],
    );
  }, [canSubmit, pointsNum, nprPreview, esewaNumber, saveNumber, dispatch]);

  if (!isUnlocked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <Ionicons name="lock-closed" size={48} color={mutedIconColor} />
        <Text className="mt-4 text-base text-muted-foreground">
          Authenticate to continue
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Withdraw</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Balance card */}
          <View className="rounded-2xl p-4" style={{ backgroundColor: primarySoftColor }}>
            <Text className="text-xs text-muted-foreground">Available Balance</Text>
            <Text className="text-3xl font-bold text-foreground">
              {pointBalance.toLocaleString()} pts
            </Text>
            <Text className="mt-0.5 text-sm text-muted-foreground">
              ≈ NPR {(pointBalance * nprRate).toLocaleString()}
            </Text>
          </View>

          {hasPending ? (
            <View className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={18} color="#f59e0b" />
                <Text className="font-semibold text-amber-600">Pending Withdrawal</Text>
              </View>
              <Text className="mt-1 text-sm text-amber-600">
                You already have a pending withdrawal of{" "}
                {data?.pendingWithdrawal?.toLocaleString()} pts. Wait for it to be
                processed before requesting a new one.
              </Text>
            </View>
          ) : null}

          {/* Amount input */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Points to Withdraw
            </Text>
            <View
              className="flex-row items-center rounded-xl border px-4"
              style={{ borderColor }}
            >
              <TextInput
                className="flex-1 py-3.5 text-base text-foreground"
                value={points}
                onChangeText={setPoints}
                keyboardType="numeric"
                placeholder={`Min ${minWithdrawal} pts`}
                placeholderTextColor={mutedIconColor}
                editable={!hasPending}
              />
              {pointsNum > 0 ? (
                <Text className="text-sm text-muted-foreground">
                  ≈ NPR {nprPreview.toLocaleString()}
                </Text>
              ) : null}
            </View>
            {pointsNum > 0 && pointsNum < minWithdrawal ? (
              <Text className="mt-1 text-xs text-red-500">
                Minimum withdrawal is {minWithdrawal} pts
              </Text>
            ) : null}
            {pointsNum > pointBalance ? (
              <Text className="mt-1 text-xs text-red-500">Insufficient balance</Text>
            ) : null}

            {/* Quick amount buttons */}
            <View className="mt-3 flex-row gap-2">
              {[25, 50, 75, 100].map((pct) => {
                const val = Math.floor((pointBalance * pct) / 100);
                if (val < minWithdrawal && pct < 100) return null;
                return (
                  <TouchableOpacity
                    key={pct}
                    onPress={() => setPoints(String(val))}
                    className="rounded-lg border px-3 py-1.5"
                    style={{ borderColor }}
                    disabled={hasPending}
                  >
                    <Text className="text-xs font-medium text-foreground">{pct}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* eSewa number */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">eSewa Number</Text>
            <TextInput
              className="rounded-xl border px-4 py-3.5 text-base text-foreground"
              style={{ borderColor }}
              value={esewaNumber}
              onChangeText={setEsewaNumber}
              keyboardType="phone-pad"
              placeholder="98XXXXXXXX"
              placeholderTextColor={mutedIconColor}
              maxLength={15}
              editable={!hasPending}
            />
            {esewaNumber.length > 0 && esewaNumber.length < 10 ? (
              <Text className="mt-1 text-xs text-red-500">
                Enter a valid phone number
              </Text>
            ) : null}
          </View>

          {/* Save number toggle */}
          <TouchableOpacity
            className="flex-row items-center gap-3"
            onPress={() => setSaveNumber((v) => !v)}
            disabled={hasPending}
          >
            <Ionicons
              name={saveNumber ? "checkbox" : "square-outline"}
              size={22}
              color={saveNumber ? primaryColor : mutedIconColor}
            />
            <Text className="text-sm text-foreground">
              Save eSewa number for future withdrawals
            </Text>
          </TouchableOpacity>

          {/* Submit button */}
          <TouchableOpacity
            className="mt-2 items-center rounded-2xl py-4"
            style={{
              backgroundColor: canSubmit ? primaryColor : `${primaryColor}40`,
            }}
            onPress={handleWithdraw}
            disabled={!canSubmit}
          >
            {wallet.isWithdrawing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Request Withdrawal</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View className="rounded-2xl border p-4" style={{ borderColor }}>
            <Text className="mb-2 text-sm font-semibold text-foreground">
              How it works
            </Text>
            <Text className="text-xs leading-5 text-muted-foreground">
              {"•"} Points are deducted immediately when you request{"\n"}
              {"•"} Admin reviews and sends payment to your eSewa{"\n"}
              {"•"} Only one pending withdrawal at a time{"\n"}
              {"•"} Current rate: 1 pt = NPR {nprRate}
              {"\n"}
              {"•"} Minimum: {minWithdrawal} pts (NPR {minWithdrawal * nprRate})
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
