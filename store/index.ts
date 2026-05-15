import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import authReducer from "./slices/authSlice";
import userReducer from "./slices/userSlice";
import feedReducer from "./slices/feedSlice";
import channelReducer from "./slices/channelSlice";
import channelsReducer from "./slices/channelsSlice";
import coursesReducer from "./slices/coursesSlice";
import uploadReducer from "./slices/uploadSlice";
import configReducer from "./slices/configSlice";
import activityReducer from "./slices/activitySlice";
import noticesReducer from "./slices/noticesSlice";
import onboardingReducer from "./slices/onboardingSlice";
import realtimeReducer from "./slices/realtimeSlice";
import walletReducer from "./slices/walletSlice";
import quizReducer from "./slices/quizSlice";
import incomingCallReducer from "./slices/incomingCallSlice";
import notesReducer from "./slices/notesSlice";
import { channelCacheLimiter } from "./transforms";

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: [
    "feed",
    "channels",
    "channel",
    "user",
    "courses",
    "wallet",
    "config",
    "quiz",
    "notes",
  ],
  transforms: [channelCacheLimiter],
};

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  feed: feedReducer,
  channel: channelReducer,
  channels: channelsReducer,
  courses: coursesReducer,
  upload: uploadReducer,
  config: configReducer,
  activity: activityReducer,
  notices: noticesReducer,
  onboarding: onboardingReducer,
  realtime: realtimeReducer,
  wallet: walletReducer,
  quiz: quizReducer,
  incomingCall: incomingCallReducer,
  notes: notesReducer,
});

const persistedReducer = persistReducer(persistConfig as any, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
