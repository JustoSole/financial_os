import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './db';
import { seedDatabase } from './seed';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
console.log('🔧 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

async function startServer() {
  try {
    // Seed database with sample data if empty
    console.log('🌱 Checking seed data...');
    await seedDatabase();
    console.log('✅ Seed check complete');

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   💰 Financial OS - Backend Server                       ║
║                                                          ║
║   🚀 Running on http://localhost:${PORT}                   ║
║   📊 API endpoint: http://localhost:${PORT}/api            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// ... rest of middleware and routes ...

startServer();

export default app;
