import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { RootState } from '../../../src/store';
import {
  setMessages,
  prependMessages,
  addMessage,
  updateMessageStatus,
} from '../../../src/store/chat-slice';
import api from '../../../src/services/api';
import socketClient from '../../../src/services/socket';
import { Message, MessageStatus } from '../../../src/types';

function StatusIcon({ status }: { status?: MessageStatus }) {
  switch (status) {
    case 'pending':
      return <Text style={{ fontSize: 11, marginLeft: 4, color: 'rgba(255,255,255,0.5)' }}>{'\u2022\u2022\u2022'}</Text>;
    case 'sent':
      return <Text style={{ fontSize: 11, marginLeft: 4, color: 'rgba(255,255,255,0.7)' }}>{'\u2713'}</Text>;
    case 'delivered':
      return <Text style={{ fontSize: 11, marginLeft: 4, color: 'rgba(255,255,255,0.7)' }}>{'\u2713\u2713'}</Text>;
    case 'read':
      return <Text style={{ fontSize: 11, marginLeft: 4, color: '#FFF' }}>{'\u2713\u2713'}</Text>;
    case 'failed':
      return <Text style={{ fontSize: 11, marginLeft: 4, color: '#FF6B6B' }}>!</Text>;
    default:
      return null;
  }
}

function MessageBubble({ message, isOwn, onRetry }: { message: Message; isOwn: boolean; onRetry?: () => void }) {
  return (
    <View style={{ marginVertical: 2, marginHorizontal: 16, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: isOwn ? '#007AFF' : '#E9E9EB',
          borderBottomRightRadius: isOwn ? 6 : 18,
          borderBottomLeftRadius: isOwn ? 18 : 6,
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 21, color: isOwn ? '#FFF' : '#000' }}>
          {message.content}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
          <Text style={{ fontSize: 11, color: isOwn ? 'rgba(255,255,255,0.6)' : '#8E8E93' }}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isOwn && <StatusIcon status={message.status} />}
        </View>
      </View>
      {message.status === 'failed' && onRetry && (
        <Pressable onPress={onRetry} style={{ padding: 4, marginTop: 2 }}>
          <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '500' }}>Tap to retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const messages = useSelector((state: RootState) => state.chat.messages[id] || []);
  const typingUserIds = useSelector((state: RootState) => state.chat.typing[id] || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const typingUsers = typingUserIds.filter((uid) => uid !== user?.id);

  useEffect(() => {
    socketClient.joinConversation(id);
    const loadMessages = async () => {
      try {
        const result = await api.getMessages(id);
        dispatch(setMessages({ conversationId: id, messages: result.messages }));
        setHasMore(result.hasMore);
      } catch {
        // ok
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
    return () => {
      socketClient.leaveConversation(id);
    };
  }, [id, dispatch]);

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore || messages.length === 0) return;
    setLoading(true);
    try {
      const oldest = messages[0];
      const result = await api.getMessages(id, 50, oldest.createdAt);
      dispatch(prependMessages({ conversationId: id, messages: result.messages }));
      setHasMore(result.hasMore);
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  }, [id, loading, hasMore, messages, dispatch]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    const clientMessageId = Crypto.randomUUID();
    const optimisticMessage: Message = {
      id: clientMessageId,
      conversationId: id,
      senderId: user.id,
      content: trimmed,
      createdAt: new Date().toISOString(),
      status: 'pending',
      clientMessageId,
    };

    dispatch(addMessage(optimisticMessage));
    socketClient.sendMessage(id, trimmed, clientMessageId);
    setText('');

    if (isTyping) {
      setIsTyping(false);
      socketClient.stopTyping(id);
    }

    setTimeout(() => {
      dispatch(updateMessageStatus({ conversationId: id, messageId: clientMessageId, status: 'failed' }));
    }, 10000);
  }, [text, id, user, isTyping, dispatch]);

  const handleRetry = useCallback(
    (message: Message) => {
      if (message.clientMessageId) {
        dispatch(updateMessageStatus({ conversationId: id, messageId: message.clientMessageId, status: 'pending' }));
        socketClient.sendMessage(id, message.content, message.clientMessageId);
      }
    },
    [id, dispatch]
  );

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      if (value.length > 0 && !isTyping) {
        setIsTyping(true);
        socketClient.startTyping(id);
      } else if (value.length === 0 && isTyping) {
        setIsTyping(false);
        socketClient.stopTyping(id);
      }
    },
    [id, isTyping]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === user?.id}
        onRetry={item.status === 'failed' ? () => handleRetry(item) : undefined}
      />
    ),
    [user?.id, handleRetry]
  );

  return (
    <>
      <Stack.Screen options={{ title: name || 'Chat' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#FFF' }}
        behavior="padding"
        keyboardVerticalOffset={94}
      >
        {loading && messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.1}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListFooterComponent={
              loading ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              ) : null
            }
          />
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 4 }}>
            <View
              style={{
                backgroundColor: '#E9E9EB',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                gap: 3,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8E8E93', opacity: 0.6 }} />
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8E8E93', opacity: 0.8 }} />
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8E8E93' }} />
            </View>
          </View>
        )}

        {/* Input bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 12,
            paddingVertical: 8,
            paddingBottom: 12,
            borderTopWidth: 0.5,
            borderTopColor: '#E5E5EA',
            backgroundColor: '#F8F8FA',
            gap: 8,
          }}
        >
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#C7C7CC"
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              minHeight: 36,
              maxHeight: 100,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: '#FFF',
              borderRadius: 20,
              borderCurve: 'continuous',
              fontSize: 16,
              color: '#000',
              borderWidth: 0.5,
              borderColor: '#E5E5EA',
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: text.trim() ? '#007AFF' : '#C7C7CC',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: -1 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
