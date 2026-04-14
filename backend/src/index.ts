import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './db';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

async function startServer() {
  try {
    // Seed database with sample data if empty
    // console.log('🌱 Checking seed data...');
    // try {
    //   const { seedDatabase } = await import('./seed');
    //   await seedDatabase();
    //   console.log('✅ Seed check complete');
    // } catch (seedErr) {
    //   console.warn('⚠️ Seed module not found or failed:', seedErr);
    // }

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
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || false) // false = no CORS headers; same-origin requests work fine
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(compression());

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint (for Render)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // Expose runtime frontend env (Vite injects at build time, but this provides a fallback)
  app.get('/env.js', (req, res) => {
    const publicEnv = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    };
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.__ENV__ = ${JSON.stringify(publicEnv)};`);
  });

  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  console.log(`📁 Serving frontend from: ${frontendDistPath}`);
  
  // Serve immutable cache headers for hashed build assets.
  app.use(express.static(frontendDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  
  // Handle SPA routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(indexPath);
    } else {
      console.error('❌ index.html not found at:', indexPath);
      res.status(404).send('Frontend not built. Please run npm run build.');
    }
  });
} else {
  // Development: API routes only (frontend runs on separate vite server)
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Financial OS API', 
      status: 'running',
      docs: '/api/health'
    });
  });
}

startServer();

export default app;
