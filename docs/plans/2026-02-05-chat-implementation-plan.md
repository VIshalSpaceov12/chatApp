# Chat System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time chat system for GymProLuxe with 1:1, group, and support conversations.

**Architecture:** Node.js monolithic server with Express REST API + Socket.io for real-time. PostgreSQL for persistence, Redis for presence/typing. React Native mobile client with Redux state management.

**Tech Stack:** Node.js, Express, Socket.io, PostgreSQL, Redis, TypeScript, React Native, Redux Toolkit

**Design Doc:** `docs/plans/2026-02-05-chat-system-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Project Setup

**Files:**
- Create: `ChatApp/server/package.json`
- Create: `ChatApp/server/tsconfig.json`
- Create: `ChatApp/server/.env.example`
- Create: `ChatApp/server/.gitignore`

**Step 1: Create server directory and initialize npm**

```bash
cd ChatApp && mkdir -p server && cd server
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express socket.io cors helmet dotenv pg redis jsonwebtoken uuid
npm install -D typescript @types/node @types/express @types/cors @types/jsonwebtoken @types/uuid ts-node nodemon jest @types/jest ts-jest
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .env.example**

```
PORT=3001
DATABASE_URL=postgresql://localhost:5432/gympro_chat
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 6: Update package.json scripts**

Add to package.json:
```json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "jest"
}
```

**Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize chat server with TypeScript"
```

---

### Task 2: Database Schema

**Files:**
- Create: `ChatApp/server/src/db/migrations/001_initial_schema.sql`
- Create: `ChatApp/server/src/db/index.ts`

**Step 1: Create migrations directory**

```bash
mkdir -p src/db/migrations
```

**Step 2: Write the migration file**

Create `src/db/migrations/001_initial_schema.sql`:

```sql
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'support')),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('member', 'trainer', 'staff', 'admin')),
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient message pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

-- Index for finding user's conversations
CREATE INDEX IF NOT EXISTS idx_participants_user
ON conversation_participants(user_id);
```

**Step 3: Create database connection module**

Create `src/db/index.ts`:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add database schema and connection"
```

---

### Task 3: TypeScript Types

**Files:**
- Create: `ChatApp/server/src/types/index.ts`

**Step 1: Create types file**

Create `src/types/index.ts`:

```typescript
export type ConversationType = 'direct' | 'group' | 'support';
export type ParticipantRole = 'member' | 'trainer' | 'staff' | 'admin';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastReadAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

// Socket event payloads
export interface JoinPayload {
  conversationId: string;
}

export interface MessageSendPayload {
  conversationId: string;
  content: string;
  clientMessageId: string; // For deduplication
}

export interface TypingPayload {
  conversationId: string;
}

export interface MessagesReadPayload {
  conversationId: string;
  timestamp: string;
}

// Socket auth
export interface SocketAuth {
  token: string;
}

