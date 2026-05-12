import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface IncomingCall {
  callSessionId: string;
  channelId: string;
  callerName: string;
  callerImage: string | null;
  callerId: string;
  mode: "AUDIO" | "VIDEO";
}

interface IncomingCallState {
  call: IncomingCall | null;
}

const initialState: IncomingCallState = {
  call: null,
};

const incomingCallSlice = createSlice({
  name: "incomingCall",
  initialState,
  reducers: {
    setIncomingCall(state, action: PayloadAction<IncomingCall>) {
      state.call = action.payload;
    },
    clearIncomingCall(state) {
      state.call = null;
    },
  },
});

export const { setIncomingCall, clearIncomingCall } = incomingCallSlice.actions;
export default incomingCallSlice.reducer;
