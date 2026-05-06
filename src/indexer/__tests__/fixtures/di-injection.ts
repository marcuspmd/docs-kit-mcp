/**
 * Fixture: DI patterns that the relationship extractor must detect.
 * Used by TypeScriptStrategy DI tests.
 */

// ── Simulated DI decorators (mirrors tsyringe / NestJS / InversifyJS) ────────

export const PAYMENT_TOKEN = Symbol("PaymentRepository");
export const EMAIL_TOKEN = "EmailService";

function injectable() {
  return (_target: unknown) => {};
}
function inject(_token: unknown) {
  return (_target: unknown, _key: unknown, _index?: unknown) => {};
}
function Inject(_token: unknown) {
  return (_target: unknown, _key?: string, _descriptor?: unknown) => {};
}

// ── Injected classes ─────────────────────────────────────────────────────────

export class PaymentRepository {
  save(amount: number) {
    return amount;
  }
}

export class EmailService {
  send(to: string) {
    return to;
  }
}

export class LoggerService {
  log(msg: string) {
    return msg;
  }
}

// ── Target: constructor parameter injection (tsyringe-style) ─────────────────

@injectable()
export class OrderService {
  constructor(
    @inject(PAYMENT_TOKEN) private readonly paymentRepo: PaymentRepository,
    @inject(EMAIL_TOKEN) private emailSvc: EmailService,
    private logger: LoggerService,             // plain TS injection — no decorator
  ) {}

  createOrder(amount: number) {
    this.paymentRepo.save(amount);
    this.emailSvc.send("confirmation");
    this.logger.log("order created");
  }
}

// ── Target: property injection (NestJS / InversifyJS-style) ──────────────────

export class InvoiceService {
  @Inject(PAYMENT_TOKEN)
  private paymentRepo!: PaymentRepository;

  @Inject(EMAIL_TOKEN)
  private emailSvc!: EmailService;

  generate(amount: number) {
    return amount;
  }
}

// ── Should NOT create false positives ────────────────────────────────────────

export class SimpleService {
  constructor(
    private count: number,        // primitive — must be ignored
    private name: string,         // primitive — must be ignored
    private active: boolean,      // primitive — must be ignored
  ) {}
}
