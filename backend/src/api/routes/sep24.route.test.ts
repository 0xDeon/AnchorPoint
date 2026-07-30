import express from 'express';
import request from 'supertest';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn(() => '00000000-0000-0000-0000-000000000000')
  };
});

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    quote: {
      findUnique: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../services/sep24.service', () => {
  const actual = jest.requireActual('../../services/sep24.service');
  return {
    ...actual,
    Sep24Service: {
      ...actual.Sep24Service,
      storeCallback: jest.fn().mockResolvedValue(undefined),
      getCallback: jest.fn(),
      notifyStatusChange: jest.fn(),
      validateCallbackUrl: actual.Sep24Service.validateCallbackUrl,
    },
  };
});

import sep24Router from './sep24.route';
import { Sep24Service } from '../../services/sep24.service';

jest.setTimeout(15000);

describe('SEP-24 Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/', sep24Router);

  const baseUrl = 'http://localhost:4100';
  const validAccount = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

  beforeEach(() => {
    process.env.INTERACTIVE_URL = baseUrl;
    jest.clearAllMocks();
    (Sep24Service.storeCallback as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.INTERACTIVE_URL;
    delete process.env.SEP24_ALLOWED_CALLBACK_DOMAINS;
  });

  describe('POST /transactions/deposit/interactive', () => {
    it('returns 400 when asset_code is missing', async () => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({ account: validAccount });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('asset_code is required');
    });

    it('returns 400 when asset_code is not supported', async () => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({ asset_code: 'DOGE' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Asset DOGE is not supported');
      expect(res.body.error).toContain('Supported assets: USDC, USD');
    });

    it('returns an interactive URL for supported assets (with optional params)', async () => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({
          asset_code: 'usdc',
          account: validAccount,
          amount: '12.50',
          lang: 'fr'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.type).toBe('interactive_customer_info_needed');
      expect(res.body.id).toBe('00000000-0000-0000-0000-000000000000');

      const parsed = new URL(res.body.url);
      expect(parsed.pathname).toBe('/kyc-deposit');
      expect(parsed.searchParams.get('transaction_id')).toBe(res.body.id);
      expect(parsed.searchParams.get('asset_code')).toBe('USDC');
      expect(parsed.searchParams.get('account')).toBe(validAccount);
      expect(parsed.searchParams.get('amount')).toBe('12.50');
      expect(parsed.searchParams.get('lang')).toBe('fr');
    });

    it.each([
      ['plain invalid string', 'INVALID_ADDRESS'],
      ['secret seed-like value', `S${validAccount.slice(1)}`],
      ['padded public key', `${validAccount} `],
      ['checksum mismatch', `${validAccount.slice(0, -1)}A`],
      ['contract address-like value', `C${validAccount.slice(1)}`],
    ])('returns 400 when account is %s', async (_caseName, account) => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({
          asset_code: 'USDC',
          account,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('account must be a valid Stellar public key');
      expect(res.body.error).not.toContain(account);
    });

    it('defaults lang to en when omitted', async () => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({
          asset_code: 'USDC'
        });

      const parsed = new URL(res.body.url);
      expect(parsed.searchParams.get('lang')).toBe('en');
    });

    it('returns 400 when redirect_url is not in whitelist', async () => {
      process.env.SEP24_ALLOWED_CALLBACK_DOMAINS = 'example.com';
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({ asset_code: 'USDC', redirect_url: 'https://malicious.com/callback' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid redirect_url domain');
    });

    it('returns 400 when on_change_callback is not in whitelist', async () => {
      process.env.SEP24_ALLOWED_CALLBACK_DOMAINS = 'example.com';
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({ asset_code: 'USDC', on_change_callback: 'https://malicious.com/hook' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid on_change_callback domain');
    });
  });

  describe('POST /transactions/withdraw/interactive', () => {
    it('returns 400 when asset_code is missing', async () => {
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({ account: validAccount });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('asset_code is required');
    });

    it('returns 400 when asset_code is not supported', async () => {
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({ asset_code: 'DOGE' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Asset DOGE is not supported');
      expect(res.body.error).toContain('Supported assets: USDC, USD');
    });

    it('returns an interactive URL for supported assets', async () => {
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({
          asset_code: 'USD',
          account: validAccount,
          amount: '1'
        });

      expect(res.statusCode).toBe(200);
      const parsed = new URL(res.body.url);
      expect(parsed.pathname).toBe('/kyc-withdraw');
      expect(parsed.searchParams.get('asset_code')).toBe('USD');
      expect(parsed.searchParams.get('account')).toBe(validAccount);
      expect(parsed.searchParams.get('amount')).toBe('1');
    });

    it.each([
      ['plain invalid string', 'INVALID_ADDRESS'],
      ['secret seed-like value', `S${validAccount.slice(1)}`],
      ['padded public key', ` ${validAccount}`],
      ['muxed account-like value', `M${validAccount.slice(1)}`],
    ])('returns 400 when account is %s', async (_caseName, account) => {
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({
          asset_code: 'USD',
          account,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('account must be a valid Stellar public key');
      expect(res.body.error).not.toContain(account);
    });

    it('returns 400 when redirect_url is not in whitelist', async () => {
      process.env.SEP24_ALLOWED_CALLBACK_DOMAINS = 'example.com';
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({ asset_code: 'USDC', redirect_url: 'https://malicious.com/callback' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid redirect_url domain');
    });

    it('returns 400 when on_change_callback is not in whitelist', async () => {
      process.env.SEP24_ALLOWED_CALLBACK_DOMAINS = 'example.com';
      const res = await request(app)
        .post('/transactions/withdraw/interactive')
        .send({ asset_code: 'USDC', on_change_callback: 'https://malicious.com/hook' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid on_change_callback domain');
    });
  });

  describe('GET /transaction', () => {
    it('returns 400 when no query parameters are supplied', async () => {
      const res = await request(app).get('/transaction');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('One of id, stellar_transaction_id, or external_transaction_id is required');
    });

    it('returns 404 when transaction is not found', async () => {
      const prisma = require('../../lib/prisma').default;
      prisma.transaction.findFirst.mockResolvedValueOnce(null);

      const res = await request(app).get('/transaction?id=nonexistent-id');
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Transaction not found');
    });

    it('returns 400 when stellar transaction hash is missing', async () => {
      const prisma = require('../../lib/prisma').default;
      prisma.transaction.findFirst.mockResolvedValueOnce({
        id: 'tx-123',
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: '10.00',
        assetCode: 'USDC',
        stellarTxId: null,
        externalId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get('/transaction?id=tx-123');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Stellar transaction hash is missing or invalid');
    });

    it('returns 200 with transaction details when stellar transaction hash is present', async () => {
      const prisma = require('../../lib/prisma').default;
      const createdAt = new Date();
      prisma.transaction.findFirst.mockResolvedValueOnce({
        id: 'tx-123',
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amount: '50.00',
        assetCode: 'USDC',
        stellarTxId: 'hash-123456789',
        externalId: 'ext-999',
        createdAt,
        updatedAt: createdAt,
      });

      const res = await request(app).get('/transaction?id=tx-123');
      expect(res.statusCode).toBe(200);
      expect(res.body.transaction).toBeDefined();
      expect(res.body.transaction.id).toBe('tx-123');
      expect(res.body.transaction.stellar_transaction_id).toBe('hash-123456789');
    });
  });

  describe('PATCH /transactions/:id/status', () => {
    it('returns 400 when status is missing', async () => {
      const res = await request(app)
        .patch('/transactions/tx-1/status')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('status is required');
    });

    it('returns 404 when no partner callback is configured', async () => {
      (Sep24Service.getCallback as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/transactions/tx-1/status')
        .send({ status: 'completed' });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('No partner callback');
    });

    it('notifies partner webhook with idempotent delivery result', async () => {
      (Sep24Service.getCallback as jest.Mock).mockResolvedValueOnce({
        callbackUrl: 'https://partner.example/hook',
        kind: 'deposit',
        assetCode: 'USDC',
        amount: '10',
      });
      (Sep24Service.notifyStatusChange as jest.Mock).mockResolvedValueOnce({
        delivered: true,
        attempts: 1,
        statusCode: 200,
        idempotencyKey: 'sep24:tx-1:pending_user->completed',
      });
      const prisma = require('../../lib/prisma').default;
      prisma.transaction.update.mockResolvedValueOnce({
        id: 'tx-1',
        amount: '10',
        assetCode: 'USDC',
        stellarTxId: null,
        externalId: null,
      });

      const res = await request(app)
        .patch('/transactions/tx-1/status')
        .send({ status: 'completed', previous_status: 'pending_user' });

      expect(res.statusCode).toBe(200);
      expect(res.body.webhook.delivered).toBe(true);
      expect(res.body.webhook.idempotencyKey).toBe(
        'sep24:tx-1:pending_user->completed'
      );
      expect(Sep24Service.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          kind: 'deposit',
          previousStatus: 'pending_user',
          nextStatus: 'completed',
          callbackUrl: 'https://partner.example/hook',
        })
      );
    });

    it('stores partner callback on interactive deposit', async () => {
      const res = await request(app)
        .post('/transactions/deposit/interactive')
        .send({
          asset_code: 'USDC',
          on_change_callback: 'https://partner.example/hook',
        });

      expect(res.statusCode).toBe(200);
      expect(Sep24Service.storeCallback).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
        expect.objectContaining({
          callbackUrl: 'https://partner.example/hook',
          kind: 'deposit',
          assetCode: 'USDC',
        })
      );
    });
  });
});

