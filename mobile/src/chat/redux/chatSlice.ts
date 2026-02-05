import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Conversation, Message, TypingUpdate, PresenceUpdate } from '../types/chat';

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
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
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

      // Update conversation's last message
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
        if (message) {
          message.status = status;
        }
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
      const { conversationId, userIds } = action.payload;
      state.typing[conversationId] = userIds;
    },

    setPresence(state, action: PayloadAction<PresenceUpdate>) {
      const { userId, status } = action.payload;
      state.presence[userId] = status;
    },

    clearUnreadCount(state, action: PayloadAction<string>) {
      const conversationId = action.payload;
      if (state.conversations[conversationId]) {
        state.conversations[conversationId].unreadCount = 0;
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
