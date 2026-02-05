import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message, MessageStatus } from '../types/chat';

interface Props {
  message: Message;
  isOwnMessage: boolean;
  onRetry?: () => void;
}

const StatusIcon: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Text style={styles.statusIcon}>...</Text>;
    case 'sent':
      return <Text style={styles.statusIcon}>✓</Text>;
    case 'delivered':
      return <Text style={styles.statusIcon}>✓✓</Text>;
    case 'read':
      return <Text style={[styles.statusIcon, styles.readIcon]}>✓✓</Text>;
    case 'failed':
      return <Text style={[styles.statusIcon, styles.failedIcon]}>!</Text>;
    default:
      return null;
  }
};

export const MessageBubble: React.FC<Props> = ({ message, isOwnMessage, onRetry }) => {
  const isFailed = message.status === 'failed';

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      <View style={[styles.bubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
        <Text style={[styles.content, isOwnMessage ? styles.ownContent : styles.otherContent]}>
          {message.content}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.time}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {isOwnMessage && <StatusIcon status={message.status} />}
        </View>
      </View>
      {isFailed && onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownContent: {
    color: '#FFFFFF',
  },
  otherContent: {
    color: '#000000',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    color: '#8E8E93',
  },
  statusIcon: {
    fontSize: 12,
    marginLeft: 4,
    color: '#8E8E93',
  },
  readIcon: {
    color: '#007AFF',
  },
  failedIcon: {
    color: '#FF3B30',
  },
  retryButton: {
    marginTop: 4,
    padding: 4,
  },
  retryText: {
    color: '#FF3B30',
    fontSize: 12,
  },
});

export default MessageBubble;
