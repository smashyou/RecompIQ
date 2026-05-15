export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "SAFETY_BLOCKED"
  | "UPSTREAM_FAILED"
  | "INTERNAL";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  SAFETY_BLOCKED: 451,
  UPSTREAM_FAILED: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class SafetyBlockedError extends AppError {
  constructor(message: string) {
    super("SAFETY_BLOCKED", message);
    this.name = "SafetyBlockedError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super("VALIDATION_FAILED", message, fieldErrors);
    this.name = "ValidationError";
  }
}
