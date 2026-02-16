import { ChatService } from '../../../src/services/chatService';

// Mock the database
jest.mock('../../../src/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../../src/db';
const mockQuery = query as jest.Mock;

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create a conversation and add participants', async () => {
      const conversationId = 'conv-123';
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: conversationId, type: 'direct', name: null }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChatService.createConversation('direct', ['user1', 'user2']);

      expect(result.id).toBe(conversationId);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConversationsForUser', () => {
    it('should return conversations with last message and unread count', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'conv-1',
          type: 'direct',
          name: null,
          last_message_content: 'Hello',
          last_message_sender_id: 'user2',
          last_message_created_at: new Date(),
          unread_count: '2',
        }],
      });

      const result = await ChatService.getConversationsForUser('user1');

      expect(result).toHaveLength(1);
      expect(result[0].unreadCount).toBe(2);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages for a conversation', async () => {
      const messages = [
        { id: 'msg-1', content: 'Hello', sender_id: 'user1', created_at: new Date() },
        { id: 'msg-2', content: 'Hi', sender_id: 'user2', created_at: new Date() },
      ];
      mockQuery.mockResolvedValueOnce({ rows: messages });

      const result = await ChatService.getMessages('conv-1', 50);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['conv-1', 50])
      );
    });
  });

  describe('createMessage', () => {
    it('should insert a message and return it', async () => {
      const message = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user1',
        content: 'Hello',
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [message] });

      const result = await ChatService.createMessage('conv-1', 'user1', 'Hello');

      expect(result.content).toBe('Hello');
    });
  });

  describe('isParticipant', () => {
    it('should return true if user is a participant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user1' }] });

      const result = await ChatService.isParticipant('user1', 'conv-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not a participant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await ChatService.isParticipant('user1', 'conv-1');

      expect(result).toBe(false);
    });
  });
});
