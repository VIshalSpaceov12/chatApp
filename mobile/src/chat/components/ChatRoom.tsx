import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import socketClient from '../services/socketClient';
import { useMessages } from '../hooks/useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { Message } from '../types/chat';

interface RootState {
  chat: {
    typing: Record<string, string[]>;
  };
}

interface Props {
  conversationId: string;
  currentUserId: string;
  participantNames?: Record<string, string>;
}

export const ChatRoom: React.FC<Props> = ({
  conversationId,
  currentUserId,
  participantNames = {},
}) => {
  const {
    messages,
    loading,
    hasMore,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    retryMessage,
  } = useMessages(conversationId);

  const typingUserIds = useSelector(
    (state: RootState) => state.chat.typing[conversationId] || []
  );

  const typingUserNames = typingUserIds
    .filter((id) => id !== currentUserId)
    .map((id) => participantNames[id] || 'Someone');

  useEffect(() => {
    socketClient.joinConversation(conversationId);
    loadMessages();

    return () => {
      socketClient.leaveConversation(conversationId);
    };
  }, [conversationId, loadMessages]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, currentUserId);
    },
    [sendMessage, currentUserId]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwnMessage={item.senderId === currentUserId}
        onRetry={item.status === 'failed' ? () => retryMessage(item) : undefined}
      />
    ),
    [currentUserId, retryMessage]
  );

  const renderFooter = useCallback(() => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" />
      </View>
    );
  }, [loading]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) {
      loadMoreMessages();
    }
  }, [hasMore, loading, loadMoreMessages]);

  return (
    <View style={styles.container}>
      <FlatList
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
      <TypingIndicator userNames={typingUserNames} />
      <MessageInput
        conversationId={conversationId}
        onSend={handleSend}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
});

export default ChatRoom;
