import { query } from '../db';
import { Conversation, Message, ConversationType, ConversationWithDetails } from '../types';

// Row types from database queries
interface ConversationRow {
  id: string;
  type: ConversationType;
  name: string | null;
  created_at: Date;
  updated_at: Date;
  last_message_content?: string;
  last_message_sender_id?: string;
  last_message_created_at?: Date;
  unread_count: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: Date;
}

export class ChatService {
  static async createConversation(
    type: ConversationType,
    participantIds: string[],
    name?: string
  ): Promise<Conversation> {
    const result = await query(
      `INSERT INTO conversations (type, name) VALUES ($1, $2) RETURNING *`,
      [type, name || null]
    );
    const conversation = result.rows[0];

    // Add participants
    const participantValues = participantIds
      .map((_, i) => `($1, $${i + 2}, 'member')`)
      .join(', ');
    await query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ${participantValues}`,
      [conversation.id, ...participantIds]
    );

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };
  }

  static async getConversationsForUser(userId: string): Promise<ConversationWithDetails[]> {
    const result = await query(
      `SELECT DISTINCT ON (c.id)
        c.id, c.type, c.name, c.created_at, c.updated_at,
        m.content as last_message_content,
        m.sender_id as last_message_sender_id,
        m.created_at as last_message_created_at,
        (
          SELECT COUNT(*) FROM messages
          WHERE conversation_id = c.id
          AND created_at > cp.last_read_at
          AND sender_id != $1
        ) as unread_count
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      LEFT JOIN messages m ON m.conversation_id = c.id
      ORDER BY c.id, m.created_at DESC`,
      [userId]
    );

    return result.rows.map((row: ConversationRow) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      participants: [],
      lastMessage: row.last_message_content
        ? {
            id: '',
            conversationId: row.id,
            senderId: row.last_message_sender_id!,
            content: row.last_message_content,
            createdAt: row.last_message_created_at!,
          }
        : null,
      unreadCount: parseInt(row.unread_count, 10),
    }));
  }

  static async getMessages(
    conversationId: string,
    limit: number,
    before?: Date
  ): Promise<Message[]> {
    const params: unknown[] = [conversationId, limit];
    let whereClause = 'WHERE conversation_id = $1';

    if (before) {
      whereClause += ' AND created_at < $3';
      params.push(before);
    }

    const result = await query(
      `SELECT * FROM messages ${whereClause} ORDER BY created_at DESC LIMIT $2`,
      params
    );

    return result.rows.map((row: MessageRow) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  static async createMessage(
    conversationId: string,
    senderId: string,
    content: string
  ): Promise<Message> {
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, senderId, content]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  static async isParticipant(userId: string, conversationId: string): Promise<boolean> {
    const result = await query(
      `SELECT user_id FROM conversation_participants
       WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return result.rows.length > 0;
  }

  static async updateLastRead(userId: string, conversationId: string): Promise<void> {
    await query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
  }
}
