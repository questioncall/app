import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import userReducer from "./slices/userSlice";
import feedReducer from "./slices/feedSlice";
import channelReducer from "./slices/channelSlice";
import channelsReducer from "./slices/channelsSlice";
import uploadReducer from "./slices/uploadSlice";
import configReducer from "./slices/configSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    feed: feedReducer,
    channel: channelReducer,
    channels: channelsReducer,
    upload: uploadReducer,
    config: configReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
