import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { sep12Controller } from '../controllers/sep12.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { isValidStellarPublicKey } from '../../utils/stellar-address';
import { config } from '../../config/env';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads/kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for local disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const stellarAccountSchema = z
  .string()
  .min(1, 'account is required')
  .refine(isValidStellarPublicKey, { message: 'account must be a valid Stellar public key' });

/** GET /customer — query params */
export const getCustomerQuerySchema = z.object({
  account: stellarAccountSchema,
  memo: z.string().optional(),
  memo_type: z.enum(['id', 'text', 'hash']).optional(),
  type: z.string().optional(),
  lang: z.string().optional(),
});

/** PUT /customer — request body (JSON / form fields after multer) */
export const putCustomerBodySchema = z
  .object({
    account: stellarAccountSchema,
    memo: z.string().optional(),
    memo_type: z.enum(['id', 'text', 'hash']).optional(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email_address: z.string().email('email_address must be a valid email').optional(),
    mobile_number: z.string().optional(),
    birth_date: z.string().optional(),
    bank_account_number: z.string().optional(),
    bank_number: z.string().optional(),
    bank_phone_number: z.string().optional(),
    tax_id: z.string().optional(),
    tax_id_name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state_or_province: z.string().optional(),
    postal_code: z.string().optional(),
    country_code: z.string().optional(),
    ip_address: z.string().optional(),
    photo_id_type: z.string().optional(),
    photo_id_number: z.string().optional(),
  })
  .passthrough();

/** DELETE /customer/:account — path params */
export const deleteCustomerParamsSchema = z.object({
  account: stellarAccountSchema,
});

/**
 * Middleware: validate file_size does not exceed SEP12_MAX_FILE_SIZE_MB.
 * Applied to POST /customer/upload-url before the controller.
 */
function validateUploadFileSize(req: Request, res: Response, next: NextFunction) {
  const fileSizeBytes = Number(req.body?.file_size);
  const maxBytes = config.SEP12_MAX_FILE_SIZE_MB * 1024 * 1024;
  if (!fileSizeBytes || isNaN(fileSizeBytes)) {
    return res.status(400).json({ error: 'file_size is required' });
  }
  if (fileSizeBytes > maxBytes) {
    return res.status(400).json({
      error: `file_size exceeds maximum allowed size of ${config.SEP12_MAX_FILE_SIZE_MB} MB`,
    });
  }
  return next();
}

/**
 * @swagger
 * /sep12/customer:
 *   put:
 *     summary: Upload customer information and documents
 *     tags: [SEP-12]
 */
router.put(
  '/customer',
  authMiddleware,
  upload.any(),
  validate({ body: putCustomerBodySchema }),
  sep12Controller.putCustomer.bind(sep12Controller)
);

/**
 * @swagger
 * /sep12/customer:
 *   get:
 *     summary: Get customer KYC status
 *     tags: [SEP-12]
 */
router.get(
  '/customer',
  validate({ query: getCustomerQuerySchema }),
  sep12Controller.getCustomer.bind(sep12Controller)
);

/**
 * @swagger
 * /sep12/customer/{account}:
 *   delete:
 *     summary: Delete customer PII
 *     tags: [SEP-12]
 */
router.delete(
  '/customer/:account',
  validate({ params: deleteCustomerParamsSchema }),
  sep12Controller.deleteCustomer.bind(sep12Controller)
);

/**
 * @swagger
 * /sep12/customer/upload-url:
 *   post:
 *     summary: Request a pre-signed URL for direct file upload
 *     tags: [SEP-12]
 */
router.post('/customer/upload-url', authMiddleware, validateUploadFileSize, sep12Controller.getUploadUrl.bind(sep12Controller));

/**
 * @swagger
 * /sep12/customer/upload-confirm:
 *   post:
 *     summary: Confirm a direct file upload was completed
 *     tags: [SEP-12]
 */
router.post('/customer/upload-confirm', authMiddleware, sep12Controller.confirmUpload.bind(sep12Controller));

/**
 * @swagger
 * /sep12/webhook:
 *   post:
 *     summary: Webhook for 3rd party KYC provider updates
 *     tags: [SEP-12]
 */
router.post('/webhook', sep12Controller.handleWebhook.bind(sep12Controller));

export default router;
