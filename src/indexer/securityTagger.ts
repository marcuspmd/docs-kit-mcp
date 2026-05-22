export interface SecurityInfo {
  isSensitive: boolean;
  categories: string[];
}

const NAME_PATTERNS: Record<string, RegExp> = {
  auth: /\b(auth(?:enticate|orize|orization)?|login|logout|sign[_-]?(?:in|out)|oauth|sso)\b/i,
  crypto:
    /\b(hash|encrypt|decrypt|sign|verify|hmac|cipher|aes|rsa|bcrypt|argon|pbkdf|digest|nonce|salt)\b/i,
  token: /\b(token|secret|api[_-]?key|bearer|credential|passphrase|private[_-]?key)\b/i,
  password: /\b(password|passwd|pin)\b/i,
  session: /\b(session|cookie|csrf|xsrf)\b/i,
  permission: /\b(permission|acl|rbac|role|policy|authorize|can[_-]?access|grant|revoke|privilege)\b/i,
  "input-validation": /\b(sanitize|escape|validate|xss|injection|filter[_-]?input)\b/i,
};

const IMPORT_PATTERNS: Record<string, RegExp> = {
  crypto:
    /['"](?:bcrypt|argon2|crypto|node:crypto|jsonwebtoken|jose|jwks-rsa|tweetnacl|libsodium)['"]/,
  auth: /['"](?:passport|passport-jwt|@auth\/|next-auth|firebase-admin|keycloak-connect|auth0)['"]/,
  sql: /['"](?:pg|mysql2|better-sqlite3|sqlite3|knex|mysql)\b/,
};

const SENSITIVE_PARAM_PATTERN =
  /\b(password|passwd|secret|token|apiKey|api_key|privateKey|credentials?)\s*[,:)]/i;

export function detectSecuritySensitivity(
  name: string,
  signature: string | undefined,
  fileSource: string,
): SecurityInfo {
  const categories = new Set<string>();

  for (const [cat, pattern] of Object.entries(NAME_PATTERNS)) {
    if (pattern.test(name)) categories.add(cat);
  }

  if (signature && SENSITIVE_PARAM_PATTERN.test(signature)) {
    categories.add("sensitive-params");
  }

  for (const [cat, pattern] of Object.entries(IMPORT_PATTERNS)) {
    if (pattern.test(fileSource)) categories.add(cat);
  }

  return {
    isSensitive: categories.size > 0,
    categories: [...categories],
  };
}
