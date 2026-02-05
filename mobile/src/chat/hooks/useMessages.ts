import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import socketClient from '../services/socketClient';
import chatApi from '../services/chatApi';
import {
  setMessages,
  prependMessages,
  addMessage,
  updateMessageStatus,
} from '../redux/chatSlice';
import { Message } from '../types/chat';

interface RootState {
  chat: {
    messages: Record<string, Message[]>;
    activeConversationId: string | null;
  };
}

export const useMessages = (conversationId: string) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const messages = useSelector(
    (state: RootState) => state.chat.messages[conversationId] || []
  );

  const loadMessages = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const result = await chatApi.getMessages(conversationId);
      dispatch(setMessages({ conversationId, messages: result.messages }));
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, dispatch]);

  const loadMoreMessages = useCallback(async () => {
    if (loading || !hasMore || messages.length === 0) return;
    setLoading(true);

    try {
      const oldestMessage = messages[0];
      const result = await chatApi.getMessages(
        conversationId,
        50,
        oldestMessage.createdAt
      );
      dispatch(prependMessages({ conversationId, messages: result.messages }));
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, hasMore, messages, dispatch]);

  const sendMessage = useCallback(
    (content: string, senderId: string) => {
      const clientMessageId = uuidv4();
      const optimisticMessage: Message = {
        id: clientMessageId,
        conversationId,
        senderId,
        content,
        createdAt: new Date().toISOString(),
        status: 'pending',
        clientMessageId,
      };

      // Optimistic update
      dispatch(addMessage(optimisticMessage));

      // Send via socket
      socketClient.sendMessage(conversationId, content, clientMessageId);

      // Set timeout for failure detection
      setTimeout(() => {
        dispatch(
          updateMessageStatus({
            conversationId,
            messageId: clientMessageId,
            status: 'failed',
          })
        );
      }, 10000);
    },
    [conversationId, dispatch]
  );

  const retryMessage = useCallback(
    (message: Message) => {
      if (message.clientMessageId) {
        dispatch(
          updateMessageStatus({
            conversationId,
            messageId: message.clientMessageId,
            status: 'pending',
          })
        );
        socketClient.sendMessage(
          conversationId,
          message.content,
          message.clientMessageId
        );
      }
    },
    [conversationId, dispatch]
  );

  return {
    messages,
    loading,
    hasMore,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    retryMessage,
  };
};

export default useMessages;
