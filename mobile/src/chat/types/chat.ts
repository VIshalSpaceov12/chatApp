export type ConversationType = 'direct' | 'group' | 'support';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

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
  avatar?: string;
}

export interface TypingUpdate {
  conversationId: string;
  userIds: string[];
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline';
}

export interface ChatState {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  typing: Record<string, string[]>;
  presence: Record<string, 'online' | 'offline'>;
  activeConversationId: string | null;
  isConnected: boolean;
}
