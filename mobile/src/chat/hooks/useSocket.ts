import { useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import socketClient from '../services/socketClient';
import chatApi from '../services/chatApi';
import {
  setConnected,
  addMessage,
  confirmMessage,
  setTyping,
  setPresence,
} from '../redux/chatSlice';
import { Message, TypingUpdate, PresenceUpdate } from '../types/chat';

export const useSocket = (mainAppToken: string | null) => {
  const dispatch = useDispatch();
  const tokenRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
    if (!mainAppToken) return;

    try {
      // Get chat-specific token
      chatApi.setAuthToken(mainAppToken);
      const chatToken = await chatApi.getChatToken();

      // Connect socket
      const socket = socketClient.connect(chatToken);
      tokenRef.current = chatToken;

      socket.on('connect', () => {
        dispatch(setConnected(true));
      });

      socket.on('disconnect', () => {
        dispatch(setConnected(false));
      });

      socket.on('message:new', (message: Message) => {
        dispatch(addMessage(message));
      });

      socket.on('message:ack', ({ clientMessageId, message }: { clientMessageId: string; message: Message }) => {
        dispatch(confirmMessage({ clientMessageId, message }));
      });

      socket.on('typing:update', (update: TypingUpdate) => {
        dispatch(setTyping(update));
      });

      socket.on('presence:update', (update: PresenceUpdate) => {
        dispatch(setPresence(update));
      });

      socket.on('connect_error', async (error) => {
        console.error('Socket connection error:', error);
        // Try to refresh token
        if (error.message === 'Invalid token') {
          try {
            const newToken = await chatApi.getChatToken();
            socketClient.disconnect();
            socketClient.connect(newToken);
          } catch {
            console.error('Failed to refresh chat token');
          }
        }
      });
    } catch (error) {
      console.error('Failed to connect to chat:', error);
    }
  }, [mainAppToken, dispatch]);

  const disconnect = useCallback(() => {
    socketClient.disconnect();
    dispatch(setConnected(false));
  }, [dispatch]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected: socketClient.isConnected(),
    reconnect: connect,
    disconnect,
  };
};

export default useSocket;
