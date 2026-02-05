import redisClient from './redisClient';

const PRESENCE_TTL = 30; // seconds
const TYPING_TTL = 3; // seconds

export class PresenceService {
  static async setOnline(userId: string, socketId: string): Promise<void> {
    const presence = JSON.stringify({ socketId, lastSeen: Date.now() });
    await redisClient.set(`presence:${userId}`, presence, { EX: PRESENCE_TTL });
    await redisClient.sAdd(`user_sockets:${userId}`, socketId);
  }

  static async setOffline(userId: string, socketId: string): Promise<void> {
    await redisClient.sRem(`user_sockets:${userId}`, socketId);
    const remainingSockets = await redisClient.sMembers(`user_sockets:${userId}`);
    if (remainingSockets.length === 0) {
      await redisClient.del(`presence:${userId}`);
    }
  }

  static async isOnline(userId: string): Promise<boolean> {
    const presence = await redisClient.get(`presence:${userId}`);
    return presence !== null;
  }

  static async refreshPresence(userId: string): Promise<void> {
    await redisClient.expire(`presence:${userId}`, PRESENCE_TTL);
  }

  static async setTyping(conversationId: string, userId: string): Promise<void> {
    await redisClient.set(
      `typing:${conversationId}:${userId}`,
      '1',
      { EX: TYPING_TTL }
    );
  }

  static async clearTyping(conversationId: string, userId: string): Promise<void> {
    await redisClient.del(`typing:${conversationId}:${userId}`);
  }

  static async getTypingUsers(conversationId: string): Promise<string[]> {
    const keys = await redisClient.keys(`typing:${conversationId}:*`);
    return keys.map((key) => key.split(':')[2]);
  }

  static async getUserSockets(userId: string): Promise<string[]> {
    return redisClient.sMembers(`user_sockets:${userId}`);
  }
}
