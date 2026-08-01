import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { PATTERNS } from '../lib/validation';

/** E.164: leading +, country code 1-9, 7–14 further digits. */
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
/** National identity documents are issued as alphanumeric strings, no separators. */
const ID_NUMBER_PATTERN = /^[A-Za-z0-9]+$/;
/** ICAO passport numbers are 6–9 alphanumeric characters. */
const PASSPORT_PATTERN = /^[A-Za-z0-9]{6,9}$/;

export const ID_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
] as const;

const kycSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'First name must be at least 2 characters.')
      .max(64, 'First name must not exceed 64 characters.'),
    lastName: z
      .string()
      .trim()
      .min(2, 'Last name must be at least 2 characters.')
      .max(64, 'Last name must not exceed 64 characters.'),
    emailAddress: z
      .string()
      .trim()
      .min(1, 'Email address is required.')
      .max(254, 'Email address must not exceed 254 characters.')
      .regex(PATTERNS.EMAIL, 'Enter a valid email address, e.g. name@example.com.'),
    mobileNumber: z
      .string()
      .trim()
      .min(1, 'Mobile number is required.')
      .regex(
        PHONE_PATTERN,
        'Enter the number in international format, e.g. +14155552671.',
      ),
    idType: z.enum(['national_id', 'passport', 'drivers_license']),
    idNumber: z
      .string()
      .trim()
      .min(1, 'Identity number is required.')
      .regex(ID_NUMBER_PATTERN, 'Identity number must contain only letters and digits.'),
  })
  // Length rules differ per document, so they run once the type is known.
  .superRefine((values, ctx) => {
    const { idType, idNumber } = values;

    if (idType === 'passport' && idNumber && !PASSPORT_PATTERN.test(idNumber)) {
      ctx.addIssue({
        code: 'custom',
        path: ['idNumber'],
        message: 'Passport numbers are 6–9 letters or digits.',
      });
      return;
    }

    if (idType !== 'passport' && idNumber && (idNumber.length < 5 || idNumber.length > 20)) {
      ctx.addIssue({
        code: 'custom',
        path: ['idNumber'],
        message: 'Identity number must be between 5 and 20 characters.',
      });
    }
  });

export type KycFormValues = z.infer<typeof kycSchema>;

interface KycFormProps {
  /** Receives the parsed, valid payload for the SEP-12 PUT /customer call. */
  onSubmit?: (values: KycFormValues) => void | Promise<void>;
  /** Prefill for resubmission after a rejection. */
  defaultValues?: Partial<KycFormValues>;
}

/** Inline, screen-reader-announced error rendered beneath its field. */
const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-400">
      <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
      {message}
    </p>
  ) : null;

/**
 * SEP-12 customer creation form with real-time validation feedback.
 *
 * Validation runs on blur (and re-runs on change once a field has errored) so
 * users see problems as they leave each field rather than only on submit.
 */
export const KycForm = ({ onSubmit, defaultValues }: KycFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      emailAddress: '',
      mobileNumber: '',
      idType: 'national_id',
      idNumber: '',
      ...defaultValues,
    },
  });

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit?.(values);
  });

  /** Wires a field to its error message for both sighted and AT users. */
  const fieldA11y = (name: keyof KycFormValues) => ({
    'aria-invalid': errors[name] ? (true as const) : (false as const),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  const inputClass = (name: keyof KycFormValues) =>
    `input-field w-full ${errors[name] ? 'border-rose-500 focus:ring-rose-500' : ''}`;

  return (
    <form onSubmit={submitHandler} noValidate className="glass-card space-y-5 p-6">
      <div>
        <h3 className="font-display text-xl font-bold text-slate-100">Customer Details</h3>
        <p className="mt-1 text-sm text-slate-400">
          Provide the identity information required by the anchor to open your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="kyc-first-name" className="mb-1.5 block text-sm font-medium text-slate-300">
            First Name
          </label>
          <input
            id="kyc-first-name"
            type="text"
            autoComplete="given-name"
            placeholder="Ada"
            className={inputClass('firstName')}
            {...fieldA11y('firstName')}
            {...register('firstName')}
          />
          <FieldError id="firstName-error" message={errors.firstName?.message} />
        </div>

        <div>
          <label htmlFor="kyc-last-name" className="mb-1.5 block text-sm font-medium text-slate-300">
            Last Name
          </label>
          <input
            id="kyc-last-name"
            type="text"
            autoComplete="family-name"
            placeholder="Lovelace"
            className={inputClass('lastName')}
            {...fieldA11y('lastName')}
            {...register('lastName')}
          />
          <FieldError id="lastName-error" message={errors.lastName?.message} />
        </div>
      </div>

      <div>
        <label htmlFor="kyc-email" className="mb-1.5 block text-sm font-medium text-slate-300">
          Email Address
        </label>
        <input
          id="kyc-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          className={inputClass('emailAddress')}
          {...fieldA11y('emailAddress')}
          {...register('emailAddress')}
        />
        <FieldError id="emailAddress-error" message={errors.emailAddress?.message} />
      </div>

      <div>
        <label htmlFor="kyc-mobile" className="mb-1.5 block text-sm font-medium text-slate-300">
          Mobile Number
        </label>
        <input
          id="kyc-mobile"
          type="tel"
          autoComplete="tel"
          placeholder="+14155552671"
          className={inputClass('mobileNumber')}
          {...fieldA11y('mobileNumber')}
          {...register('mobileNumber')}
        />
        <FieldError id="mobileNumber-error" message={errors.mobileNumber?.message} />
        {!errors.mobileNumber && (
          <p className="mt-1.5 text-xs text-slate-500">
            Include the country code, e.g. +14155552671.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <div>
          <label htmlFor="kyc-id-type" className="mb-1.5 block text-sm font-medium text-slate-300">
            Identity Document
          </label>
          <select
            id="kyc-id-type"
            className={inputClass('idType')}
            {...fieldA11y('idType')}
            {...register('idType')}
          >
            {ID_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <FieldError id="idType-error" message={errors.idType?.message} />
        </div>

        <div>
          <label htmlFor="kyc-id-number" className="mb-1.5 block text-sm font-medium text-slate-300">
            Identity Number
          </label>
          <input
            id="kyc-id-number"
            type="text"
            autoComplete="off"
            placeholder="A1234567"
            className={`${inputClass('idNumber')} font-mono tracking-wide`}
            {...fieldA11y('idNumber')}
            {...register('idNumber')}
          />
          <FieldError id="idNumber-error" message={errors.idNumber?.message} />
        </div>
      </div>

      {isSubmitSuccessful && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Customer details submitted for verification.
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="action-button btn-primary flex w-full items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-text sm:w-auto"
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Submitting…' : 'Submit for Verification'}
      </button>
    </form>
  );
};

export default KycForm;
