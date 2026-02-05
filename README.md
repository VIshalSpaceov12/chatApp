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
