import type {
  Worker,
  WorkerDiscountUsage,
  WorkerNameSource,
  WorkerPurchase,
  WorkerStatus,
  WorkerWithPin,
} from "../entities/worker";

export interface CreateWorkerData {
  // Client-generated so a registration queued offline is idempotent.
  uuid: string;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  pinHash: string;
  registeredById: number;
}

// What the POS keeps in IndexedDB to identify workers without internet.
// PIN hashes are only included for active workers.
export interface OfflineWorker {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  status: WorkerStatus;
  pinHash: string | null;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
}

export interface WorkerRepository {
  findById(id: number): Promise<WorkerWithPin | null>;
  findByDni(dni: string): Promise<WorkerWithPin | null>;
  findAll(status?: WorkerStatus): Promise<Worker[]>;
  countByStatus(): Promise<Record<WorkerStatus, number>>;
  // Returns the new worker's id, or null when a worker with this uuid
  // already exists (retry).
  create(data: CreateWorkerData): Promise<number | null>;
  // A new PIN always sends the worker back to "pending" (pin_reset).
  replacePin(id: number, pinHash: string): Promise<void>;
  setStatus(id: number, status: WorkerStatus, actorId: number): Promise<void>;
  updateName(id: number, fullName: string, nameSource: WorkerNameSource): Promise<void>;
  discountUsage(
    workerId: number,
    dayStart: Date,
    monthStart: Date,
  ): Promise<WorkerDiscountUsage>;
  offlineSnapshot(dayStart: Date, monthStart: Date): Promise<OfflineWorker[]>;
  purchaseHistory(workerId: number, limit: number): Promise<WorkerPurchase[]>;
}
