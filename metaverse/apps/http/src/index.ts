import 'dotenv/config' 
import express from 'express';
import cors from 'cors';

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'http://localhost:3000']
    : '*',  // Allow all in development
  credentials: process.env.NODE_ENV === 'production',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

import { router } from './routes/v1/index';
app.use('/api/v1', router);
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'http-service',
    timestamp: new Date().toISOString()
  });
});

// Prefer cloud-assigned PORT (e.g., Render/Heroku). Fallback to custom var or 8000 locally.
const PORT = process.env.PORT || process.env.HTTP_SERVICE_PORT || 8000;

app.listen(PORT, () => {
  console.log(`HTTP service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
