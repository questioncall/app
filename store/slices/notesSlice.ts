import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NoteFileType = "PDF" | "DOCX" | "PPT" | "Image";

export interface Note {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  fileType: NoteFileType;
  fileUrl: string | null;
  uploaderName: string;
  uploaderUsername: string | null;
  uploaderImage: string | null;
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotesState {
  list: Note[];
  lastFetchedAt: number | null;
}

const NOTES_CACHE_TTL_MS = 5 * 60 * 1000;

const initialState: NotesState = {
  list: [],
  lastFetchedAt: null,
};

const notesSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    setNotes(state, action: PayloadAction<Note[]>) {
      state.list = action.payload;
      state.lastFetchedAt = Date.now();
    },
    prependNote(state, action: PayloadAction<Note>) {
      state.list = [action.payload, ...state.list];
    },
    updateNote(state, action: PayloadAction<Note>) {
      const idx = state.list.findIndex((n) => n.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    removeNote(state, action: PayloadAction<string>) {
      state.list = state.list.filter((n) => n.id !== action.payload);
    },
    clearNotes(state) {
      state.list = [];
      state.lastFetchedAt = null;
    },
  },
});

export const { setNotes, prependNote, updateNote, removeNote, clearNotes } =
  notesSlice.actions;

export const selectIsNotesStale = (lastFetchedAt: number | null): boolean => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > NOTES_CACHE_TTL_MS;
};

export default notesSlice.reducer;
