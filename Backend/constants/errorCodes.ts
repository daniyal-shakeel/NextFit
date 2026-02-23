/**
 * MongoDB Error Codes
 * Reference: https://github.com/mongodb/mongo/blob/master/src/mongo/base/error_codes.yml
 */
export const MONGODB_ERROR_CODES = {
  DUPLICATE_KEY: 11000,           // Duplicate key error (E11000)
  DUPLICATE_KEY_UPDATE: 11001,    // Duplicate key error on update
} as const;

/**
 * MongoDB Error Names
 */
export const MONGODB_ERROR_NAMES = {
  MONGO_SERVER_ERROR: 'MongoServerError',
  MONGOOSE_ERROR: 'MongoError',
  VALIDATION_ERROR: 'ValidationError',
  CAST_ERROR: 'CastError',
} as const;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

