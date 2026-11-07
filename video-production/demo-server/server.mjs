/**
 * QuizVibe AI — Local Demo Server
 * Runs isolated local demo on http://localhost:3000 with in-memory FakePostgrest.
 * Zero external calls to Supabase Production.
 */

// -----------------------------------------------------------------------------
// STEP 1: HARD SECURITY ISOLATION — ENFORCE SYNTHETIC ENVIRONMENT FIRST
// -----------------------------------------------------------------------------
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.QUIZVIBE_DEMO_MODE = 'true';
process.env.SUPABASE_URL = 'https://synthetic-test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_synthetic_service_role_key_demo_local_2026';
process.env.SUPABASE_ANON_KEY = 'sb_synthetic_anon_key_demo_local_2026';
process.env.ADMIN_PASSWORD = 'demo_admin_password_2026';
process.env.ADMIN_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE = 'true';
process.env.DEMO_MOCK_AI = 'true';

// Boundary validation check
if (process.env.SUPABASE_URL !== 'https://synthetic-test-project.supabase.co') {
  console.error('FATAL SECURITY VIOLATION: SUPABASE_URL is not set to synthetic host. Aborting.');
  process.exit(1);
}

import { createServer as createViteServer } from 'vite';
import { createDemoFixtures, DEMO_ADMIN_PASSWORD } from './fixtures.mjs';
import { createApiAdapter } from './api-adapter.mjs';

async function startDemoServer() {
  console.log('================================================================');
  console.log('       QUIZVIBE AI — LOCAL DEMO ENVIRONMENT (ISOLATED)          ');
  console.log('================================================================');
  console.log('🔒 Security Policy: In-Memory FakePostgrest (Zero Supabase reach)');
  console.log('🔒 Synthetic Supabase Host: synthetic-test-project.supabase.co');

  let fakeDbInstance = null;

  // Custom Vite plugin to mount FakePostgrest and API Connect Adapter before internal middlewares
  const demoApiPlugin = {
    name: 'quizvibe-demo-api-adapter',
    async configureServer(server) {
      // 1. Load FakePostgrest via SSR Module
      const { FakePostgrest } = await server.ssrLoadModule('./api/_lib/testing/fakePostgrest.ts');
      fakeDbInstance = new FakePostgrest();
      fakeDbInstance.install();
      console.log('✅ FakePostgrest installed on globalThis.fetch successfully');

      // 2. Seed Fixtures into FakePostgrest tables
      const fixtures = createDemoFixtures();
      for (const [table, rows] of Object.entries(fixtures)) {
        fakeDbInstance.tables[table] = rows;
      }
      console.log('✅ Seeded demo campaign, 5 questions, voucher, and 10 leaderboard entries');

      // 3. Attach API Adapter Middleware
      const apiMiddleware = createApiAdapter({ viteServer: server, fakeDb: fakeDbInstance });
      server.middlewares.use(apiMiddleware);
      console.log('✅ API Connect Adapter mounted for /api/*');
    },
  };

  // Initialize Vite Server on port 3000
  const viteServer = await createViteServer({
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
    },
    plugins: [demoApiPlugin],
    appType: 'spa',
  });

  // Start listening
  await viteServer.listen();
  console.log('================================================================');
  console.log('🚀 DEMO LOCAL SERVER RUNNING AT: http://localhost:3000');
  console.log('👤 Admin Login: /admin/login');
  console.log(`🔑 Admin Password: ${DEMO_ADMIN_PASSWORD}`);
  console.log('🎮 Public Challenge 3 Quiz: /');
  console.log('🔄 Reset Fixtures Endpoint: POST http://localhost:3000/api/demo/reset');
  console.log('================================================================');

  return { viteServer, getFakeDb: () => fakeDbInstance };
}

// Auto-start if invoked directly via `node server.mjs`
if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  startDemoServer().catch((err) => {
    console.error('Failed to start demo server:', err);
    process.exit(1);
  });
}

export { startDemoServer };
