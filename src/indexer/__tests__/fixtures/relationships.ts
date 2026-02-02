import { UserService } from "./class-with-methods.js";

export interface Serializable {
  serialize(): string;
}

export interface Cacheable {
  getCacheKey(): string;
}

export class BaseRepository {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }
}

export class OrderRepository extends BaseRepository implements Serializable, Cacheable {
  serialize(): string {
    return JSON.stringify(this);
  }

  getCacheKey(): string {
    return "order-repo";
  }

  async findById(id: string): Promise<Order> {
    const service = new UserService(this.db);
    return this.db.query("SELECT * FROM orders WHERE id = ?", [id]);
  }
}

export function createOrderRepository(db: Database): OrderRepository {
  return new OrderRepository(db);
}
