import axios, { AxiosInstance } from 'axios';
import { Conversation, Message } from '../types/chat';

const API_URL = process.env.CHAT_API_URL || 'http://localhost:3001';

class ChatApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  async getChatToken(): Promise<string> {
    const response = await this.client.post('/auth/chat-token');
    return response.data.token;
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await this.client.get('/conversations');
    return response.data;
  }

  async createConversation(
    type: string,
    participantIds: string[],
    name?: string
  ): Promise<Conversation> {
    const response = await this.client.post('/conversations', {
      type,
      participantIds,
      name,
    });
    return response.data;
  }

  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (before) {
      params.before = before;
    }
    const response = await this.client.get(
      `/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  }

  async getPresence(userId: string): Promise<'online' | 'offline'> {
    const response = await this.client.get(`/users/${userId}/presence`);
    return response.data.status;
  }
}

export const chatApi = new ChatApi();
export default chatApi;
