export type HttpErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN';

export class HttpError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: HttpErrorCode,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'HttpError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, 'UNAUTHORIZED', 'Debes iniciar sesión para continuar.');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor() {
    super(403, 'FORBIDDEN', 'No tienes permisos para realizar esta acción.');
    this.name = 'ForbiddenError';
  }
}
