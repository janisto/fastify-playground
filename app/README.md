# Getting Started with [Fastify](https://www.npmjs.com/package/fastify)

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

---

## REST API Design Principles

This application follows REST API best practices and industry standards.

### URI Design

- Use lowercase letters with hyphens for multi-word segments: `/api/user-profiles`
- Use plural nouns for collections: `/items`, `/users`
- Use path parameters for resource identifiers: `/items/{id}`
- Avoid trailing slashes: `/items` not `/items/`
- Use query parameters for filtering, sorting, and pagination: `/items?category=electronics&limit=20`

### HTTP Methods

| Method | Purpose | Idempotent | Success Status |
|--------|---------|------------|----------------|
| GET | Retrieve resource(s) | Yes | 200 OK |
| POST | Create resource | No | 201 Created |
| PUT | Replace resource | Yes | 200 OK / 204 No Content |
| PATCH | Partial update | No | 200 OK |
| DELETE | Remove resource | Yes | 204 No Content |

### HTTP Status Codes

**Success (2xx)**
- `200 OK` - Request succeeded
- `201 Created` - Resource created (include `Location` header)
- `204 No Content` - Success with no response body

**Client Errors (4xx)**
- `400 Bad Request` - Invalid request syntax or parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource does not exist
- `422 Unprocessable Entity` - Validation errors

**Server Errors (5xx)**
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Server temporarily unavailable

### Error Responses (RFC 9457)

All error responses use [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) format:

```json
{
  "type": "https://example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "instance": "/items",
  "errors": [
    { "field": "name", "message": "is required" },
    { "field": "price", "message": "must be positive" }
  ]
}
```

Content-Type: `application/problem+json` or `application/problem+cbor`

### Content Negotiation

The API supports both JSON and CBOR formats via the `Accept` header:

| Accept Header | Response Format |
|---------------|-----------------|
| `application/json` | JSON (default) |
| `application/cbor` | CBOR binary |
| `*/*` or missing | JSON (default) |

Request bodies can be sent as JSON or CBOR using the `Content-Type` header.

All responses include `Vary: Accept` header for proper caching.

### Pagination

Collections use cursor-based pagination with RFC 8288 Link headers:

**Request:**
```
GET /items?limit=20&cursor=aXRlbToxMjM
```

**Response Headers:**
```
Link: </items?limit=20&cursor=aXRlbToxNTY>; rel="next",
      </items?limit=20&cursor=aXRlbToxMDA>; rel="prev"
```

**Response Body:**
```json
{
  "items": [...],
  "total": 150
}
```

- `cursor` - Opaque Base64URL-encoded cursor (do not decode on client)
- `limit` - Number of items per page (1-100, default 20)
- Use `rel="next"` and `rel="prev"` Link headers for navigation

### Request Identification

Every request is assigned a unique identifier for tracing:

- If client provides `X-Request-Id` header (printable ASCII, max 128 chars), it is used
- Otherwise, the server generates a UUID v4
- Response includes `X-Request-Id` header with the same value
- All logs include the request ID for correlation

---

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).

To learn Vitest, check out the [Vitest documentation](https://vitest.dev/guide/).

