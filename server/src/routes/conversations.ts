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
    const id = req.params.id as string;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';

    // Verify user is participant
    const isParticipant = await ChatService.isParticipant(req.userId!, id);
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const limitNum = parseInt(limit, 10);
    const messages = await ChatService.getMessages(
      id,
      limitNum,
      before ? new Date(before) : undefined
    );

    res.json({
      messages,
      hasMore: messages.length === limitNum,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
