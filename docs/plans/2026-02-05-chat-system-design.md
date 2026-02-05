# GymProLuxe Chat System Design

**Date:** 2026-02-05
**Status:** Approved

## Overview

Real-time chat system for GymProLuxe fitness app supporting:
- Member ↔ Personal Trainer (1:1 coaching)
- Member ↔ Gym Staff (support)
- Group chats (classes/training groups)

### Requirements

- Instant message delivery via WebSockets
- Typing indicators
- Online/offline presence
- Read receipts
- Persistent message history (forever)
- Text messages only (media support deferred)

### Technology Stack

- **Backend:** Node.js (Express + Socket.io)
- **Database:** PostgreSQL (messages, conversations)
- **Cache/Presence:** Redis
- **Push Notifications:** Firebase Cloud Messaging (existing)
- **Mobile:** React Native (existing GymProLuxe app)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App (React Native)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat UI     │  │ Socket.io   │  │ REST Client         │  │
│  │ Components  │  │ Client      │  │ (Auth, History)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Chat Server (Node.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Socket.io   │  │ Express     │  │ Services            │  │
│  │ Gateway     │  │ REST API    │  │ (Chat, Presence)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Postgres │  │  Redis   │  │ Firebase │
        │ Messages │  │ Presence │  │   Push   │
        └──────────┘  └──────────┘  └──────────┘
```

**Component Responsibilities:**
- **PostgreSQL:** Persistent message storage, conversation metadata, user-conversation mappings
- **Redis:** Online/offline status, typing indicators, Socket.io adapter for future scaling
- **Firebase Cloud Messaging:** Push notifications when users are offline

---

## Data Model

### PostgreSQL Schema

```sql
-- Conversations (1:1, group, or support)
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'support')),
    name            VARCHAR(255),  -- nullable, for groups only
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Participants in each conversation
CREATE TABLE conversation_participants (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,  -- References main app users table
    role            VARCHAR(20) NOT NULL CHECK (role IN ('member', 'trainer', 'staff', 'admin')),
    joined_at       TIMESTAMP DEFAULT NOW(),
    last_read_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Index for efficient message pagination
CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);
```

### Redis Structures

```
# Online presence (expires automatically)
presence:{user_id} = { socketId, lastSeen }  TTL: 30s

# Typing indicators (short-lived)
typing:{conversation_id}:{user_id} = 1  TTL: 3s

# Active socket mappings
socket:{socket_id} = { userId, conversationIds[] }
user_sockets:{user_id} = SET of socket_ids
```

**Key Decisions:**
- `last_read_at` on participants enables read receipts without a separate table
- Messages indexed by `(conversation_id, created_at)` for efficient history pagination
- Redis TTLs auto-clean stale presence/typing data

---

## Real-Time Events & Socket Protocol

### Client → Server Events

```typescript
// Connect with auth
socket.auth = { token: 'jwt_token' }

// Join conversation room (on opening a chat)
socket.emit('join', { conversationId })

// Leave conversation room (on closing a chat)
socket.emit('leave', { conversationId })

// Send a message
socket.emit('message:send', { conversationId, content })

// Typing indicator
socket.emit('typing:start', { conversationId })
socket.emit('typing:stop', { conversationId })

// Mark messages as read
socket.emit('messages:read', { conversationId, timestamp })
```

### Server → Client Events

```typescript
// New message received
socket.on('message:new', { id, conversationId, senderId, content, createdAt })

// Someone is typing
socket.on('typing:update', { conversationId, userIds: [] })

// Read receipt update
socket.on('messages:read', { conversationId, userId, timestamp })

// Presence changes
socket.on('presence:update', { userId, status: 'online' | 'offline' })
```

### Room Strategy

- Each conversation is a Socket.io room: `conversation:{id}`
- On `join`, user subscribes to that room's events
- Messages broadcast to room (excluding sender)
- Typing indicators broadcast to room (excluding self)
- Offline users receive push notifications via Firebase

---

## REST API Endpoints

```
POST   /auth/chat-token
       → Returns short-lived JWT for socket auth

GET    /conversations
       → List user's conversations (with last message preview)
       → Response: [{ id, type, name, participants, lastMessage, unreadCount }]

POST   /conversations
       → Create new conversation
       → Body: { type, participantIds[], name? }

GET    /conversations/:id
       → Conversation details + participant list

GET    /conversations/:id/messages
       → Paginated message history
       → Query: ?before={timestamp}&limit=50
       → Response: { messages[], hasMore }

GET    /users/:id/presence
       → Check if specific user is online
```

### Pagination Strategy

- Messages load newest-first with cursor-based pagination
- Initial load: latest 50 messages
- Scroll up: fetch `?before={oldestMessageTimestamp}&limit=50`
- Scales well regardless of conversation length

### Authentication Flow

1. User authenticates with main GymProLuxe API
2. Main API issues a short-lived chat token (5 min expiry)
3. Chat token used for both REST and Socket.io auth
4. Socket connection refreshes token automatically before expiry

---

## Mobile App Architecture

### Folder Structure

```
ChatApp/
└── src/
    └── chat/
        ├── components/
        │   ├── ChatList.tsx          # List of conversations
        │   ├── ChatListItem.tsx      # Single conversation preview
        │   ├── ChatRoom.tsx          # Active conversation view
        │   ├── MessageBubble.tsx     # Single message
        │   ├── MessageInput.tsx      # Text input + send button
        │   ├── TypingIndicator.tsx   # "John is typing..."
        │   └── PresenceDot.tsx       # Online/offline indicator
        ├── hooks/
        │   ├── useSocket.ts          # Socket connection management
        │   ├── usePresence.ts        # Online status tracking
        │   └── useMessages.ts        # Message state + pagination
        ├── services/
        │   ├── chatApi.ts            # REST API calls
        │   └── socketClient.ts       # Socket.io singleton
        └── types/
            └── chat.ts               # TypeScript interfaces
