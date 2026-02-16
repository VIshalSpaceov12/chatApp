import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Conversation, Message, TypingUpdate, PresenceUpdate } from '../types';

interface ChatState {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  typing: Record<string, string[]>;
  presence: Record<string, 'online' | 'offline'>;
  activeConversationId: string | null;
  isConnected: boolean;
}

const initialState: ChatState = {
  conversations: {},
  messages: {},
  typing: {},
  presence: {},
  activeConversationId: null,
  isConnected: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },
    setConversations(state, action: PayloadAction<Conversation[]>) {
      action.payload.forEach((conv) => {
        state.conversations[conv.id] = conv;
      });
    },
    addConversation(state, action: PayloadAction<Conversation>) {
      state.conversations[action.payload.id] = action.payload;
    },
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },
    setMessages(state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },
    prependMessages(state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) {
      const { conversationId, messages } = action.payload;
      const existing = state.messages[conversationId] || [];
      state.messages[conversationId] = [...messages, ...existing];
    },
    addMessage(state, action: PayloadAction<Message>) {
      const { conversationId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(action.payload);
      if (state.conversations[conversationId]) {
        state.conversations[conversationId].lastMessage = action.payload;
      }
    },
    updateMessageStatus(
      state,
      action: PayloadAction<{ conversationId: string; messageId: string; status: Message['status'] }>
    ) {
      const { conversationId, messageId, status } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const message = messages.find((m) => m.id === messageId || m.clientMessageId === messageId);
        if (message) message.status = status;
      }
    },
    confirmMessage(
      state,
      action: PayloadAction<{ clientMessageId: string; message: Message }>
    ) {
      const { clientMessageId, message } = action.payload;
      const messages = state.messages[message.conversationId];
      if (messages) {
        const index = messages.findIndex((m) => m.clientMessageId === clientMessageId);
        if (index !== -1) {
          messages[index] = { ...message, status: 'sent' };
        }
      }
    },
    setTyping(state, action: PayloadAction<TypingUpdate>) {
      state.typing[action.payload.conversationId] = action.payload.userIds;
    },
    setPresence(state, action: PayloadAction<PresenceUpdate>) {
      state.presence[action.payload.userId] = action.payload.status;
    },
    clearUnreadCount(state, action: PayloadAction<string>) {
      if (state.conversations[action.payload]) {
        state.conversations[action.payload].unreadCount = 0;
      }
    },
    resetChat() {
      return initialState;
    },
  },
});

export const {
  setConnected,
  setConversations,
  addConversation,
  setActiveConversation,
  setMessages,
  prependMessages,
  addMessage,
  updateMessageStatus,
  confirmMessage,
  setTyping,
  setPresence,
  clearUnreadCount,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;