export interface DecodedToken {
  userId: string;
  exp: number;
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 4: Chat Service (Database Operations)

**Files:**
- Create: `ChatApp/server/src/services/chatService.ts`
- Create: `ChatApp/server/tests/unit/services/chatService.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/services/chatService.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

```bash
cd ChatApp/server
npm test -- tests/unit/services/chatService.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement ChatService**

Create `src/services/chatService.ts`:

```typescript
import { query } from '../db';
import { Conversation, Message, ConversationType, ConversationWithDetails } from '../types';

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

    return result.rows.map((row) => ({
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
            senderId: row.last_message_sender_id,
            content: row.last_message_content,
            createdAt: row.last_message_created_at,
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

    return result.rows.map((row) => ({
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
```

**Step 4: Create Jest config**

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- tests/unit/services/chatService.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add ChatService with database operations"
```

---

### Task 5: Presence Service (Redis Operations)

**Files:**
- Create: `ChatApp/server/src/services/presenceService.ts`
- Create: `ChatApp/server/src/services/redisClient.ts`
- Create: `ChatApp/server/tests/unit/services/presenceService.test.ts`

**Step 1: Create Redis client**

Create `src/services/redisClient.ts`:

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export const connectRedis = async () => {
  await redisClient.connect();
};

export default redisClient;
```

**Step 2: Write failing tests**

Create `tests/unit/services/presenceService.test.ts`:

```typescript
import { PresenceService } from '../../../src/services/presenceService';

jest.mock('../../../src/services/redisClient', () => ({
  default: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    expire: jest.fn(),
  },
}));

import redisClient from '../../../src/services/redisClient';
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;

describe('PresenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setOnline', () => {
    it('should set user presence with TTL', async () => {
      await PresenceService.setOnline('user1', 'socket1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user1',
        expect.any(String),
        expect.objectContaining({ EX: 30 })
      );
      expect(mockRedis.sAdd).toHaveBeenCalledWith('user_sockets:user1', 'socket1');
    });
  });

  describe('setOffline', () => {
    it('should remove socket and presence if no sockets remain', async () => {
      (mockRedis.sMembers as jest.Mock).mockResolvedValue([]);

      await PresenceService.setOffline('user1', 'socket1');

      expect(mockRedis.sRem).toHaveBeenCalledWith('user_sockets:user1', 'socket1');
      expect(mockRedis.del).toHaveBeenCalledWith('presence:user1');
    });
  });

  describe('isOnline', () => {
    it('should return true if presence exists', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue('{"socketId":"socket1"}');

      const result = await PresenceService.isOnline('user1');

      expect(result).toBe(true);
    });

    it('should return false if no presence', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);

      const result = await PresenceService.isOnline('user1');

      expect(result).toBe(false);
    });
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npm test -- tests/unit/services/presenceService.test.ts
```

Expected: FAIL (module not found)

**Step 4: Implement PresenceService**

Create `src/services/presenceService.ts`:

```typescript
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
    // This is a simplified version - in production, use SCAN
    const keys = await redisClient.keys(`typing:${conversationId}:*`);
    return keys.map((key) => key.split(':')[2]);
  }

  static async getUserSockets(userId: string): Promise<string[]> {
    return redisClient.sMembers(`user_sockets:${userId}`);
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- tests/unit/services/presenceService.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add PresenceService for online status and typing"
```

---

### Task 6: Express Server & REST API

**Files:**
- Create: `ChatApp/server/src/index.ts`
- Create: `ChatApp/server/src/routes/conversations.ts`
- Create: `ChatApp/server/src/routes/auth.ts`
- Create: `ChatApp/server/src/middleware/auth.ts`

**Step 1: Create auth middleware**

Create `src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DecodedToken } from '../types';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as DecodedToken;
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Step 2: Create auth routes**

Create `src/routes/auth.ts`:

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate chat-specific token (called by main app after auth)
router.post('/chat-token', authMiddleware, (req: AuthRequest, res) => {
  const chatToken = jwt.sign(
    { userId: req.userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '5m' }
  );

  res.json({ token: chatToken });
});

export default router;
```

**Step 3: Create conversation routes**

Create `src/routes/conversations.ts`:

```typescript
import { Router, Response } from 'express';
import { ChatService } from '../services/chatService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// List user's conversations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await ChatService.getConversationsForUser(req.userId!);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create conversation
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, participantIds, name } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    // Ensure creator is a participant
    const allParticipants = [...new Set([req.userId!, ...participantIds])];

    const conversation = await ChatService.createConversation(
      type,
      allParticipants,
      name
    );
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { before, limit = '50' } = req.query;

    // Verify user is participant
    const isParticipant = await ChatService.isParticipant(req.userId!, id);
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const messages = await ChatService.getMessages(
      id,
      parseInt(limit as string, 10),
      before ? new Date(before as string) : undefined
    );

    res.json({
      messages,
      hasMore: messages.length === parseInt(limit as string, 10),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
```

**Step 4: Create main server entry point**

Create `src/index.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/conversations', conversationRoutes);

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});

export { app, httpServer };
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Express server with REST API routes"
```

---

### Task 7: Socket.io Server

**Files:**
- Create: `ChatApp/server/src/socket/index.ts`
- Create: `ChatApp/server/src/socket/handlers.ts`
- Modify: `ChatApp/server/src/index.ts`

**Step 1: Create socket handlers**

Create `src/socket/handlers.ts`:

```typescript
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
```

**Step 2: Create socket initialization**

Create `src/socket/index.ts`:

```typescript
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './handlers';

export const initializeSocket = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Configure appropriately for production
      methods: ['GET', 'POST'],
    },
  });

  setupSocketHandlers(io);

  return io;
};
```

**Step 3: Update index.ts to include Socket.io**

Update `src/index.ts` - add after httpServer creation:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import { initializeSocket } from './socket';
import { connectRedis } from './services/redisClient';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/conversations', conversationRoutes);

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

const start = async () => {
  await connectRedis();
  httpServer.listen(PORT, () => {
    console.log(`Chat server running on port ${PORT}`);
  });
};

start();

export { app, httpServer, io };
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Socket.io server with real-time handlers"
```

---

## Phase 2: Mobile Client

### Task 8: Mobile Project Setup

**Files:**
- Create: `ChatApp/mobile/package.json`
- Create: `ChatApp/mobile/tsconfig.json`
- Create: `ChatApp/mobile/src/chat/types/chat.ts`

**Step 1: Create mobile directory structure**

```bash
cd ChatApp
mkdir -p mobile/src/chat/{components,hooks,services,types}
cd mobile
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install socket.io-client axios
npm install -D typescript @types/node
```

**Step 3: Create TypeScript types**

Create `src/chat/types/chat.ts`:

```typescript
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
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: initialize mobile chat module with types"
```

---

### Task 9: Socket Client Service

**Files:**
- Create: `ChatApp/mobile/src/chat/services/socketClient.ts`

**Step 1: Create socket client singleton**

Create `src/chat/services/socketClient.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add socket client service for real-time communication"
```

---

### Task 10: Chat API Service

**Files:**
- Create: `ChatApp/mobile/src/chat/services/chatApi.ts`

**Step 1: Create REST API service**

Create `src/chat/services/chatApi.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add chat REST API service"
```

---

### Task 11: Redux Chat Slice

**Files:**
- Create: `ChatApp/mobile/src/chat/redux/chatSlice.ts`

**Step 1: Create Redux slice**

Create `src/chat/redux/chatSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Conversation, Message, TypingUpdate, PresenceUpdate } from '../types/chat';

