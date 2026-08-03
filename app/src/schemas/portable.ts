import { Type } from "@fastify/type-provider-typebox";

export const SAFE_INTEGER_MAXIMUM = 9_007_199_254_740_991;
export const TIMESTAMP_PATTERN =
  "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\\.[0-9]{3}Z$";
export const BOUNDED_NAME_PATTERN =
  "^(?![\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000])(?!.*[\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]$)[^\\u0000-\\u001F\\u007F-\\u009F]{1,100}$";

export const SafeIntegerSchema = Type.Integer({ minimum: 0, maximum: SAFE_INTEGER_MAXIMUM });
export const TimestampSchema = Type.String({ format: "date-time", pattern: TIMESTAMP_PATTERN });
export const OpaqueIdSchema = Type.String({ minLength: 1, maxLength: 128 });
export const BoundedNameSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: BOUNDED_NAME_PATTERN,
});
export const PhoneNumberSchema = Type.String({ pattern: "^\\+[1-9][0-9]{6,14}$" });

export const MoneySchema = Type.Object(
  {
    amountMinor: SafeIntegerSchema,
    currency: Type.Literal("USD"),
  },
  { additionalProperties: false },
);
