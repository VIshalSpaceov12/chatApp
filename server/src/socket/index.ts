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
