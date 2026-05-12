import { configureStore } from "@reduxjs/toolkit";
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

export const store = configureStore({
  reducer: {
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
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