```

### State Management (Redux)

```typescript
chatSlice
├── conversations: Record<id, Conversation>
├── messages: Record<conversationId, Message[]>
├── typing: Record<conversationId, userId[]>
├── presence: Record<userId, 'online' | 'offline'>
└── activeConversationId: string | null
```

**Socket ↔ Redux Bridge:** Socket events dispatch Redux actions. Components subscribe to slices.

### Offline Support

- Messages queued locally when offline (AsyncStorage)
- On reconnect: flush queue, then sync missed messages via REST
- NetInfo detects connectivity changes

---

## Error Handling & Edge Cases

### Connection Lifecycle

```typescript
socket.on('connect', () => {
  // Re-join active conversation rooms
  // Sync any queued offline messages
  // Refresh presence for open chats
})

socket.on('disconnect', (reason) => {
  // Show "Reconnecting..." banner in UI
  // Queue outgoing messages locally
})

socket.on('connect_error', (error) => {
  // Token expired? Refresh and retry
  // Server down? Show offline mode
})
```

### Message Delivery States

| Status | Meaning | UI |
|--------|---------|-----|
| `pending` | Queued locally, not sent yet | Gray clock icon |
| `sent` | Server acknowledged receipt | Single checkmark |
| `delivered` | Recipient's device received | Double checkmark |
| `read` | Recipient opened conversation | Blue checkmarks |
| `failed` | Send failed after retries | Red "Retry" button |

### Edge Cases Handled

- **Duplicate messages:** Server deduplicates by client-generated UUID
- **Out-of-order delivery:** Sort by `createdAt` on client, not arrival order
- **Token expiry mid-session:** Socket middleware rejects → client refreshes → auto-reconnects
- **User on multiple devices:** `user_sockets` Redis set tracks all, broadcasts to all

---

## Security Considerations

### Authentication & Authorization

```typescript
// Socket middleware - runs on every connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  try {
    const user = verifyJWT(token)
    socket.userId = user.id
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

// Room join authorization
socket.on('join', async ({ conversationId }) => {
  const isMember = await isParticipant(socket.userId, conversationId)
  if (!isMember) return socket.emit('error', 'Forbidden')
  socket.join(`conversation:${conversationId}`)
})
```

### Security Rules

| Rule | Implementation |
|------|----------------|
| Users can only read their conversations | Check `conversation_participants` on every query |
| Users can only send to their conversations | Validate membership before `message:send` |
| Rate limiting | 10 messages/second per user (Redis counter) |
| Input sanitization | Strip HTML, limit message length (2000 chars) |
| No PII in logs | Log conversation IDs, not message content |

### Token Strategy

- Chat tokens are short-lived (5 minutes)
- Separate from main app JWT - limits blast radius
- Socket refreshes token proactively before expiry

---

## Testing Strategy

### Backend Tests

```
tests/
├── unit/
│   ├── services/chatService.test.ts
│   ├── services/presenceService.test.ts
│   └── validators/message.test.ts
├── integration/
│   ├── socket.test.ts
│   ├── api.test.ts
│   └── database.test.ts
└── e2e/
    └── chatFlow.test.ts
```

**Key Test Scenarios:**
- Message persists and broadcasts to room members
- Typing indicator appears/disappears with TTL
- Offline user receives message on reconnect
- Read receipts update for all participants

### Mobile Tests

```
__tests__/
├── components/
│   ├── MessageBubble.test.tsx
│   ├── ChatList.test.tsx
│   └── TypingIndicator.test.tsx
└── hooks/
    ├── useSocket.test.ts
    └── useMessages.test.ts
```

---

## Scaling Path

### Phase 1: Launch (Current Design)

```
Single Node.js server → PostgreSQL + Redis
```
- Handles ~1,000 concurrent connections
- Good for initial launch and validation

### Phase 2: Multiple Instances (~5k+ users)

```
Load Balancer
    ├── Node.js Instance 1 ──┐
    ├── Node.js Instance 2 ──┼── Redis Adapter (pub/sub)
    └── Node.js Instance 3 ──┘
```
- Add `socket.io-redis` adapter
- Sticky sessions via load balancer

### Phase 3: High Scale (~50k+ users)

```
├── API Gateway (rate limiting, auth)
├── Chat Service (message handling)
├── Presence Service (dedicated Redis cluster)
└── Push Service (notification queue)
```

### Scaling Triggers

| Signal | Action |
|--------|--------|
| CPU > 70% sustained | Add instances + Redis adapter |
| Message latency > 200ms | Profile queries, add indexes |
| Connection drops | Check memory, tune garbage collection |

---

## Future Enhancements (Out of Scope)

- Media messages (images, videos, voice)
- Message reactions
- Reply threads
- Message search
- Pinned messages
- Scheduled messages

These can be added incrementally without architectural changes.
