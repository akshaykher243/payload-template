import express from 'express';
import payload from 'payload';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Use port 3001 for PayloadCMS

// Redirect all traffic to the admin panel
// If you are using a decoupled frontend, you might remove or modify this
// if you want to serve static assets or other routes directly from this server.
app.get('/', (req, res) => {
  res.redirect('/admin');
});

const start = async () => {
  // Initialize Payload CMS
  await payload.init({
    config: (await import('./payload.config.js')).default,
  });

  // Add your custom Express routes here if needed
  // For a decoupled setup, you'll mainly rely on Payload's auto-generated API routes.

  // Start the Express server
  app.listen(PORT, () => {
    payload.logger.info(`Payload CMS server listening on http://localhost:${PORT}`);
  });
};

start();