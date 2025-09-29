import Fastify from 'fastify';
import cors from '@fastify/cors';
import { configureLogging, log } from '@iset/logging';
import { loadServerEnv } from '@iset/config';

const env = loadServerEnv();
configureLogging(env.LOG_LEVEL);

const app = Fastify({ logger: false });
await app.register(cors, { origin: true, credentials: true });

app.get('/api/health', async () => ({ status: 'ok' }));

app.setErrorHandler((error, request, reply) => {
  log('error', 'Unhandled API error', { message: error.message, url: request.url });
  reply.status(500).send({ error: 'internal_error' });
});

const port = env.PORT ?? 3000;

export async function start() {
  try {
    await app.listen({ port, host: '0.0.0.0' });
    log('info', API server listening on port );
  } catch (error) {
    log('error', 'API server failed to start', { message: (error as Error).message });
    process.exit(1);
  }
}

if (import.meta.url === ile://) {
  await start();
}
