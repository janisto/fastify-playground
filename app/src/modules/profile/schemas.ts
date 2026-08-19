import { type Static, Type } from "@fastify/type-provider-typebox";
import { BoundedNameSchema, OpaqueIdSchema, PhoneNumberSchema, TimestampSchema } from "../../schemas/portable.js";

const EMAIL_PATTERN =
  "^(?!\\.)(?![^@]*\\.\\.)(?![^@]*\\.@)[A-Za-z0-9!#$%&'*+/=?^_{|}~.-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$";

export const ContactEmailSchema = Type.String({ minLength: 3, maxLength: 254, pattern: EMAIL_PATTERN });

export const ProfileCreateSchema = Type.Object(
  {
    firstName: BoundedNameSchema,
    lastName: BoundedNameSchema,
    contactEmail: ContactEmailSchema,
    phoneNumber: PhoneNumberSchema,
    marketingOptIn: Type.Optional(Type.Boolean({ default: false })),
    termsAccepted: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const ProfileUpdateSchema = Type.Object(
  {
    firstName: Type.Optional(BoundedNameSchema),
    lastName: Type.Optional(BoundedNameSchema),
    contactEmail: Type.Optional(ContactEmailSchema),
    phoneNumber: Type.Optional(PhoneNumberSchema),
    marketingOptIn: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const ProfileSchema = Type.Object(
  {
    id: OpaqueIdSchema,
    firstName: BoundedNameSchema,
    lastName: BoundedNameSchema,
    contactEmail: ContactEmailSchema,
    phoneNumber: PhoneNumberSchema,
    marketingOptIn: Type.Boolean(),
    termsAccepted: Type.Literal(true),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  },
  { $id: "Profile", additionalProperties: false },
);

export type Profile = Static<typeof ProfileSchema>;
export type ProfileCreate = Static<typeof ProfileCreateSchema>;
export type ProfileUpdate = Static<typeof ProfileUpdateSchema>;

function isAsciiWhitespace(code: number): boolean {
  return code === 0x20 || (code >= 0x09 && code <= 0x0d);
}

function stripAsciiWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isAsciiWhitespace(value.charCodeAt(start))) start += 1;
  while (end > start && isAsciiWhitespace(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

export function normalizeContactEmail(value: string): string {
  const stripped = stripAsciiWhitespace(value);
  const at = stripped.indexOf("@");
  if (at < 0) return stripped;
  return `${stripped.slice(0, at)}@${stripped.slice(at + 1).toLowerCase()}`;
}

export function normalizePhoneNumber(value: string): string {
  return stripAsciiWhitespace(value);
}

export function normalizeProfileDocument(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return;
  const document = value as Record<string, unknown>;
  if (typeof document["contactEmail"] === "string") {
    document["contactEmail"] = normalizeContactEmail(document["contactEmail"]);
  }
  if (typeof document["phoneNumber"] === "string") {
    document["phoneNumber"] = normalizePhoneNumber(document["phoneNumber"]);
  }
}