const initialState: ChatState = {
  conversations: {},
  messages: {},
  typing: {},
  presence: {},
  activeConversationId: null,
  isConnected: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },

    setConversations(state, action: PayloadAction<Conversation[]>) {
      action.payload.forEach((conv) => {
        state.conversations[conv.id] = conv;
      });
    },

    addConversation(state, action: PayloadAction<Conversation>) {
      state.conversations[action.payload.id] = action.payload;
    },

    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },

    setMessages(state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) {
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
    },

    prependMessages(state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) {
      const { conversationId, messages } = action.payload;
      const existing = state.messages[conversationId] || [];
      state.messages[conversationId] = [...messages, ...existing];
    },

    addMessage(state, action: PayloadAction<Message>) {
      const { conversationId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(action.payload);

      // Update conversation's last message
      if (state.conversations[conversationId]) {
        state.conversations[conversationId].lastMessage = action.payload;
      }
    },

    updateMessageStatus(
      state,
      action: PayloadAction<{ conversationId: string; messageId: string; status: Message['status'] }>
    ) {
      const { conversationId, messageId, status } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const message = messages.find((m) => m.id === messageId || m.clientMessageId === messageId);
        if (message) {
          message.status = status;
        }
      }
    },

    confirmMessage(
      state,
      action: PayloadAction<{ clientMessageId: string; message: Message }>
    ) {
      const { clientMessageId, message } = action.payload;
      const messages = state.messages[message.conversationId];
      if (messages) {
        const index = messages.findIndex((m) => m.clientMessageId === clientMessageId);
        if (index !== -1) {
          messages[index] = { ...message, status: 'sent' };
        }
      }
    },

    setTyping(state, action: PayloadAction<TypingUpdate>) {
      const { conversationId, userIds } = action.payload;
      state.typing[conversationId] = userIds;
    },

    setPresence(state, action: PayloadAction<PresenceUpdate>) {
      const { userId, status } = action.payload;
      state.presence[userId] = status;
    },

    clearUnreadCount(state, action: PayloadAction<string>) {
      const conversationId = action.payload;
      if (state.conversations[conversationId]) {
        state.conversations[conversationId].unreadCount = 0;
      }
    },

    resetChat() {
      return initialState;
    },
  },
});

