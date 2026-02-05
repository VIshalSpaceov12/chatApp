/* eslint-disable @typescript-eslint/no-explicit-any */
const mockRedisClient = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  sAdd: jest.fn(),
  sRem: jest.fn(),
  sMembers: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
};

jest.mock('../../../src/services/redisClient', () => ({
  __esModule: true,
  default: mockRedisClient,
}));

import { PresenceService } from '../../../src/services/presenceService';

describe('PresenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setOnline', () => {
    it('should set user presence with TTL', async () => {
      await PresenceService.setOnline('user1', 'socket1');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'presence:user1',
        expect.any(String),
        expect.objectContaining({ EX: 30 })
      );
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('user_sockets:user1', 'socket1');
    });
  });

  describe('setOffline', () => {
    it('should remove socket and presence if no sockets remain', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      await PresenceService.setOffline('user1', 'socket1');

      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sockets:user1', 'socket1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('presence:user1');
    });

    it('should not remove presence if other sockets remain', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['socket2']);

      await PresenceService.setOffline('user1', 'socket1');

      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sockets:user1', 'socket1');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('isOnline', () => {
    it('should return true if presence exists', async () => {
      mockRedisClient.get.mockResolvedValue('{"socketId":"socket1"}');

      const result = await PresenceService.isOnline('user1');

      expect(result).toBe(true);
    });

    it('should return false if no presence', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await PresenceService.isOnline('user1');

      expect(result).toBe(false);
    });
  });

  describe('refreshPresence', () => {
    it('should refresh TTL for user presence', async () => {
      await PresenceService.refreshPresence('user1');

      expect(mockRedisClient.expire).toHaveBeenCalledWith('presence:user1', 30);
    });
  });

  describe('setTyping', () => {
    it('should set typing indicator with TTL', async () => {
      await PresenceService.setTyping('conv1', 'user1');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'typing:conv1:user1',
        '1',
        expect.objectContaining({ EX: 3 })
      );
    });
  });

  describe('clearTyping', () => {
    it('should remove typing indicator', async () => {
      await PresenceService.clearTyping('conv1', 'user1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('typing:conv1:user1');
    });
  });

  describe('getTypingUsers', () => {
    it('should return list of typing users', async () => {
      mockRedisClient.keys.mockResolvedValue(['typing:conv1:user1', 'typing:conv1:user2']);

      const result = await PresenceService.getTypingUsers('conv1');

      expect(result).toEqual(['user1', 'user2']);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('typing:conv1:*');
    });

    it('should return empty array if no one is typing', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await PresenceService.getTypingUsers('conv1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserSockets', () => {
    it('should return all sockets for a user', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['socket1', 'socket2']);

      const result = await PresenceService.getUserSockets('user1');

      expect(result).toEqual(['socket1', 'socket2']);
      expect(mockRedisClient.sMembers).toHaveBeenCalledWith('user_sockets:user1');
    });
  });
});
