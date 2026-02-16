import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../src/store';
import {
  setConversations,
  addConversation,
  setConnected,
  addMessage,
  confirmMessage,
  setTyping,
  setPresence,
} from '../../src/store/chat-slice';
import { clearAuth } from '../../src/store/auth-slice';
import api from '../../src/services/api';
import socketClient from '../../src/services/socket';
import { Conversation, Message, TypingUpdate, PresenceUpdate, User } from '../../src/types';

export default function ChatListScreen() {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const conversationsMap = useSelector((state: RootState) => state.chat.conversations);
  const conversations = useMemo(
    () =>
      Object.values(conversationsMap).sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || '';
        const bTime = b.lastMessage?.createdAt || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    [conversationsMap]
  );
  const isConnected = useSelector((state: RootState) => state.chat.isConnected);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // Connect socket
  useEffect(() => {
    if (!auth.token) return;

    const connectSocket = async () => {
      try {
        const chatToken = await api.getChatToken();
        const socket = socketClient.connect(chatToken);
        socket.on('connect', () => dispatch(setConnected(true)));
        socket.on('disconnect', () => dispatch(setConnected(false)));
        socket.on('message:new', (msg: Message) => dispatch(addMessage(msg)));
        socket.on('message:ack', ({ clientMessageId, message }: { clientMessageId: string; message: Message }) =>
          dispatch(confirmMessage({ clientMessageId, message }))
        );
        socket.on('typing:update', (update: TypingUpdate) => dispatch(setTyping(update)));
        socket.on('presence:update', (update: PresenceUpdate) => dispatch(setPresence(update)));
      } catch {
        // silent
      }
    };
    connectSocket();
    return () => {
      socketClient.disconnect();
      dispatch(setConnected(false));
    };
  }, [auth.token, dispatch]);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getConversations();
        dispatch(setConversations(data));
      } catch {
        // No conversations
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dispatch]);

  // Search users
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await api.searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        // silent
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreateConversation = useCallback(async () => {
    if (!newChatName.trim()) return;
    try {
      const participantIds = [auth.user!.id, ...selectedUsers.map((u) => u.id)];
      const type = selectedUsers.length === 1 ? 'direct' : 'group';
      const conv = await api.createConversation(type, participantIds, newChatName.trim());
      dispatch(addConversation(conv));
      setShowNewChat(false);
      setNewChatName('');
      setSelectedUsers([]);
      setSearchQuery('');
      router.push({ pathname: '/(app)/chat/[id]', params: { id: conv.id, name: conv.name || 'Chat' } });
    } catch {
      Alert.alert('Error', 'Failed to create conversation');
    }
  }, [newChatName, selectedUsers, auth.user, dispatch]);

  const handleLogout = () => {
    socketClient.disconnect();
    api.clearToken();
    dispatch(clearAuth());
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => {
      const displayName = item.name || 'Conversation';
      const hasUnread = item.unreadCount > 0;
      const initial = displayName[0]?.toUpperCase() || '?';

      return (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/chat/[id]', params: { id: item.id, name: displayName } })
          }
          style={({ pressed }) => ({
            flexDirection: 'row',
            padding: 16,
            gap: 14,
            alignItems: 'center',
            backgroundColor: pressed ? '#F2F2F7' : '#FFF',
          })}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#007AFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '600' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 17,
                  fontWeight: hasUnread ? '600' : '400',
                  color: '#000',
                  flex: 1,
                }}
              >
                {displayName}
              </Text>
              {item.lastMessage && (
                <Text style={{ fontSize: 14, color: hasUnread ? '#007AFF' : '#8E8E93', marginLeft: 8 }}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  color: hasUnread ? '#000' : '#8E8E93',
                  flex: 1,
                }}
              >
                {item.lastMessage?.content || 'No messages yet'}
              </Text>
              {hasUnread && (
                <View
                  style={{
                    backgroundColor: '#007AFF',
                    borderRadius: 11,
                    minWidth: 22,
                    height: 22,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 7,
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    []
  );

  const separator = () => (
    <View style={{ height: 0.5, backgroundColor: '#E5E5EA', marginLeft: 82 }} />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Chats',
          headerLargeTitle: true,
          headerRight: () => (
            <Pressable onPress={() => setShowNewChat(!showNewChat)} hitSlop={8}>
              <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '500' }}>
                {showNewChat ? 'Cancel' : 'New'}
              </Text>
            </Pressable>
          ),
          headerLeft: () => (
            <Pressable onPress={handleLogout} hitSlop={8}>
              <Text style={{ color: '#FF3B30', fontSize: 15 }}>Logout</Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        {/* Connection banner */}
        {!isConnected && (
          <View style={{ backgroundColor: '#FF3B30', paddingVertical: 4 }}>
            <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center', fontWeight: '500' }}>
              Reconnecting...
            </Text>
          </View>
        )}

        {/* New Chat Panel */}
        {showNewChat && (
          <View style={{ padding: 16, gap: 12, backgroundColor: '#F8F8FA', borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' }}>
            <TextInput
              value={newChatName}
              onChangeText={setNewChatName}
              placeholder="Conversation name"
              placeholderTextColor="#C7C7CC"
              style={{
                backgroundColor: '#FFF',
                borderRadius: 10,
                borderCurve: 'continuous',
                padding: 14,
                fontSize: 16,
                color: '#000',
              }}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users to add..."
              placeholderTextColor="#C7C7CC"
              autoCapitalize="none"
              style={{
                backgroundColor: '#FFF',
                borderRadius: 10,
                borderCurve: 'continuous',
                padding: 14,
                fontSize: 16,
                color: '#000',
              }}
            />

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {selectedUsers.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleUser(u)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#007AFF',
                      borderRadius: 16,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '500' }}>{u.name}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>x</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <View style={{ backgroundColor: '#FFF', borderRadius: 10, borderCurve: 'continuous', overflow: 'hidden' }}>
                {searchResults.map((user, i) => (
                  <Pressable
                    key={user.id}
                    onPress={() => toggleUser(user)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      gap: 10,
                      borderTopWidth: i > 0 ? 0.5 : 0,
                      borderTopColor: '#E5E5EA',
                      backgroundColor: selectedUsers.find((u) => u.id === user.id) ? '#E8F0FE' : '#FFF',
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: user.avatarColor || '#007AFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
                        {user.name[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: '#000' }}>{user.name}</Text>
                      <Text style={{ fontSize: 13, color: '#8E8E93' }}>{user.role}</Text>
                    </View>
                    {selectedUsers.find((u) => u.id === user.id) && (
                      <Text style={{ color: '#007AFF', fontSize: 16 }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              onPress={handleCreateConversation}
              disabled={!newChatName.trim()}
              style={({ pressed }) => ({
                backgroundColor: !newChatName.trim() ? '#C7C7CC' : pressed ? '#0066DD' : '#007AFF',
                paddingVertical: 14,
                borderRadius: 10,
                borderCurve: 'continuous',
              })}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Create Conversation
              </Text>
            </Pressable>
          </View>
        )}

        {/* Conversation List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : conversations.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#F2F2F7',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>💬</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#000', marginBottom: 6 }}>
              No conversations yet
            </Text>
            <Text style={{ fontSize: 15, color: '#8E8E93', textAlign: 'center' }}>
              Tap "New" to start chatting with trainers, staff, or groups
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={separator}
            contentInsetAdjustmentBehavior="automatic"
          />
        )}
      </View>
    </>
  );
}