export const {
  setConnected,
  setConversations,
  addConversation,
  setActiveConversation,
  setMessages,
  prependMessages,
  addMessage,
  updateMessageStatus,
  confirmMessage,
  setTyping,
  setPresence,
  clearUnreadCount,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add Redux chat slice for state management"
```

---

### Task 12: useSocket Hook

**Files:**
- Create: `ChatApp/mobile/src/chat/hooks/useSocket.ts`

**Step 1: Create useSocket hook**

Create `src/chat/hooks/useSocket.ts`:

```typescript
import { useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import socketClient from '../services/socketClient';
import chatApi from '../services/chatApi';
import {
  setConnected,
  addMessage,
  confirmMessage,
  setTyping,
  setPresence,
} from '../redux/chatSlice';
import { Message, TypingUpdate, PresenceUpdate } from '../types/chat';

export const useSocket = (mainAppToken: string | null) => {
  const dispatch = useDispatch();
  const tokenRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
    if (!mainAppToken) return;

    try {
      // Get chat-specific token
      chatApi.setAuthToken(mainAppToken);
      const chatToken = await chatApi.getChatToken();

      // Connect socket
      const socket = socketClient.connect(chatToken);
      tokenRef.current = chatToken;

      socket.on('connect', () => {
        dispatch(setConnected(true));
      });

      socket.on('disconnect', () => {
        dispatch(setConnected(false));
      });

      socket.on('message:new', (message: Message) => {
        dispatch(addMessage(message));
      });

      socket.on('message:ack', ({ clientMessageId, message }: { clientMessageId: string; message: Message }) => {
        dispatch(confirmMessage({ clientMessageId, message }));
      });

      socket.on('typing:update', (update: TypingUpdate) => {
        dispatch(setTyping(update));
      });

      socket.on('presence:update', (update: PresenceUpdate) => {
        dispatch(setPresence(update));
      });

      socket.on('connect_error', async (error) => {
        console.error('Socket connection error:', error);
        // Try to refresh token
        if (error.message === 'Invalid token') {
          try {
            const newToken = await chatApi.getChatToken();
            socketClient.disconnect();
            socketClient.connect(newToken);
          } catch {
            console.error('Failed to refresh chat token');
          }
        }
      });
    } catch (error) {
      console.error('Failed to connect to chat:', error);
    }
  }, [mainAppToken, dispatch]);

  const disconnect = useCallback(() => {
    socketClient.disconnect();
    dispatch(setConnected(false));
  }, [dispatch]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected: socketClient.isConnected(),
    reconnect: connect,
    disconnect,
  };
};

export default useSocket;
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add useSocket hook for socket lifecycle management"
```

---

### Task 13: useMessages Hook

**Files:**
- Create: `ChatApp/mobile/src/chat/hooks/useMessages.ts`

**Step 1: Create useMessages hook**

Create `src/chat/hooks/useMessages.ts`:

```typescript
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import socketClient from '../services/socketClient';
import chatApi from '../services/chatApi';
import {
  setMessages,
  prependMessages,
  addMessage,
  updateMessageStatus,
} from '../redux/chatSlice';
import { Message } from '../types/chat';

