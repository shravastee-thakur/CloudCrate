export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly meta: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, meta: any = null) {
    // Call the parent Error constructor with the message
    super(message);

    // Set the name of the error to the class name
    this.name = this.constructor.name;

    this.statusCode = statusCode;
    this.meta = meta;

    // Flag this as an operational error (an error we expected and threw manually)
    // This helps distinguish it from random programming bugs in production
    this.isOperational = true;

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}
