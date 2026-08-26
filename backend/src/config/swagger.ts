import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AnchorPoint API',
      version: '1.0.0',
      description: 'AnchorPoint Backend API for Stellar SEP-24 Anchor Operations',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'AnchorPoint Support',
        url: 'https://github.com/ceejaylaboratory/AnchorPoint',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization token obtained from /auth/token endpoint',
        },
      },
      schemas: {
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Transaction unique identifier',
            },
            userPublicKey: {
              type: 'string',
              description: 'User Stellar public key',
            },
            assetCode: {
              type: 'string',
              description: 'Asset code (e.g., USD, EUR)',
            },
            amount: {
              type: 'string',
              description: 'Transaction amount',
            },
            kind: {
              type: 'string',
              enum: ['deposit', 'withdrawal'],
              description: 'Transaction type',
            },
            status: {
              type: 'string',
              description: 'Transaction status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction update timestamp',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of items',
            },
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Number of items per page',
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Challenge: {
          type: 'object',
          properties: {
            transaction: {
              type: 'string',
              description: 'SEP-10 challenge transaction XDR',
            },
            network_passphrase: {
              type: 'string',
              description: 'Stellar network passphrase',
            },
          },
        },
        TokenResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token',
            },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            jobId: {
              type: 'string',
            },
            type: {
              type: 'string',
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DELAYED', 'RETRYING'],
            },
            contractId: {
              type: 'string',
            },
            functionName: {
              type: 'string',
            },
            parameters: {
              type: 'object',
            },
            result: {
              type: 'object',
            },
            error: {
              type: 'string',
            },
            attempts: {
              type: 'integer',
            },
            maxAttempts: {
              type: 'integer',
            },
            createdBy: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        MultisigTransaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            hash: {
              type: 'string',
            },
            envelopeXdr: {
              type: 'string',
            },
            creatorPublicKey: {
              type: 'string',
            },
            requiredSigners: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            threshold: {
              type: 'integer',
            },
            currentSignatures: {
              type: 'integer',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PARTIALLY_SIGNED', 'READY', 'SUBMITTED', 'FAILED', 'EXPIRED'],
            },
            signatures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  signerPublicKey: {
                    type: 'string',
                  },
                  signedAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
              },
            },
            memo: {
              type: 'string',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
            },
            submittedAt: {
              type: 'string',
              format: 'date-time',
            },
            stellarTxId: {
              type: 'string',
            },
            metadata: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Transactions',
        description: 'Transaction history and management',
      },
      {
        name: 'SEP-10 Authentication',
        description: 'Stellar SEP-10 authentication endpoints',
      },
      {
        name: 'SEP-24',
        description: 'Stellar SEP-24 deposit and withdrawal operations',
      },
      {
        name: 'SEP-1 Info',
        description: 'Stellar SEP-1 anchor info endpoint',
      },
    ],
  },
  apis: ['./src/api/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);