interface RootState {
  chat: {
    messages: Record<string, Message[]>;
    activeConversationId: string | null;
  };
}

export const useMessages = (conversationId: string) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const messages = useSelector(
    (state: RootState) => state.chat.messages[conversationId] || []
  );

  const loadMessages = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const result = await chatApi.getMessages(conversationId);
      dispatch(setMessages({ conversationId, messages: result.messages }));
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, dispatch]);

  const loadMoreMessages = useCallback(async () => {
    if (loading || !hasMore || messages.length === 0) return;
    setLoading(true);

    try {
      const oldestMessage = messages[0];
      const result = await chatApi.getMessages(
        conversationId,
        50,
        oldestMessage.createdAt
      );
      dispatch(prependMessages({ conversationId, messages: result.messages }));
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, hasMore, messages, dispatch]);

  const sendMessage = useCallback(
    (content: string, senderId: string) => {
      const clientMessageId = uuidv4();
      const optimisticMessage: Message = {
        id: clientMessageId,
        conversationId,
        senderId,
        content,
        createdAt: new Date().toISOString(),
        status: 'pending',
        clientMessageId,
      };

      // Optimistic update
      dispatch(addMessage(optimisticMessage));

      // Send via socket
      socketClient.sendMessage(conversationId, content, clientMessageId);

      // Set timeout for failure detection
      setTimeout(() => {
        dispatch(
          updateMessageStatus({
            conversationId,
            messageId: clientMessageId,
            status: 'failed',
          })
        );
      }, 10000);
    },
    [conversationId, dispatch]
  );

  const retryMessage = useCallback(
    (message: Message) => {
      if (message.clientMessageId) {
        dispatch(
          updateMessageStatus({
            conversationId,
            messageId: message.clientMessageId,
            status: 'pending',
          })
        );
        socketClient.sendMessage(
          conversationId,
          message.content,
          message.clientMessageId
        );
      }
    },
    [conversationId, dispatch]
  );

  return {
    messages,
    loading,
    hasMore,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    retryMessage,
  };
};

export default useMessages;
```

**Step 2: Install uuid**

```bash
npm install uuid
npm install -D @types/uuid
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add useMessages hook for message operations"
```

---

### Task 14: Basic UI Components

**Files:**
- Create: `ChatApp/mobile/src/chat/components/MessageBubble.tsx`
- Create: `ChatApp/mobile/src/chat/components/MessageInput.tsx`
- Create: `ChatApp/mobile/src/chat/components/TypingIndicator.tsx`
- Create: `ChatApp/mobile/src/chat/components/PresenceDot.tsx`

**Step 1: Create MessageBubble**

Create `src/chat/components/MessageBubble.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message, MessageStatus } from '../types/chat';

interface Props {
  message: Message;
  isOwnMessage: boolean;
  onRetry?: () => void;
}

const StatusIcon: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Text style={styles.statusIcon}>🕐</Text>;
    case 'sent':
      return <Text style={styles.statusIcon}>✓</Text>;
    case 'delivered':
      return <Text style={styles.statusIcon}>✓✓</Text>;
    case 'read':
      return <Text style={[styles.statusIcon, styles.readIcon]}>✓✓</Text>;
    case 'failed':
      return <Text style={[styles.statusIcon, styles.failedIcon]}>!</Text>;
    default:
      return null;
  }
};

