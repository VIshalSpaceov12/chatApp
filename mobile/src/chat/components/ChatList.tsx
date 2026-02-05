import React, { useEffect, useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import chatApi from '../services/chatApi';
import { setConversations } from '../redux/chatSlice';
import ChatListItem from './ChatListItem';
import { Conversation } from '../types/chat';

interface RootState {
  chat: {
    conversations: Record<string, Conversation>;
    presence: Record<string, 'online' | 'offline'>;
  };
}

interface Props {
  onSelectConversation: (conversationId: string) => void;
}

export const ChatList: React.FC<Props> = ({ onSelectConversation }) => {
  const dispatch = useDispatch();
  const conversations = useSelector((state: RootState) =>
    Object.values(state.chat.conversations).sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || '';
      const bTime = b.lastMessage?.createdAt || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
  );
  const presence = useSelector((state: RootState) => state.chat.presence);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.getConversations();
      dispatch(setConversations(data));
    } catch (err) {
      setError('Failed to load conversations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const getOnlineStatus = useCallback(
    (conversation: Conversation) => {
      if (conversation.type !== 'direct') return undefined;
      const otherParticipant = conversation.participants.find(
        (p) => p.role !== 'member'
      );
      if (!otherParticipant) return undefined;
      return presence[otherParticipant.userId] === 'online';
    },
    [presence]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ChatListItem
        conversation={item}
        isOnline={getOnlineStatus(item)}
        onPress={() => onSelectConversation(item.id)}
      />
    ),
    [getOnlineStatus, onSelectConversation]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No conversations yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={styles.list}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
});

export default ChatList;
