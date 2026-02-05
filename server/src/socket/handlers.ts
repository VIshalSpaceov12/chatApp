import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ChatService } from '../services/chatService';
import { PresenceService } from '../services/presenceService';
import { DecodedToken, MessageSendPayload, JoinPayload, TypingPayload, MessagesReadPayload } from '../types';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

export const setupSocketHandlers = (io: Server) => {
  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as DecodedToken;
      (socket as AuthenticatedSocket).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    console.log(`User ${userId} connected`);

    // Set online presence
    await PresenceService.setOnline(userId, socket.id);

    // Broadcast presence to relevant users
    socket.broadcast.emit('presence:update', { userId, status: 'online' });

    // Join conversation room
    socket.on('join', async ({ conversationId }: JoinPayload) => {
      const isParticipant = await ChatService.isParticipant(userId, conversationId);
      if (!isParticipant) {
        socket.emit('error', { message: 'Forbidden' });
        return;
      }
      socket.join(`conversation:${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave', ({ conversationId }: JoinPayload) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Send message
    socket.on('message:send', async ({ conversationId, content, clientMessageId }: MessageSendPayload) => {
      const isParticipant = await ChatService.isParticipant(userId, conversationId);
      if (!isParticipant) {
        socket.emit('error', { message: 'Forbidden' });
        return;
      }

      // Validate content
      if (!content || content.length > 2000) {
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }

      const message = await ChatService.createMessage(conversationId, userId, content.trim());

      // Acknowledge to sender
      socket.emit('message:ack', { clientMessageId, message });

      // Broadcast to room (excluding sender)
      socket.to(`conversation:${conversationId}`).emit('message:new', message);

      // Clear typing indicator
      await PresenceService.clearTyping(conversationId, userId);
    });

    // Typing start
    socket.on('typing:start', async ({ conversationId }: TypingPayload) => {
      await PresenceService.setTyping(conversationId, userId);
      const typingUsers = await PresenceService.getTypingUsers(conversationId);
      io.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userIds: typingUsers,
      });
    });

    // Typing stop
    socket.on('typing:stop', async ({ conversationId }: TypingPayload) => {
      await PresenceService.clearTyping(conversationId, userId);
      const typingUsers = await PresenceService.getTypingUsers(conversationId);
      io.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userIds: typingUsers,
      });
    });

    // Mark messages as read
    socket.on('messages:read', async ({ conversationId, timestamp }: MessagesReadPayload) => {
      await ChatService.updateLastRead(userId, conversationId);
      socket.to(`conversation:${conversationId}`).emit('messages:read', {
        conversationId,
        userId,
        timestamp,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${userId} disconnected`);
      await PresenceService.setOffline(userId, socket.id);

      // Check if user still has other sockets
      const remainingSockets = await PresenceService.getUserSockets(userId);
      if (remainingSockets.length === 0) {
        socket.broadcast.emit('presence:update', { userId, status: 'offline' });
      }
    });
  });
};