export const MessageBubble: React.FC<Props> = ({ message, isOwnMessage, onRetry }) => {
  const isFailed = message.status === 'failed';

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      <View style={[styles.bubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
        <Text style={[styles.content, isOwnMessage ? styles.ownContent : styles.otherContent]}>
          {message.content}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.time}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {isOwnMessage && <StatusIcon status={message.status} />}
        </View>
      </View>
      {isFailed && onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownContent: {
    color: '#FFFFFF',
  },
  otherContent: {
    color: '#000000',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    color: '#8E8E93',
  },
  statusIcon: {
    fontSize: 12,
    marginLeft: 4,
    color: '#8E8E93',
  },
  readIcon: {
    color: '#007AFF',
  },
  failedIcon: {
    color: '#FF3B30',
  },
  retryButton: {
    marginTop: 4,
    padding: 4,
  },
  retryText: {
    color: '#FF3B30',
    fontSize: 12,
  },
});

export default MessageBubble;
```

**Step 2: Create MessageInput**

Create `src/chat/components/MessageInput.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import socketClient from '../services/socketClient';

interface Props {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<Props> = ({ conversationId, onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);

      if (value.length > 0 && !isTyping) {
        setIsTyping(true);
        socketClient.startTyping(conversationId);
      } else if (value.length === 0 && isTyping) {
        setIsTyping(false);
        socketClient.stopTyping(conversationId);
      }
    },
    [conversationId, isTyping]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) return;

    onSend(trimmed);
    setText('');
    setIsTyping(false);
    socketClient.stopTyping(conversationId);
  }, [text, disabled, onSend, conversationId]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleTextChange}
        placeholder="Type a message..."
        placeholderTextColor="#8E8E93"
        multiline
        maxLength={2000}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const Text = require('react-native').Text;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessageInput;
```

**Step 3: Create TypingIndicator**

Create `src/chat/components/TypingIndicator.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  userNames: string[];
}

export const TypingIndicator: React.FC<Props> = ({ userNames }) => {
  if (userNames.length === 0) return null;

  const text =
    userNames.length === 1
      ? `${userNames[0]} is typing...`
      : userNames.length === 2
      ? `${userNames[0]} and ${userNames[1]} are typing...`
      : `${userNames[0]} and ${userNames.length - 1} others are typing...`;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
    marginHorizontal: 2,
  },
  text: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
```

**Step 4: Create PresenceDot**

Create `src/chat/components/PresenceDot.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  isOnline: boolean;
  size?: number;
}

export const PresenceDot: React.FC<Props> = ({ isOnline, size = 10 }) => {
  return (
    <View
      style={[
        styles.dot,
        isOnline ? styles.online : styles.offline,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  online: {
    backgroundColor: '#34C759',
  },
  offline: {
    backgroundColor: '#8E8E93',
  },
});

export default PresenceDot;
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add basic chat UI components"
```

---

### Task 15: ChatRoom Screen

**Files:**
- Create: `ChatApp/mobile/src/chat/components/ChatRoom.tsx`

**Step 1: Create ChatRoom component**

Create `src/chat/components/ChatRoom.tsx`:

```tsx
import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import socketClient from '../services/socketClient';
import { useMessages } from '../hooks/useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { Message } from '../types/chat';

interface RootState {
  chat: {
    typing: Record<string, string[]>;
  };
}

interface Props {
  conversationId: string;
  currentUserId: string;
  participantNames?: Record<string, string>;
}

export const ChatRoom: React.FC<Props> = ({
  conversationId,
  currentUserId,
  participantNames = {},
}) => {
  const {
    messages,
    loading,
    hasMore,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    retryMessage,
  } = useMessages(conversationId);

  const typingUserIds = useSelector(
    (state: RootState) => state.chat.typing[conversationId] || []
  );

  const typingUserNames = typingUserIds
    .filter((id) => id !== currentUserId)
    .map((id) => participantNames[id] || 'Someone');

  useEffect(() => {
    socketClient.joinConversation(conversationId);
    loadMessages();

    return () => {
      socketClient.leaveConversation(conversationId);
    };
  }, [conversationId, loadMessages]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, currentUserId);
    },
    [sendMessage, currentUserId]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwnMessage={item.senderId === currentUserId}
        onRetry={item.status === 'failed' ? () => retryMessage(item) : undefined}
      />
    ),
    [currentUserId, retryMessage]
  );

  const renderFooter = useCallback(() => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" />
      </View>
    );
  }, [loading]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) {
      loadMoreMessages();
    }
  }, [hasMore, loading, loadMoreMessages]);

  return (
    <View style={styles.container}>
      <FlatList
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
      <TypingIndicator userNames={typingUserNames} />
      <MessageInput
        conversationId={conversationId}
        onSend={handleSend}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
});

