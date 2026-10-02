import type {
  Worker,
  WorkerDiscountUsage,
  WorkerNameSource,
  WorkerPurchase,
  WorkerStatus,
} from "../entities/worker";

export interface CreateWorkerData {
  // Client-generated so a registration queued offline is idempotent.
  uuid: string;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  birthDate: string;
  registeredById: number;
}

// What the POS keeps in IndexedDB to identify workers without internet.
export interface OfflineWorker {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  birthDate: string | null;
  status: WorkerStatus;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
}

export interface WorkerRepository {
  findById(id: number): Promise<Worker | null>;
  findByDni(dni: string): Promise<Worker | null>;
  findAll(status?: WorkerStatus): Promise<Worker[]>;
  countByStatus(): Promise<Record<WorkerStatus, number>>;
  // Returns the new worker's id, or null when a worker with this uuid
  // already exists (retry).
  create(data: CreateWorkerData): Promise<number | null>;
  setStatus(id: number, status: WorkerStatus, actorId: number): Promise<void>;
  updateName(id: number, fullName: string, nameSource: WorkerNameSource): Promise<void>;
  updateBirthDate(id: number, birthDate: string): Promise<void>;
  discountUsage(
    workerId: number,
    dayStart: Date,
    yearStart: Date,
  ): Promise<WorkerDiscountUsage>;
  offlineSnapshot(dayStart: Date, yearStart: Date): Promise<OfflineWorker[]>;
  purchaseHistory(workerId: number, limit: number): Promise<WorkerPurchase[]>;
}
