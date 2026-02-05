import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3001';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string): Socket {
    if (this.socket?.connected && this.token === token) {
      return this.socket;
    }

    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Event emitters
  joinConversation(conversationId: string): void {
    this.socket?.emit('join', { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave', { conversationId });
  }

  sendMessage(conversationId: string, content: string, clientMessageId: string): void {
    this.socket?.emit('message:send', { conversationId, content, clientMessageId });
  }

  startTyping(conversationId: string): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  markAsRead(conversationId: string, timestamp: string): void {
    this.socket?.emit('messages:read', { conversationId, timestamp });
  }
}

export const socketClient = new SocketClient();
export default socketClient;
