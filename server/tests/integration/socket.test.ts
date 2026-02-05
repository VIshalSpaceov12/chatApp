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
