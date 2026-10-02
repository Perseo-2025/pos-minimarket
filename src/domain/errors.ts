export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// The session is authenticated but not allowed to perform this action
// (e.g. a cashier trying to sync a sale registered by another cashier).
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// A sale references a cashier that does not exist — the record itself is
// invalid, so retrying it will never succeed.
export class CashierNotFoundError extends Error {
  constructor(cashierId: number) {
    super(`Cashier ${cashierId} not found`);
    this.name = "CashierNotFoundError";
  }
}

// Uploaded file is not an accepted image (wrong type, too large, empty).
export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

// Business-rule violation with a message safe to show the admin as-is.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Worker-discount errors. Messages are in Spanish because they are shown to
// the cashier or the worker as-is.
export class WorkerNotFoundError extends Error {
  constructor(message = "Trabajador no encontrado") {
    super(message);
    this.name = "WorkerNotFoundError";
  }
}

export class WorkerAlreadyExistsError extends Error {
  constructor(message = "Este DNI ya está registrado") {
    super(message);
    this.name = "WorkerAlreadyExistsError";
  }
}

// "Mis puntos": the DNI and birth date don't match a worker. Never says which
// one was wrong, so the page can't be used to find out who is registered.
export class InvalidWorkerCredentialsError extends Error {
  constructor(message = "DNI o fecha de nacimiento incorrectos") {
    super(message);
    this.name = "InvalidWorkerCredentialsError";
  }
}

// Too many wrong attempts in a short time: blocks guessing birth dates.
export class TooManyAttemptsError extends Error {
  constructor(
    public readonly minutes: number,
    message = `Demasiados intentos. Espera ${minutes} minutos.`,
  ) {
    super(message);
    this.name = "TooManyAttemptsError";
  }
}

export class WorkerNotActiveError extends Error {
  constructor(message = "El trabajador no está activo") {
    super(message);
    this.name = "WorkerNotActiveError";
  }
}

export class DniNotFoundError extends Error {
  constructor(message = "DNI no encontrado en RENIEC") {
    super(message);
    this.name = "DniNotFoundError";
  }
}

// The DNI lookup provider is down, slow or not configured — the cashier types
// the name manually instead.
export class IdentityServiceUnavailableError extends Error {
  constructor(message = "Servicio de consulta DNI no disponible") {
    super(message);
    this.name = "IdentityServiceUnavailableError";
  }
}
