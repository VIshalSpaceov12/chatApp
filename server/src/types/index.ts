export type ConversationType = 'direct' | 'group' | 'support';
export type ParticipantRole = 'member' | 'trainer' | 'staff' | 'admin';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastReadAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

// Socket event payloads
export interface JoinPayload {
  conversationId: string;
}

export interface MessageSendPayload {
  conversationId: string;
  content: string;
  clientMessageId: string; // For deduplication
}

export interface TypingPayload {
  conversationId: string;
}

export interface MessagesReadPayload {
  conversationId: string;
  timestamp: string;
}

// Socket auth
export interface SocketAuth {
  token: string;
}

export interface DecodedToken {
  userId: string;
  exp: number;
}
