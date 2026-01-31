export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<User | null> {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  async create(data: CreateUserDto): Promise<User> {
    return this.db.insert("users", data);
  }
}
