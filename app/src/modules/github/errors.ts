export const GITHUB_ERROR_NOT_FOUND = "github_not_found";
export const GITHUB_ERROR_RATE_LIMIT = "github_rate_limit";
export const GITHUB_ERROR_FORBIDDEN = "github_forbidden";
export const GITHUB_ERROR_UPSTREAM = "github_upstream";

export class GitHubApiError extends Error {
  public readonly name = "GitHubApiError";

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryAfter?: string,
  ) {
    super(message);
  }
}

export class InvalidCursorError extends Error {
  public readonly name = "InvalidCursorError";
}
