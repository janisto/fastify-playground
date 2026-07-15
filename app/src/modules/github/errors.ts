export const GITHUB_ERROR_NOT_FOUND = "github_not_found";
export const GITHUB_ERROR_RATE_LIMIT = "github_rate_limit";
export const GITHUB_ERROR_FORBIDDEN = "github_forbidden";
export const GITHUB_ERROR_UPSTREAM = "github_upstream";

export class GitHubApiError extends Error {
  public override readonly name = "GitHubApiError";
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryAfter: string | undefined;

  constructor(message: string, statusCode: number, code: string, retryAfter?: string, options?: ErrorOptions) {
    super(message, options);
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class InvalidCursorError extends Error {
  public override readonly name = "InvalidCursorError";
}
