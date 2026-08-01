import Redis from 'ioredis';
import Redlock from 'redlock';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const isTest = process.env.NODE_ENV === 'test';

type RedisClientLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  duplicate: (...args: unknown[]) => RedisClientLike;
};

type RedisTestClient = RedisClientLike & {
  subscribe: (channel: string, callback?: (err: Error | null) => void) => void;
  call: (command: string, ...args: unknown[]) => number | string | [number, number];
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<'OK'>;
  del: (key: string) => Promise<number>;
  publish: (channel: string, message: string) => Promise<number>;
  ping: () => Promise<string>;
};

const attachRedisEventHandlers = <T extends RedisClientLike>(client: T) => {
  client.on('connect', () => {
export const redis = isTest 
  ? ({
      duplicate: () => ({
        subscribe: createNoop<(channel: string, callback?: (err: Error | null) => void) => void>(undefined),
        on: createNoop<(event: string, handler: (...args: any[]) => void) => void>(undefined),
      }),
      call: (command: string, ...args: any[]) => {
        const cmd = command.toLowerCase();
        if (cmd === 'eval' || cmd === 'evalsha') {
          return [1, 60];
        }
        if (cmd === 'script' && args[0]?.toLowerCase() === 'load') {
          return 'mock-sha-1234567890';
        }
        return 1;
      },
      on: createNoop<(event: string, handler: (...args: any[]) => void) => void>(undefined),
      get: createNoop<(key: string) => Promise<string | null>>(Promise.resolve(null)),
      set: createNoop<(key: string, value: string) => Promise<'OK'>>(Promise.resolve('OK')),
      del: createNoop<(key: string) => Promise<number>>(Promise.resolve(1)),
      expire: createNoop<(key: string, seconds: number) => Promise<number>>(Promise.resolve(1)),
      publish: createNoop<(channel: string, message: string) => Promise<number>>(Promise.resolve(1)),
      ping: createNoop<() => Promise<string>>(Promise.resolve('PONG')),
    } as any)



  : new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

export const redlock = new Redlock(
  [redis],
  {
    driftFactor: 0.01,
    retryCount: 3,
    retryDelay: 200,
    retryJitter: 200,
    automaticExtensionThreshold: 500, // time in ms before lock expiration to automatically extend it
  }
);

if (!isTest) {
  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  client.on('error', (err: unknown) => {
    logger.error('Redis connection error:', err instanceof Error ? err : new Error(String(err)));
  });
  
  redlock.on('error', (error) => {
    logger.error('Redlock error:', error);
  });
}

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', (delay: unknown) => {
    logger.warn(`Redis reconnecting in ${typeof delay === 'number' ? delay : 0}ms`);
  });

  return client;
};

const decorateDuplicateMethod = <T extends RedisClientLike>(client: T): T => {
  const originalDuplicate = client.duplicate.bind(client);

  client.duplicate = ((...args: unknown[]) => {
    return decorateDuplicateMethod(attachRedisEventHandlers(originalDuplicate(...args) as T));
  }) as T['duplicate'];

  return client;
};

const createRedisClient = () => {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  }) as RedisClientLike;

  return decorateDuplicateMethod(attachRedisEventHandlers(client));
};

const createTestRedisClient = (): RedisTestClient => ({
  duplicate: () => createTestRedisClient(),
  subscribe: () => undefined,
  on: () => undefined,
  call: (command: string, ...args: unknown[]) => {
    const cmd = command.toLowerCase();
    if (cmd === 'eval' || cmd === 'evalsha') {
      return [1, 60];
    }
    if (cmd === 'script' && typeof args[0] === 'string' && args[0].toLowerCase() === 'load') {
      return 'mock-sha-1234567890';
    }
    return 1;
  },
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  publish: async () => 1,
  ping: async () => 'PONG',
});

export const redis = isTest 
  ? createTestRedisClient()
  : createRedisClient();