export default ChatRoom;
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add ChatRoom screen component"
```

---

### Task 16: ChatList Screen

**Files:**
- Create: `ChatApp/mobile/src/chat/components/ChatList.tsx`
- Create: `ChatApp/mobile/src/chat/components/ChatListItem.tsx`

**Step 1: Create ChatListItem**

Create `src/chat/components/ChatListItem.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Conversation } from '../types/chat';
import PresenceDot from './PresenceDot';

interface Props {
  conversation: Conversation;
  isOnline?: boolean;
  onPress: () => void;
}

export const ChatListItem: React.FC<Props> = ({ conversation, isOnline, onPress }) => {
  const displayName = conversation.name || 'Conversation';
  const lastMessage = conversation.lastMessage;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
        {isOnline !== undefined && (
          <View style={styles.presenceWrapper}>
            <PresenceDot isOnline={isOnline} size={12} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          {lastMessage && (
            <Text style={styles.time}>
              {new Date(lastMessage.createdAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {lastMessage?.content || 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  presenceWrapper: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  nameUnread: {
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  previewUnread: {
    color: '#000000',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ChatListItem;
```

**Step 2: Create ChatList**

Create `src/chat/components/ChatList.tsx`:

```tsx
import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import chatApi from '../services/chatApi';
import { setConversations } from '../redux/chatSlice';
import ChatListItem from './ChatListItem';
import { Conversation } from '../types/chat';

interface RootState {
  chat: {
    conversations: Record<string, Conversation>;
    presence: Record<string, 'online' | 'offline'>;
  };
}

interface Props {
  onSelectConversation: (conversationId: string) => void;
}

export const ChatList: React.FC<Props> = ({ onSelectConversation }) => {
  const dispatch = useDispatch();
  const conversations = useSelector((state: RootState) =>
    Object.values(state.chat.conversations).sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.createdAt;
      const bTime = b.lastMessage?.createdAt || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
  );
  const presence = useSelector((state: RootState) => state.chat.presence);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.getConversations();
      dispatch(setConversations(data));
    } catch (err) {
      setError('Failed to load conversations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const getOnlineStatus = useCallback(
    (conversation: Conversation) => {
      if (conversation.type !== 'direct') return undefined;
      const otherParticipant = conversation.participants.find(
        (p) => p.role !== 'member'
      );
      if (!otherParticipant) return undefined;
      return presence[otherParticipant.userId] === 'online';
    },
    [presence]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ChatListItem
        conversation={item}
        isOnline={getOnlineStatus(item)}
        onPress={() => onSelectConversation(item.id)}
      />
    ),
    [getOnlineStatus, onSelectConversation]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No conversations yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={styles.list}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
});

export default ChatList;
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add ChatList and ChatListItem components"
```

---

## Phase 3: Integration & Testing

### Task 17: Integration Test Setup

**Files:**
- Create: `ChatApp/server/tests/integration/socket.test.ts`

**Step 1: Write socket integration test**

Create `tests/integration/socket.test.ts`:

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { setupSocketHandlers } from '../../src/socket/handlers';

describe('Socket.io Integration', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  const port = 3002;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    setupSocketHandlers(io);
    httpServer.listen(port, done);
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach(() => {
    const token1 = jwt.sign({ userId: 'user1' }, process.env.JWT_SECRET || 'secret');
    const token2 = jwt.sign({ userId: 'user2' }, process.env.JWT_SECRET || 'secret');

    clientSocket1 = ioc(`http://localhost:${port}`, {
      auth: { token: token1 },
      transports: ['websocket'],
    });

    clientSocket2 = ioc(`http://localhost:${port}`, {
      auth: { token: token2 },
      transports: ['websocket'],
    });
  });

  afterEach(() => {
    clientSocket1.close();
    clientSocket2.close();
  });

  it('should connect with valid token', (done) => {
    clientSocket1.on('connect', () => {
      expect(clientSocket1.connected).toBe(true);
      done();
    });
  });

  it('should reject connection without token', (done) => {
    const invalidSocket = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    invalidSocket.on('connect_error', (error) => {
      expect(error.message).toBe('Authentication required');
      invalidSocket.close();
      done();
    });
  });

  it('should broadcast presence on connect', (done) => {
    clientSocket1.on('presence:update', (data) => {
      expect(data.userId).toBe('user2');
      expect(data.status).toBe('online');
      done();
    });

    clientSocket1.on('connect', () => {
      // User2 connects after user1
    });
  });
});
```

**Step 2: Commit**

```bash
git add .
git commit -m "test: add socket integration tests"
```

---

### Task 18: Export Module Index

**Files:**
- Create: `ChatApp/mobile/src/chat/index.ts`

**Step 1: Create module export**

Create `src/chat/index.ts`:

```typescript
// Components
export { default as ChatRoom } from './components/ChatRoom';
export { default as ChatList } from './components/ChatList';
export { default as ChatListItem } from './components/ChatListItem';
export { default as MessageBubble } from './components/MessageBubble';
export { default as MessageInput } from './components/MessageInput';
export { default as TypingIndicator } from './components/TypingIndicator';
export { default as PresenceDot } from './components/PresenceDot';

// Hooks
export { default as useSocket } from './hooks/useSocket';
export { default as useMessages } from './hooks/useMessages';

// Services
export { default as chatApi } from './services/chatApi';
export { default as socketClient } from './services/socketClient';

// Redux
export { default as chatReducer } from './redux/chatSlice';
export * from './redux/chatSlice';

// Types
export * from './types/chat';
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add module index for clean exports"
```

---

### Task 19: Final Documentation

**Files:**
- Create: `ChatApp/README.md`

**Step 1: Create README**

Create `README.md`:

```markdown
# GymProLuxe Chat System

Real-time chat system for the GymProLuxe fitness app.

## Architecture

- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL (messages) + Redis (presence)
- **Mobile**: React Native + Redux Toolkit

## Quick Start

### Backend

```bash
cd server
cp .env.example .env
# Edit .env with your database credentials
npm install
npm run dev
```

### Database Setup

```bash
psql -U postgres -d gympro_chat -f src/db/migrations/001_initial_schema.sql
```

### Mobile

The chat module is in `mobile/src/chat/`. Import into your GymProLuxe app:

```typescript
import { ChatList, ChatRoom, useSocket, chatReducer } from './chat';

// Add chatReducer to your Redux store
// Use useSocket hook in your app root
// Navigate between ChatList and ChatRoom screens
```

## Documentation

- Design: `docs/plans/2026-02-05-chat-system-design.md`
- Implementation: `docs/plans/2026-02-05-chat-implementation-plan.md`
```

**Step 2: Commit**

```bash
git add .
git commit -m "docs: add project README"
```

---

## Summary

**Total Tasks: 19**

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 1-7 | Backend foundation (server, DB, services, API, sockets) |
| Phase 2 | 8-16 | Mobile client (types, services, Redux, hooks, components) |
| Phase 3 | 17-19 | Integration tests, exports, documentation |

**Key Commands:**
- Backend dev: `cd ChatApp/server && npm run dev`
- Backend test: `cd ChatApp/server && npm test`
- Run migrations: `psql -d gympro_chat -f src/db/migrations/001_initial_schema.sql`

**Dependencies to install:**
- Server: express, socket.io, pg, redis, jsonwebtoken, cors, helmet, dotenv
- Mobile: socket.io-client, axios, uuid, @reduxjs/toolkit
