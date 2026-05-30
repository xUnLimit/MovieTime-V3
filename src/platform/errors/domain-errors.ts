export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', context);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', context);
    this.name = 'ConflictError';
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_FUNDS', context);
    this.name = 'InsufficientFundsError';
  }
}
