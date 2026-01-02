/**
 * CBOR content negotiation utilities.
 *
 * These functions help detect when CBOR format is requested or used
 * in HTTP request/response content negotiation.
 */

/**
 * Checks if the Accept header indicates preference for CBOR format.
 *
 * @param acceptHeader - The Accept header value from the request
 * @returns True if the client accepts CBOR responses
 */
export function prefersCbor(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  return acceptHeader.includes("application/cbor") || acceptHeader.includes("application/problem+cbor");
}

/**
 * Checks if the Content-Type indicates CBOR format.
 *
 * @param contentType - The Content-Type header value
 * @returns True if the content type is CBOR
 */
export function isCborContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes("application/cbor");
}
