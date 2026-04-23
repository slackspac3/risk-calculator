/**
 * Vercel Web Analytics Integration
 * 
 * This module initializes Vercel Web Analytics for tracking page views and custom events.
 * The analytics are automatically injected on page load.
 * 
 * @see https://vercel.com/docs/analytics/quickstart
 */

import { inject } from '../node_modules/@vercel/analytics/dist/index.mjs';

// Initialize Vercel Web Analytics
inject({
  mode: 'auto', // Automatically detect environment (production vs development)
  debug: false  // Set to true during development for verbose logging
});
