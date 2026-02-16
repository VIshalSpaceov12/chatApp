export type ConversationType = 'direct' | 'group' | 'support';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  status?: MessageStatus;
  clientMessageId?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Participant {
  userId: string;
  role: string;
  name?: string;
}

export interface TypingUpdate {
  conversationId: string;
  userIds: string[];
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline';
}
