import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chat-slice';
import authReducer from './auth-slice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
