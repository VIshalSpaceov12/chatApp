import axios, { AxiosInstance } from 'axios';
import { Conversation, Message, User } from '../types';

const API_URL = 'http://172.16.17.94:3001';

class Api {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });
  }

  setToken(token: string) {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
  }

  getToken() {
    return this.token;
  }

  async register(name: string, email: string, role: string): Promise<{ token: string; user: User }> {
    const response = await this.client.post('/auth/register', { name, email, role });
    return response.data;
  }

  async login(email: string): Promise<{ token: string; user: User }> {
    const response = await this.client.post('/auth/login', { email });
    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.client.get('/auth/users/search', { params: { q: query } });
    return response.data;
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
    if (before) params.before = before;
    const response = await this.client.get(
      `/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  }
}

export const api = new Api();
export default api;
