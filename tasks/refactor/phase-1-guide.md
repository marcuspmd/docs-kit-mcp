# 🚀 Quick Start Guide - Fase 1

> [← Voltar ao Índice](./README.md)

Este guia prático te leva passo a passo pela **Fase 1: Fundação**.

---

## ⏱️ Tempo Estimado: 10-15 horas (1-2 semanas part-time)

---

## 📋 Pré-requisitos

- [ ] Branch criada: `git checkout -b refactor/phase-1-foundation`
- [ ] Todos os testes passando: `npm test`
- [ ] Build funcionando: `npm run build`
- [ ] Coverage baseline: `npm run test:coverage` (save output)

---

## Step 1: Criar Estrutura de Diretórios (15 min)

```bash
# Core
mkdir -p src/@core/domain
mkdir -p src/@core/application
mkdir -p src/@core/infrastructure

# Shared
mkdir -p src/@shared/types
mkdir -p src/@shared/errors
mkdir -p src/@shared/utils

# Modules (vazios por enquanto)
mkdir -p src/modules

# Adapters (vazios por enquanto)
mkdir -p src/adapters

# Config
mkdir -p src/config

# Main (entry points)
mkdir -p src/main
```

---

## Step 2: Classes Base - Entity (30 min)

Crie `src/@core/domain/Entity.ts`:

```typescript
export abstract class Entity<T> {
  protected readonly _id: unknown;
  protected props: T;

  constructor(props: T, id?: unknown) {
    this._id = id;
    this.props = props;
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    if (!(entity instanceof Entity)) {
      return false;
    }

    return this._id === entity._id;
  }
}
```

**Teste** `src/@core/domain/__tests__/Entity.test.ts`:

```typescript
import { Entity } from '../Entity';

class TestEntity extends Entity<{ name: string }> {
  get name(): string {
    return this.props.name;
  }
}

describe('Entity', () => {
  it('should be equal when same id', () => {
    const entity1 = new TestEntity({ name: 'Test' }, 'id-1');
    const entity2 = new TestEntity({ name: 'Other' }, 'id-1');

    expect(entity1.equals(entity2)).toBe(true);
  });

  it('should not be equal when different ids', () => {
    const entity1 = new TestEntity({ name: 'Test' }, 'id-1');
    const entity2 = new TestEntity({ name: 'Test' }, 'id-2');

    expect(entity1.equals(entity2)).toBe(false);
  });
});
```

**Rodar**: `npm test -- Entity.test`

---

## Step 3: Classes Base - ValueObject (30 min)

Crie `src/@core/domain/ValueObject.ts`:

```typescript
interface ValueObjectProps {
  [key: string]: any;
}

export abstract class ValueObject<T extends ValueObjectProps> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.props === undefined) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
```

**Teste** `src/@core/domain/__tests__/ValueObject.test.ts`:

```typescript
import { ValueObject } from '../ValueObject';

class TestVO extends ValueObject<{ value: number }> {
  get value(): number {
    return this.props.value;
  }
}

describe('ValueObject', () => {
  it('should be immutable', () => {
    const vo = new TestVO({ value: 42 });

    expect(() => {
      (vo as any).props.value = 100;
    }).toThrow();
  });

  it('should be equal when same props', () => {
    const vo1 = new TestVO({ value: 42 });
    const vo2 = new TestVO({ value: 42 });

    expect(vo1.equals(vo2)).toBe(true);
  });

  it('should not be equal when different props', () => {
    const vo1 = new TestVO({ value: 42 });
    const vo2 = new TestVO({ value: 100 });

    expect(vo1.equals(vo2)).toBe(false);
  });
});
```

---

## Step 4: Result Pattern (45 min)

Crie `src/@core/domain/Result.ts`:

```typescript
export class Result<T> {
  public isSuccess: boolean;
  public isFailure: boolean;
  public error?: Error;
  private _value?: T;

  private constructor(isSuccess: boolean, error?: Error, value?: T) {
    if (isSuccess && error) {
      throw new Error('Cannot have error with success result');
    }

    if (!isSuccess && !error) {
      throw new Error('Must have error with failure result');
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this._value = value;
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value from failed result');
    }

    return this._value as T;
  }

  public static ok<U>(value: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  public static fail<U>(error: Error): Result<U> {
    return new Result<U>(false, error);
  }

  public static combine(results: Result<any>[]): Result<any> {
    for (const result of results) {
      if (result.isFailure) return result;
    }
    return Result.ok(null);
  }
}
```

