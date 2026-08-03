export type PortableErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "client_generated_id_unsupported"
  | "relationships_unsupported"
  | "not_found"
  | "profile_not_found"
  | "github_not_found"
  | "method_not_allowed"
  | "not_acceptable"
  | "profile_exists"
  | "profile_resource_mismatch"
  | "payload_too_large"
  | "unsupported_media_type"
  | "validation_failed"
  | "rate_limited"
  | "github_rate_limit"
  | "internal_error"
  | "github_upstream"
  | "dependency_unavailable"
  | "github_timeout";

export const PORTABLE_ERRORS: Readonly<
  Record<PortableErrorCode, { readonly status: number; readonly title: string; readonly detail: string }>
> = {
  invalid_request: { status: 400, title: "Bad Request", detail: "Request is malformed" },
  unauthorized: { status: 401, title: "Unauthorized", detail: "Authentication is required or invalid" },
  forbidden: { status: 403, title: "Forbidden", detail: "Access is forbidden" },
  client_generated_id_unsupported: {
    status: 403,
    title: "Forbidden",
    detail: "Client-generated profile IDs are not supported",
  },
  relationships_unsupported: {
    status: 403,
    title: "Forbidden",
    detail: "Profile relationships are not supported",
  },
  not_found: { status: 404, title: "Not Found", detail: "Resource not found" },
  profile_not_found: { status: 404, title: "Not Found", detail: "Profile not found" },
  github_not_found: { status: 404, title: "Not Found", detail: "GitHub resource not found" },
  method_not_allowed: { status: 405, title: "Method Not Allowed", detail: "Method not allowed" },
  not_acceptable: {
    status: 406,
    title: "Not Acceptable",
    detail: "No acceptable response representation is available",
  },
  profile_exists: { status: 409, title: "Conflict", detail: "Profile already exists" },
  profile_resource_mismatch: {
    status: 409,
    title: "Conflict",
    detail: "Profile resource does not match this endpoint",
  },
  payload_too_large: { status: 413, title: "Content Too Large", detail: "Request body is too large" },
  unsupported_media_type: {
    status: 415,
    title: "Unsupported Media Type",
    detail: "Request representation is not supported",
  },
  validation_failed: {
    status: 422,
    title: "Unprocessable Content",
    detail: "Request validation failed",
  },
  rate_limited: { status: 429, title: "Too Many Requests", detail: "Rate limit exceeded" },
  github_rate_limit: { status: 429, title: "Too Many Requests", detail: "GitHub rate limit exceeded" },
  internal_error: { status: 500, title: "Internal Server Error", detail: "Internal server error" },
  github_upstream: {
    status: 502,
    title: "Bad Gateway",
    detail: "GitHub upstream response is invalid or unavailable",
  },
  dependency_unavailable: {
    status: 503,
    title: "Service Unavailable",
    detail: "A required dependency is unavailable",
  },
  github_timeout: { status: 504, title: "Gateway Timeout", detail: "GitHub request timed out" },
};

export class PortableError extends Error {
  public override readonly name = "PortableError";
  public readonly code: PortableErrorCode;
  public readonly statusCode: number;

  constructor(code: PortableErrorCode, options?: ErrorOptions) {
    super(PORTABLE_ERRORS[code].detail, options);
    this.code = code;
    this.statusCode = PORTABLE_ERRORS[code].status;
  }
}
