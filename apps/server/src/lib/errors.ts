export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet — schema is ready, logic ships in a follow-up session.`);
    this.name = "NotImplementedError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
