import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import socketClient from '../services/socketClient';

interface Props {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<Props> = ({ conversationId, onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);

      if (value.length > 0 && !isTyping) {
        setIsTyping(true);
        socketClient.startTyping(conversationId);
      } else if (value.length === 0 && isTyping) {
        setIsTyping(false);
        socketClient.stopTyping(conversationId);
      }
    },
    [conversationId, isTyping]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) return;

    onSend(trimmed);
    setText('');
    setIsTyping(false);
    socketClient.stopTyping(conversationId);
  }, [text, disabled, onSend, conversationId]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleTextChange}
        placeholder="Type a message..."
        placeholderTextColor="#8E8E93"
        multiline
        maxLength={2000}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessageInput;