**Teste** `src/@core/domain/__tests__/Result.test.ts`:

```typescript
import { Result } from '../Result';

describe('Result', () => {
  it('should create success result', () => {
    const result = Result.ok(42);

    expect(result.isSuccess).toBe(true);
    expect(result.isFailure).toBe(false);
    expect(result.value).toBe(42);
  });

  it('should create failure result', () => {
    const result = Result.fail(new Error('Test error'));

    expect(result.isSuccess).toBe(false);
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toBe('Test error');
  });

  it('should throw when accessing value of failed result', () => {
    const result = Result.fail<number>(new Error('Test'));

    expect(() => result.value).toThrow('Cannot get value from failed result');
  });

  it('should combine results', () => {
    const r1 = Result.ok(1);
    const r2 = Result.ok(2);
    const r3 = Result.fail(new Error('Failed'));

    const combined = Result.combine([r1, r2, r3]);

    expect(combined.isFailure).toBe(true);
  });
});
```

---

## Step 5: UseCase Interface (15 min)

Crie `src/@core/application/UseCase.ts`:

```typescript
import { Result } from '@core/domain/Result';

export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>;
}
```

Simples! Não precisa teste (é só interface).

---

## Step 6: Repository Interface (15 min)

Crie `src/@core/infrastructure/Repository.ts`:

```typescript
export interface IRepository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}
```

---

## Step 7: Configurar TypeScript (15 min)

Edite `tsconfig.json`:

```json
{
  "compilerOptions": {
    // ... existing config
    "paths": {
      "@core/*": ["src/@core/*"],
      "@shared/*": ["src/@shared/*"],
      "@modules/*": ["src/modules/*"],
      "@adapters/*": ["src/adapters/*"]
    }
  }
}
```

**Teste**: Tente importar

```typescript
// Em qualquer arquivo
import { Entity } from '@core/domain/Entity';
import { Result } from '@core/domain/Result';
```

Se funcionar sem erros, ✅ path aliases configurados!

---

## Step 8: Validação Final (30 min)

### Checklist

- [ ] Todos os arquivos criados
- [ ] Todos os testes passando: `npm test`
- [ ] Build funcionando: `npm run build`
- [ ] Nenhum código legado quebrado
- [ ] Coverage igual ou melhor

### Comandos

```bash
# Testes
npm test

# Build
npm run build

# Coverage
npm run test:coverage

# Lint
npm run lint
```

### Expected Output

```
✅ All tests passing
✅ Build successful
✅ Coverage: 77% → 78% (classes base testadas)
✅ No regressions
```

---

## Step 9: Commit & Push (5 min)

```bash
git add src/@core src/@shared
git commit -m "feat(refactor): Phase 1 - Foundation

- Add Entity base class with identity comparison
- Add ValueObject base class with value equality
- Add Result pattern for error handling
- Add UseCase and Repository interfaces
- Configure TypeScript path aliases
- Add comprehensive unit tests (100% coverage)

Test: All existingtests passing + 15 new tests
Refs: tasks/refactor/06-plano-migracao.md#phase-1"

git push origin refactor/phase-1-foundation
```

---

## Step 10: Criar PR (10 min)

```markdown
## Fase 1: Fundação ✅

### Resumo
Implementação das classes base e interfaces core para a nova arquitetura DDD.

### Mudanças
- ✅ Classes base: Entity, ValueObject, AggregateRoot, Result
- ✅ Interfaces: UseCase, Repository, DatabaseConnection
- ✅ Path aliases configurados
- ✅ 100% test coverage nas classes base

### Checklist
- [x] Todos os testes passando
- [x] Build sem erros
- [x] Nenhuma regressão
- [x] Documentação atualizada

### Próximos Passos
- Fase 2: Módulo Symbol
```

---

## 🎉 Parabéns!

Você completou a Fase 1! A fundação está pronta para construir os módulos.

**Próximo**: [Fase 2 - Módulo Symbol](./phase-2-guide.md)

---

> [← Plano de Migração](./06-plano-migracao.md) | [Voltar ao Índice](./README.md)
