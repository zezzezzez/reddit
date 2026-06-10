// Next.js Instrumentation Hook - runs once when the server starts
// Used to initialize scheduled tasks (Feishu daily push, auto-scan)

export async function register() {
  // Only run on the first instance (not on each worker in multi-worker mode)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initScheduler } = await import('@/lib/scheduler');
    console.log('[Instrumentation] Initializing scheduler on server startup...');
    initScheduler();
  }
}
