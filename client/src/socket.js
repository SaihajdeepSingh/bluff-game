import { io } from 'socket.io-client';

const URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

const socket = io(URL, {
  transports: ['polling'],
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  timeout: 30000,
});

export default socket;
