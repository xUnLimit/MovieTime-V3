export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'NO_SUCCESSFUL_DELIVERIES'
  | 'NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure<C extends string = ApiErrorCode> = {
  ok: false;
  error: {
    code: C;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
};

export type ApiResponse<T, C extends string = ApiErrorCode> = ApiSuccess<T> | ApiFailure<C>;

export class ApiClientError<C extends string = ApiErrorCode> extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: C,
    readonly requestId: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
