/** User service handles database operations */
export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Find a user by their ID */
  async findById(id: string): Promise<User | null> {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  public async create(data: CreateUserDto): Promise<User> {
    return this.db.insert("users", data);
  }
}
