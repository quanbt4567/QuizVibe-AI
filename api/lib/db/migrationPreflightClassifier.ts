/**
 * QuizVibe AI — Supabase Migration Preflight Classifier (Phase 5.1.3 Hardened)
 * 
 * Implements deterministic PostgreSQL catalog-level state verification to prevent
 * false STATE A classifications, enforce fail-closed diagnosis, and validate
 * constraint, index, and trigger catalog invariants across migration phases.
 */

export type PreflightState = 'STATE_A' | 'STATE_A4' | 'STATE_B' | 'STATE_C';

export interface CatalogConstraint {
  name: string;
  tableSchema?: string;
  tableName?: string;
  type: 'UNIQUE' | 'PRIMARY KEY' | 'CHECK' | 'FOREIGN KEY';
  columns: string[];
  isValidated: boolean;
}

export interface CatalogIndex {
  name: string;
  tableSchema?: string;
  tableName?: string;
  isValid: boolean;
  isReady: boolean;
  isUnique?: boolean;
  columns: string[];
  predicate?: string;
  definition?: string;
  accessMethod?: string;
  keyColumnCount?: number;
  totalColumnCount?: number;
}

export interface CatalogTrigger {
  name: string;
  tableSchema?: string;
  tableName?: string;
  isInternal?: boolean;
  enabled: boolean;
  tgenabled?: string; // 'O' = origin/enabled, 'D' = disabled, 'A' = always, 'R' = replica
  functionName?: string;
  functionSchema?: string;
  timingEventCorrect?: boolean;
  definitionCorrect?: boolean;
}

export interface CatalogTriggerFunction {
  name: string;
  schema: string;
  securityDefiner: boolean;
  searchPathConfigured: boolean; // Must include public and extensions
  searchPathValue?: string; // Exact setting e.g. "public, extensions"
}

export interface DatabaseSchemaSnapshot {
  /** Public schema tables currently existing in the database */
  tables: string[];
  /** Columns present on public.quiz_sessions */
  quizSessionColumns: Array<{
    columnName: string;
    isNullable: 'YES' | 'NO';
    dataType?: string;
    columnDefault?: string | null;
  }>;
  /** Columns present on public.leads */
  leadsColumns: Array<{
    columnName: string;
    isNullable: 'YES' | 'NO';
    dataType?: string;
  }>;
  /** Extension status for pgcrypto */
  pgcrypto: {
    installed: boolean;
    schema?: string;
    digestCallable?: boolean;
  };
  /** Constraints present on public.quiz_sessions */
  constraints: Array<string | CatalogConstraint>;
  /** Indexes present on public.quiz_sessions */
  indexes: Array<string | CatalogIndex>;
  /** Trigger on public.quiz_sessions */
  trigger?: CatalogTrigger | null;
  /** Trigger function definition */
  triggerFunction?: CatalogTriggerFunction | null;
  /** Hash consistency metrics across session rows */
  hashAnomalies?: {
    nullHashCount: number;
    emptyHashCount: number;
    mismatchHashCount: number;
    emptyTokenCount: number;
    hashOnlyCount: number;
  };
}

export interface PreflightClassificationResult {
  state: PreflightState;
  stateLabel: string;
  isSafeToMigrate: boolean;
  isAlreadyApplied: boolean;
  requiresManualIntervention: boolean;
  reasons: string[];
  details: {
    baseTablesValid: boolean;
    baseColumnsValid: boolean;
    pgcryptoCompatible: boolean;
    phase4ColumnsPresent: boolean;
    phase4ColumnDefinitionsValid: boolean;
    phase4TokenUniqueValid: boolean;
    phase5HashPresent: boolean;
    triggerValid: boolean;
    triggerFunctionValid: boolean;
    indexesValid: boolean;
    constraintsValid: boolean;
    voucherCodeStatus: 'PRE_MIGRATION_NOT_NULL' | 'POST_MIGRATION_NULLABLE' | 'INVALID';
    hashConsistencyValid: boolean;
    hashConsistencyCheckAvailable: boolean;
  };
}

export const REQUIRED_BASE_TABLES = [
  'campaigns',
  'campaign_questions',
  'vouchers',
  'admin_sessions',
  'quiz_sessions',
  'leads',
] as const;

export const REQUIRED_BASE_QUIZ_SESSION_COLUMNS = [
  'id',
  'campaign_id',
  'status',
  'total_score',
  'correct_count',
  'total_questions',
  'time_taken_seconds',
  'answers_snapshot',
  'started_at',
  'completed_at',
  'created_at',
] as const;

export const PHASE4_COLUMNS = [
  'session_token',
  'current_question_index',
  'current_question_started_at',
] as const;

export const COMPATIBLE_PGCRYPTO_SCHEMAS = ['public', 'extensions'] as const;

/**
 * Normalizes a constraint item into a CatalogConstraint structure.
 */
function normalizeConstraint(item: string | CatalogConstraint): CatalogConstraint {
  if (typeof item === 'string') {
    // String-only constraint names do NOT establish schema, table, type, columns, or validation status!
    // They must fail closed so that string fixtures cannot masquerade as verified catalog state.
    return {
      name: item,
      tableSchema: undefined,
      tableName: undefined,
      type: 'UNIQUE',
      columns: [],
      isValidated: false,
    };
  }
  // When item is a CatalogConstraint object, do NOT default missing tableSchema or tableName!
  return { ...item };
}

/**
 * Normalizes an index item into a CatalogIndex structure.
 */
function normalizeIndex(item: string | CatalogIndex): CatalogIndex {
  if (typeof item === 'string') {
    // String-only index names do NOT establish schema, table, access method, columns, or validity!
    // They must fail closed so that string fixtures cannot masquerade as verified catalog state.
    // The name is preserved for diagnostics and STATE A premature artifact detection.
    return {
      name: item,
      tableSchema: undefined,
      tableName: undefined,
      isValid: false,
      isReady: false,
      isUnique: undefined,
      accessMethod: undefined,
      keyColumnCount: undefined,
      totalColumnCount: undefined,
      columns: [],
      predicate: undefined,
    };
  }
  // When item is a CatalogIndex object, do NOT default missing metadata to valid values.
  // Missing metadata must remain undefined to ensure strict fail-closed validation.
  return { ...item };
}

/**
 * Evaluates a database schema snapshot with PostgreSQL catalog-level validation.
 */
export function classifyMigrationState(
  snapshot: DatabaseSchemaSnapshot
): PreflightClassificationResult {
  const reasons: string[] = [];

  // 1. Check all required base tables
  const existingTables = new Set(snapshot.tables);
  const missingTables = REQUIRED_BASE_TABLES.filter(t => !existingTables.has(t));
  const baseTablesValid = missingTables.length === 0;
  if (!baseTablesValid) {
    reasons.push(`Missing required base table(s): ${missingTables.join(', ')}`);
  }

  // 2. Check quiz_sessions base columns
  const quizColMap = new Map(
    snapshot.quizSessionColumns.map(c => [c.columnName, c])
  );
  const missingBaseCols = REQUIRED_BASE_QUIZ_SESSION_COLUMNS.filter(c => !quizColMap.has(c));
  const baseColumnsValid = missingBaseCols.length === 0;
  if (!baseColumnsValid) {
    reasons.push(`Missing required base column(s) on quiz_sessions: ${missingBaseCols.join(', ')}`);
  }

  // 3. Check pgcrypto compatibility & digest callability (strictly fail-closed)
  let pgcryptoCompatible = false;
  let digestCallable = false;
  if (!snapshot.pgcrypto.installed) {
    reasons.push('pgcrypto extension is not installed');
  } else if (!snapshot.pgcrypto.schema || !COMPATIBLE_PGCRYPTO_SCHEMAS.includes(snapshot.pgcrypto.schema as any)) {
    reasons.push(
      `pgcrypto installed in incompatible schema "${snapshot.pgcrypto.schema}". Must be in 'public' or 'extensions' for search_path resolution.`
    );
  } else if (snapshot.pgcrypto.digestCallable !== true) {
    reasons.push(
      snapshot.pgcrypto.digestCallable === false
        ? 'pgcrypto digest() function failed test execution probe'
        : 'pgcrypto digest() test probe not verified (digestCallable is missing or undefined)'
    );
  } else {
    digestCallable = true;
    pgcryptoCompatible = true;
  }

  // 4. Check Phase 4 columns and definitions
  const presentPhase4Cols = PHASE4_COLUMNS.filter(c => quizColMap.has(c));
  const hasAllPhase4Cols = presentPhase4Cols.length === PHASE4_COLUMNS.length;
  const hasSomePhase4Cols = presentPhase4Cols.length > 0 && !hasAllPhase4Cols;
  if (hasSomePhase4Cols) {
    reasons.push(
      `Partial Phase 4 column state: found [${presentPhase4Cols.join(', ')}], missing [${PHASE4_COLUMNS.filter(c => !quizColMap.has(c)).join(', ')}]`
    );
  }

  let phase4ColumnDefinitionsValid = false;
  if (hasAllPhase4Cols) {
    let allDefsCorrect = true;

    // 4a. Validate session_token definition: text, nullable YES, no default
    const tokenCol = quizColMap.get('session_token')!;
    if (!tokenCol.dataType) {
      allDefsCorrect = false;
      reasons.push('Column session_token is missing dataType metadata');
    } else if (tokenCol.dataType.trim().toLowerCase() !== 'text') {
      allDefsCorrect = false;
      reasons.push(`Column session_token dataType is "${tokenCol.dataType}", expected "text"`);
    }
    if (tokenCol.isNullable !== 'YES') {
      allDefsCorrect = false;
      reasons.push(`Column session_token isNullable is "${tokenCol.isNullable}", expected "YES"`);
    }
    if (tokenCol.columnDefault === undefined) {
      allDefsCorrect = false;
      reasons.push('Column session_token is missing columnDefault metadata (expected null)');
    } else if (tokenCol.columnDefault !== null && tokenCol.columnDefault.trim().toUpperCase() !== 'NULL') {
      allDefsCorrect = false;
      reasons.push(`Column session_token has unexpected default "${tokenCol.columnDefault}", expected none (null)`);
    }

    // 4b. Validate current_question_index definition: smallint, nullable NO, default 0
    const qIdxCol = quizColMap.get('current_question_index')!;
    if (!qIdxCol.dataType) {
      allDefsCorrect = false;
      reasons.push('Column current_question_index is missing dataType metadata');
    } else {
      const dt = qIdxCol.dataType.trim().toLowerCase();
      if (dt !== 'smallint' && dt !== 'int2') {
        allDefsCorrect = false;
        reasons.push(`Column current_question_index dataType is "${qIdxCol.dataType}", expected "smallint"`);
      }
    }
    if (qIdxCol.isNullable !== 'NO') {
      allDefsCorrect = false;
      reasons.push(`Column current_question_index isNullable is "${qIdxCol.isNullable}", expected "NO"`);
    }
    if (qIdxCol.columnDefault === undefined || qIdxCol.columnDefault === null) {
      allDefsCorrect = false;
      reasons.push('Column current_question_index is missing columnDefault metadata (expected 0)');
    } else {
      const def = qIdxCol.columnDefault.trim().toLowerCase();
      const isZero =
        def === '0' ||
        def === "'0'" ||
        def === '0::smallint' ||
        def === "'0'::smallint" ||
        def === '0::integer' ||
        def === '0::int2' ||
        /^\s*'?0'?(\s*::\s*(smallint|int2|integer))?\s*$/.test(def);
      if (!isZero) {
        allDefsCorrect = false;
        reasons.push(`Column current_question_index default is "${qIdxCol.columnDefault}", expected "0"`);
      }
    }

    // 4c. Validate current_question_started_at definition: timestamp with time zone, nullable NO, default now()
    const startedCol = quizColMap.get('current_question_started_at')!;
    if (!startedCol.dataType) {
      allDefsCorrect = false;
      reasons.push('Column current_question_started_at is missing dataType metadata');
    } else {
      const dt = startedCol.dataType.trim().toLowerCase();
      if (dt !== 'timestamp with time zone' && dt !== 'timestamptz') {
        allDefsCorrect = false;
        reasons.push(`Column current_question_started_at dataType is "${startedCol.dataType}", expected "timestamp with time zone" or "timestamptz"`);
      }
    }
    if (startedCol.isNullable !== 'NO') {
      allDefsCorrect = false;
      reasons.push(`Column current_question_started_at isNullable is "${startedCol.isNullable}", expected "NO"`);
    }
    if (startedCol.columnDefault === undefined || startedCol.columnDefault === null) {
      allDefsCorrect = false;
      reasons.push('Column current_question_started_at is missing columnDefault metadata (expected now())');
    } else {
      const def = startedCol.columnDefault.trim().toLowerCase();
      const isNow =
        def === 'now()' ||
        def === 'current_timestamp' ||
        def === 'pg_catalog.now()' ||
        def === 'now()::timestamp with time zone' ||
        def === 'now()::timestamptz' ||
        /^\s*(now\(\)|current_timestamp|pg_catalog\.now\(\))(\s*::\s*(timestamp with time zone|timestamptz))?\s*$/i.test(def);
      if (!isNow) {
        allDefsCorrect = false;
        reasons.push(`Column current_question_started_at default is "${startedCol.columnDefault}", expected "now()"`);
      }
    }

    phase4ColumnDefinitionsValid = allDefsCorrect;
  }

  // 5. Check Phase 5 hash column
  const hasHashCol = quizColMap.has('session_token_hash');

  // 6. Check leads.voucher_code
  const leadsColMap = new Map(
    snapshot.leadsColumns.map(c => [c.columnName, c])
  );
  const voucherCodeCol = leadsColMap.get('voucher_code');
  let voucherCodeStatus: 'PRE_MIGRATION_NOT_NULL' | 'POST_MIGRATION_NULLABLE' | 'INVALID' = 'INVALID';

  if (!voucherCodeCol) {
    reasons.push('Missing column leads.voucher_code');
  } else if (voucherCodeCol.isNullable === 'NO') {
    voucherCodeStatus = 'PRE_MIGRATION_NOT_NULL';
  } else if (voucherCodeCol.isNullable === 'YES') {
    voucherCodeStatus = 'POST_MIGRATION_NULLABLE';
  }

  // 7. Validate Constraints (Catalog-level)
  const normalizedConstraints = snapshot.constraints.map(normalizeConstraint);
  
  // Phase 4 session_token uniqueness invariant
  const sessionTokenUniqueCon = normalizedConstraints.find(c =>
    c.tableSchema === 'public' &&
    c.tableName === 'quiz_sessions' &&
    c.type === 'UNIQUE' &&
    Array.isArray(c.columns) &&
    c.columns.length === 1 &&
    c.columns[0] === 'session_token'
  );
  const phase4TokenUniqueValid = Boolean(
    sessionTokenUniqueCon && sessionTokenUniqueCon.isValidated === true
  );
  if (hasAllPhase4Cols && !phase4TokenUniqueValid) {
    if (!sessionTokenUniqueCon) {
      reasons.push('Missing Phase 4 session_token unique constraint on public.quiz_sessions');
    } else if (sessionTokenUniqueCon.isValidated !== true) {
      reasons.push(`session_token unique constraint "${sessionTokenUniqueCon.name}" is NOT validated (convalidated = ${sessionTokenUniqueCon.isValidated})`);
    }
  }

  // Phase 5 session_token_hash uniqueness constraint
  const hashUniqueCon = normalizedConstraints.find(c =>
    c.name === 'quiz_sessions_token_hash_unique'
  );
  let hashUniqueValid = false;
  if (hashUniqueCon) {
    if (!hashUniqueCon.tableSchema || !hashUniqueCon.tableName || hashUniqueCon.tableSchema !== 'public' || hashUniqueCon.tableName !== 'quiz_sessions') {
      reasons.push(
        `Constraint quiz_sessions_token_hash_unique belongs to ${hashUniqueCon.tableSchema ?? 'unknown'}.${hashUniqueCon.tableName ?? 'unknown'}, expected public.quiz_sessions`
      );
    } else if (hashUniqueCon.type !== 'UNIQUE') {
      reasons.push(`Constraint quiz_sessions_token_hash_unique has type "${hashUniqueCon.type}", expected "UNIQUE"`);
    } else if (
      !Array.isArray(hashUniqueCon.columns) ||
      hashUniqueCon.columns.length !== 1 ||
      hashUniqueCon.columns[0] !== 'session_token_hash'
    ) {
      reasons.push(
        `Constraint quiz_sessions_token_hash_unique has incorrect columns [${(hashUniqueCon.columns || []).join(', ')}], expected [session_token_hash]`
      );
    } else if (hashUniqueCon.isValidated !== true) {
      reasons.push('Constraint quiz_sessions_token_hash_unique is NOT validated (convalidated = false)');
    } else {
      hashUniqueValid = true;
    }
    if (!hasHashCol) {
      reasons.push('Unexpected Phase 5 constraint quiz_sessions_token_hash_unique found before Phase 5 migration');
    }
  } else if (hasHashCol) {
    reasons.push('Missing Phase 5 constraint quiz_sessions_token_hash_unique on public.quiz_sessions');
  }

  // Any unvalidated or missing-metadata constraint on quiz_sessions is a violation
  for (const con of normalizedConstraints) {
    if (con.isValidated !== true) {
      reasons.push(`Constraint "${con.name}" on ${con.tableSchema ?? 'unknown'}.${con.tableName ?? 'unknown'} is not validated or missing catalog metadata`);
    }
  }

  // 8. Validate Indexes (Catalog-level strictly fail-closed)
  const normalizedIndexes = snapshot.indexes.map(normalizeIndex);

  interface IndexValidationSpec {
    columns: string[];
    expectedPredicateRegex?: RegExp;
    expectedPredicateSnippet?: string;
    keyColumnCount: number;
    totalColumnCount: number;
  }

  function validateIndex(
    idxName: string,
    spec: IndexValidationSpec
  ): boolean {
    const idx = normalizedIndexes.find(i => i.name === idxName);
    if (!idx) {
      return false;
    }
    if (!idx.tableSchema || !idx.tableName || idx.tableSchema !== 'public' || idx.tableName !== 'quiz_sessions') {
      reasons.push(`Index ${idxName} belongs to ${idx.tableSchema ?? 'unknown'}.${idx.tableName ?? 'unknown'}, expected public.quiz_sessions`);
      return false;
    }
    if (idx.isValid !== true) {
      reasons.push(`Index ${idxName} is INVALID (indisvalid = ${idx.isValid})`);
      return false;
    }
    if (idx.isReady !== true) {
      reasons.push(`Index ${idxName} is NOT ready (indisready = ${idx.isReady})`);
      return false;
    }
    if (idx.isUnique !== false) {
      reasons.push(`Index ${idxName} has unexpected UNIQUE flag (isUnique = ${idx.isUnique}, expected false)`);
      return false;
    }
    if (!idx.accessMethod || idx.accessMethod !== 'btree') {
      reasons.push(`Index ${idxName} uses access method "${idx.accessMethod ?? 'unknown'}", expected "btree"`);
      return false;
    }
    if (idx.keyColumnCount === undefined || idx.keyColumnCount !== spec.keyColumnCount) {
      reasons.push(`Index ${idxName} key column count is ${idx.keyColumnCount ?? 'undefined'}, expected ${spec.keyColumnCount}`);
      return false;
    }
    if (idx.totalColumnCount === undefined || idx.totalColumnCount !== spec.totalColumnCount) {
      reasons.push(`Index ${idxName} total column count is ${idx.totalColumnCount ?? 'undefined'}, expected ${spec.totalColumnCount}`);
      return false;
    }
    const hasCols =
      Array.isArray(idx.columns) &&
      idx.columns.length === spec.columns.length &&
      idx.columns.every((col, i) => col === spec.columns[i]);
    if (!hasCols) {
      reasons.push(`Index ${idxName} indexes columns [${(idx.columns || []).join(', ')}], expected [${spec.columns.join(', ')}]`);
      return false;
    }
    if (spec.expectedPredicateRegex || spec.expectedPredicateSnippet) {
      if (!idx.predicate) {
        reasons.push(`Index ${idxName} is missing required partial predicate "${spec.expectedPredicateSnippet ?? ''}"`);
        return false;
      }
      if (spec.expectedPredicateRegex) {
        if (!spec.expectedPredicateRegex.test(idx.predicate.trim())) {
          reasons.push(
            `Index ${idxName} predicate "${idx.predicate}" does not match required predicate "${spec.expectedPredicateSnippet ?? ''}"`
          );
          return false;
        }
      } else if (spec.expectedPredicateSnippet) {
        if (!idx.predicate.toUpperCase().includes(spec.expectedPredicateSnippet.toUpperCase())) {
          reasons.push(`Index ${idxName} predicate "${idx.predicate}" does not match expected "${spec.expectedPredicateSnippet}"`);
          return false;
        }
      }
    } else {
      if (idx.predicate) {
        reasons.push(`Index ${idxName} has unexpected partial predicate "${idx.predicate}", expected none`);
        return false;
      }
    }
    return true;
  }

  const tokenIndexValid = validateIndex('idx_quiz_sessions_token', {
    columns: ['session_token'],
    expectedPredicateRegex: /^\(+\s*session_token\s+IS\s+NOT\s+NULL\s*\)+$/i,
    expectedPredicateSnippet: 'session_token IS NOT NULL',
    keyColumnCount: 1,
    totalColumnCount: 1,
  });
  const hashIndexValid = validateIndex('idx_quiz_sessions_token_hash', {
    columns: ['session_token_hash'],
    expectedPredicateRegex: /^\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+$/i,
    expectedPredicateSnippet: 'session_token_hash IS NOT NULL',
    keyColumnCount: 1,
    totalColumnCount: 1,
  });
  const campaignStatusIndexValid = validateIndex('idx_quiz_sessions_campaign_status', {
    columns: ['campaign_id', 'status'],
    expectedPredicateSnippet: undefined,
    keyColumnCount: 2,
    totalColumnCount: 2,
  });

  const tokenIndexPresent = normalizedIndexes.some(i => i.name === 'idx_quiz_sessions_token');
  const campaignStatusIndexPresent = normalizedIndexes.some(i => i.name === 'idx_quiz_sessions_campaign_status');
  const hashIndexPresent = normalizedIndexes.some(i => i.name === 'idx_quiz_sessions_token_hash');

  // Push missing or unexpected index reasons based on expected phase
  if (hasAllPhase4Cols && !tokenIndexPresent) {
    reasons.push('Missing required Phase 4 index idx_quiz_sessions_token on public.quiz_sessions');
  }
  if (hasAllPhase4Cols && !campaignStatusIndexPresent) {
    reasons.push('Missing required Phase 4 index idx_quiz_sessions_campaign_status on public.quiz_sessions');
  }
  if (hasHashCol && !hashIndexPresent) {
    reasons.push('Missing required Phase 5 index idx_quiz_sessions_token_hash on public.quiz_sessions');
  }
  if (!hasHashCol && hashIndexPresent) {
    reasons.push('Unexpected Phase 5 index idx_quiz_sessions_token_hash present before Phase 5 migration');
  }

  const phase4IndexesValid = tokenIndexValid && campaignStatusIndexValid;
  const indexesValid = hasHashCol
    ? (phase4IndexesValid && hashIndexValid)
    : (hasAllPhase4Cols ? phase4IndexesValid : false);
  const constraintsValid = hasHashCol
    ? (phase4TokenUniqueValid && hashUniqueValid)
    : (hasAllPhase4Cols ? phase4TokenUniqueValid : false);

  // 9. Validate Trigger and Trigger Function Linkage
  const trigger = snapshot.trigger;
  const triggerFunc = snapshot.triggerFunction;
  
  let triggerValid = false;
  let triggerFunctionValid = false;

  const triggerPresent = Boolean(trigger && trigger.name === 'trg_sync_quiz_sessions_token_hash');
  const triggerFuncPresent = Boolean(triggerFunc && triggerFunc.name === 'sync_quiz_sessions_token_hash');

  if (triggerFuncPresent && triggerFunc) {
    if (triggerFunc.schema !== 'public') {
      reasons.push(`Trigger function schema is "${triggerFunc.schema}", expected "public"`);
    } else if (!triggerFunc.securityDefiner) {
      reasons.push('Trigger function is missing SECURITY DEFINER');
    } else if (!triggerFunc.searchPathConfigured) {
      reasons.push('Trigger function search_path does not include public, extensions');
    } else if (!triggerFunc.searchPathValue) {
      reasons.push('Trigger function search_path configuration value is missing or undefined');
    } else {
      const val = triggerFunc.searchPathValue.trim();
      const isExactTrusted =
        /^search_path\s*=\s*public\s*,\s*extensions$/i.test(val) ||
        /^public\s*,\s*extensions$/i.test(val);
      if (!isExactTrusted) {
        reasons.push(
          `Trigger function search_path "${triggerFunc.searchPathValue}" violates exact trusted contract "public, extensions"`
        );
      } else {
        triggerFunctionValid = true;
      }
    }
    if (!hasHashCol) {
      reasons.push('Unexpected Phase 5 trigger function public.sync_quiz_sessions_token_hash found before Phase 5 migration');
    }
  } else if (hasHashCol) {
    reasons.push('Missing Phase 5 trigger function public.sync_quiz_sessions_token_hash');
  }

  if (triggerPresent && trigger) {
    if (!trigger.tableSchema || trigger.tableSchema !== 'public' || !trigger.tableName || trigger.tableName !== 'quiz_sessions') {
      reasons.push(
        `Trigger ${trigger.name} is attached to ${trigger.tableSchema ?? 'unknown'}.${trigger.tableName ?? 'unknown'}, expected public.quiz_sessions`
      );
      if (!trigger.tableSchema) {
        reasons.push(`Trigger ${trigger.name} table schema is "undefined", expected "public"`);
      }
      if (!trigger.tableName) {
        reasons.push(`Trigger ${trigger.name} table name is "undefined", expected "quiz_sessions"`);
      }
    }

    if (trigger.isInternal !== false) {
      reasons.push(
        `Trigger ${trigger.name} is internal or has unverified isInternal flag (isInternal = ${trigger.isInternal}, expected false)`
      );
    }

    if (trigger.enabled !== true || trigger.tgenabled !== 'O') {
      reasons.push(
        `Trigger ${trigger.name} is not enabled or missing origin enabled status (enabled = ${trigger.enabled}, tgenabled = "${trigger.tgenabled ?? 'undefined'}", expected 'O')`
      );
    }

    if (!trigger.functionSchema || trigger.functionSchema !== 'public' || !trigger.functionName || trigger.functionName !== 'sync_quiz_sessions_token_hash') {
      reasons.push(
        `Trigger ${trigger.name} invokes ${trigger.functionSchema ?? 'unknown'}.${trigger.functionName ?? 'unknown'}, expected public.sync_quiz_sessions_token_hash`
      );
      if (!trigger.functionSchema) {
        reasons.push(`Trigger ${trigger.name} invokes function in schema "undefined", expected "public"`);
      }
      if (!trigger.functionName) {
        reasons.push(`Trigger ${trigger.name} invokes function "undefined", expected "sync_quiz_sessions_token_hash"`);
      }
    }

    if (trigger.timingEventCorrect !== true) {
      if (trigger.timingEventCorrect === false) {
        reasons.push(
          `Trigger ${trigger.name} has incorrect timing/event (expected BEFORE INSERT OR UPDATE FOR EACH ROW)`
        );
      } else {
        reasons.push(
          `Trigger ${trigger.name} has unverified timing/event (timingEventCorrect = undefined, expected true)`
        );
      }
    }

    if (trigger.definitionCorrect !== true) {
      if (trigger.definitionCorrect === false) {
        reasons.push(
          `Trigger ${trigger.name} definition mismatch in pg_get_triggerdef`
        );
      } else {
        reasons.push(
          `Trigger ${trigger.name} has unverified definition (definitionCorrect = undefined, expected true)`
        );
      }
    }

    if (!triggerFuncPresent) {
      reasons.push('Trigger exists but function sync_quiz_sessions_token_hash is missing');
    }

    triggerValid =
      trigger.tableSchema === 'public' &&
      trigger.tableName === 'quiz_sessions' &&
      trigger.isInternal === false &&
      trigger.enabled === true &&
      trigger.tgenabled === 'O' &&
      trigger.functionSchema === 'public' &&
      trigger.functionName === 'sync_quiz_sessions_token_hash' &&
      trigger.timingEventCorrect === true &&
      trigger.definitionCorrect === true &&
      triggerFunctionValid;

    if (!hasHashCol) {
      reasons.push('Unexpected Phase 5 trigger trg_sync_quiz_sessions_token_hash found before Phase 5 migration');
    }
  } else if (hasHashCol) {
    reasons.push('Missing Phase 5 trigger trg_sync_quiz_sessions_token_hash');
  }

  // Check voucher_code consistency against Phase 5 state
  if (voucherCodeStatus === 'POST_MIGRATION_NULLABLE' && !hasHashCol) {
    reasons.push('leads.voucher_code is NULLABLE before Phase 5 migration (Migration 000005 relaxation premature)');
  }
  if (voucherCodeStatus === 'PRE_MIGRATION_NOT_NULL' && hasHashCol && hasAllPhase4Cols) {
    reasons.push('leads.voucher_code is NOT NULL in applied Expand state (Migration 000005 relaxation missing)');
  }

  // 10. Check Hash Consistency & Safe Execution Guard
  let hashConsistencyCheckAvailable = true;
  let hashConsistencyValid = true;

  if (hasHashCol) {
    // Before executing or relying on hash checks that use digest(), pgcrypto MUST be compatible
    if (!pgcryptoCompatible || !digestCallable) {
      hashConsistencyCheckAvailable = false;
      hashConsistencyValid = false;
      reasons.push(
        `Cryptographic hash check UNAVAILABLE: pgcrypto is missing, in incompatible schema "${snapshot.pgcrypto.schema ?? 'none'}", or digest() probe failed.`
      );
    } else if (!snapshot.hashAnomalies) {
      hashConsistencyCheckAvailable = false;
      hashConsistencyValid = false;
      reasons.push(
        'Missing required hashAnomalies diagnostic object for database with session_token_hash column'
      );
    } else {
      const anomalies = snapshot.hashAnomalies;
      const requiredCounters = [
        'nullHashCount',
        'emptyHashCount',
        'mismatchHashCount',
        'emptyTokenCount',
        'hashOnlyCount',
      ] as const;

      let allCountersValidFormat = true;
      for (const counter of requiredCounters) {
        const val = (anomalies as any)[counter];
        const isValid =
          typeof val === 'number' &&
          Number.isFinite(val) &&
          !Number.isNaN(val) &&
          val >= 0 &&
          Number.isInteger(val);

        if (!isValid) {
          allCountersValidFormat = false;
          hashConsistencyValid = false;
          reasons.push(
            `Diagnostic counter "${counter}" is invalid (value: ${val}). Must be a finite, non-negative integer.`
          );
        }
      }

      if (allCountersValidFormat) {
        hashConsistencyCheckAvailable = true;

        if (anomalies.nullHashCount > 0) {
          hashConsistencyValid = false;
          reasons.push(`Found ${anomalies.nullHashCount} rows with plaintext session_token but NULL session_token_hash`);
        }
        if (anomalies.emptyHashCount > 0) {
          hashConsistencyValid = false;
          reasons.push(`Found ${anomalies.emptyHashCount} rows with empty or whitespace session_token_hash`);
        }
        if (anomalies.mismatchHashCount > 0) {
          hashConsistencyValid = false;
          reasons.push(`Found ${anomalies.mismatchHashCount} rows where session_token_hash does not match digest(session_token)`);
        }
        if (anomalies.emptyTokenCount > 0) {
          hashConsistencyValid = false;
          reasons.push(`Found ${anomalies.emptyTokenCount} rows with empty or whitespace plaintext session_token`);
        }
        // Note: hashOnlyCount >= 0 is legitimate during Expand phase when ENABLE_LEGACY_SESSION_TOKEN_WRITE=false
      }
    }
  }

  // =========================================================================
  // STRICT FAIL-CLOSED CLASSIFICATION LOGIC
  // =========================================================================

  // STATE A Preconditions (Strict Clean Pre-Migration):
  // 1. All base tables exist.
  // 2. All base quiz_sessions columns exist.
  // 3. pgcrypto is installed in compatible schema AND digest() is callable.
  // 4. ZERO Phase 4 columns exist.
  // 5. session_token_hash does NOT exist.
  // 6. Trigger does NOT exist.
  // 7. Trigger function does NOT exist.
  // 8. Hash unique constraint and token unique constraint do NOT exist.
  // 9. idx_quiz_sessions_token, idx_quiz_sessions_token_hash, idx_quiz_sessions_campaign_status do NOT exist.
  // 10. leads.voucher_code is STRICTLY NOT NULL ('NO').
  const hasAnyMigrationIndex = normalizedIndexes.some(
    i => i.name === 'idx_quiz_sessions_token' || i.name === 'idx_quiz_sessions_token_hash' || i.name === 'idx_quiz_sessions_campaign_status'
  );
  const hasAnyMigrationCon = normalizedConstraints.some(
    c => c.name === 'quiz_sessions_token_hash_unique' || (c.columns.length === 1 && c.columns[0] === 'session_token')
  );

  const isCleanStateA =
    baseTablesValid &&
    baseColumnsValid &&
    pgcryptoCompatible &&
    digestCallable &&
    presentPhase4Cols.length === 0 &&
    !hasHashCol &&
    !triggerPresent &&
    !triggerFuncPresent &&
    !hasAnyMigrationCon &&
    !hasAnyMigrationIndex &&
    voucherCodeStatus === 'PRE_MIGRATION_NOT_NULL';

  if (isCleanStateA) {
    return {
      state: 'STATE_A',
      stateLabel: 'STATE A: CLEAN PRE-MIGRATION STATE. Safe to execute Migration 000004 then 000005.',
      isSafeToMigrate: true,
      isAlreadyApplied: false,
      requiresManualIntervention: false,
      reasons: [],
      details: {
        baseTablesValid,
        baseColumnsValid,
        pgcryptoCompatible,
        phase4ColumnsPresent: false,
        phase4ColumnDefinitionsValid: false,
        phase4TokenUniqueValid: false,
        phase5HashPresent: false,
        triggerValid: false,
        triggerFunctionValid: false,
        indexesValid: false,
        constraintsValid: false,
        voucherCodeStatus,
        hashConsistencyValid: true,
        hashConsistencyCheckAvailable: true,
      },
    };
  }

  // STATE A4 Preconditions (Strict Intermediate Phase 4 Applied State):
  // 1. All base tables exist.
  // 2. All base quiz_sessions columns exist.
  // 3. All 3 Phase 4 columns exist with exact data types, nullability, and defaults from Migration 000004.
  // 4. pgcrypto is installed in compatible schema AND digest() is callable.
  // 5. Phase 4 session_token unique constraint exists and is validated.
  // 6. Phase 4 indexes (token & campaign_status) exist, belong to public.quiz_sessions, are valid and ready.
  // 7. ZERO Phase 5 artifacts exist:
  //    - session_token_hash column does NOT exist
  //    - quiz_sessions_token_hash_unique constraint does NOT exist
  //    - idx_quiz_sessions_token_hash does NOT exist
  //    - trg_sync_quiz_sessions_token_hash trigger does NOT exist
  //    - sync_quiz_sessions_token_hash function does NOT exist
  // 8. leads.voucher_code is STILL NOT NULL ('NO').
  const hasAnyPhase5Artifact =
    hasHashCol ||
    Boolean(hashUniqueCon) ||
    hashIndexPresent ||
    triggerPresent ||
    triggerFuncPresent;

  const isIntermediateStateA4 =
    baseTablesValid &&
    baseColumnsValid &&
    pgcryptoCompatible &&
    digestCallable &&
    hasAllPhase4Cols &&
    phase4ColumnDefinitionsValid &&
    phase4TokenUniqueValid &&
    phase4IndexesValid &&
    !hasAnyPhase5Artifact &&
    voucherCodeStatus === 'PRE_MIGRATION_NOT_NULL';

  if (isIntermediateStateA4) {
    return {
      state: 'STATE_A4',
      stateLabel: 'STATE A4: PHASE 4 APPLIED (READY FOR MIGRATION 000005). Safe to proceed with Migration 000005.',
      isSafeToMigrate: true,
      isAlreadyApplied: false,
      requiresManualIntervention: false,
      reasons: [],
      details: {
        baseTablesValid,
        baseColumnsValid,
        pgcryptoCompatible,
        phase4ColumnsPresent: true,
        phase4ColumnDefinitionsValid: true,
        phase4TokenUniqueValid: true,
        phase5HashPresent: false,
        triggerValid: false,
        triggerFunctionValid: false,
        indexesValid: true,
        constraintsValid: true,
        voucherCodeStatus,
        hashConsistencyValid: true,
        hashConsistencyCheckAvailable: false,
      },
    };
  }

  // STATE B Preconditions (Strict Fully Applied Expand State):
  // 1. All base tables exist.
  // 2. All base quiz_sessions columns exist.
  // 3. All 4 Phase 4 & Phase 5 columns exist with exact data types, nullability, and defaults.
  // 4. pgcrypto is installed in compatible schema and digest is resolvable.
  // 5. Phase 4 session_token unique constraint exists and is validated.
  // 6. Phase 5 hash unique constraint exists, is validated, and has correct columns.
  // 7. Required indexes exist, belong to public.quiz_sessions, are valid, ready, and have correct definitions.
  // 8. Trigger exists on public.quiz_sessions, is enabled, and correctly links to public.sync_quiz_sessions_token_hash.
  // 9. Trigger function is SECURITY DEFINER and has exact trusted search_path with public, extensions.
  // 10. leads.voucher_code is NULLABLE ('YES').
  // 11. Hash consistency checks were available and passed with 0 anomalies.
  const isAppliedStateB =
    baseTablesValid &&
    baseColumnsValid &&
    hasAllPhase4Cols &&
    phase4ColumnDefinitionsValid &&
    hasHashCol &&
    pgcryptoCompatible &&
    digestCallable &&
    phase4TokenUniqueValid &&
    hashUniqueValid &&
    indexesValid &&
    triggerValid &&
    triggerFunctionValid &&
    voucherCodeStatus === 'POST_MIGRATION_NULLABLE' &&
    hashConsistencyCheckAvailable &&
    hashConsistencyValid;

  if (isAppliedStateB) {
    return {
      state: 'STATE_B',
      stateLabel: 'STATE B: MIGRATIONS ALREADY APPLIED. System is in Expand Compatibility Mode.',
      isSafeToMigrate: false,
      isAlreadyApplied: true,
      requiresManualIntervention: false,
      reasons: [],
      details: {
        baseTablesValid,
        baseColumnsValid,
        pgcryptoCompatible,
        phase4ColumnsPresent: true,
        phase4ColumnDefinitionsValid: true,
        phase4TokenUniqueValid: true,
        phase5HashPresent: true,
        triggerValid: true,
        triggerFunctionValid: true,
        indexesValid: true,
        constraintsValid: true,
        voucherCodeStatus,
        hashConsistencyValid: true,
        hashConsistencyCheckAvailable: true,
      },
    };
  }

  // Otherwise: STATE C (FAIL CLOSED / MANUAL TRIAGE REQUIRED)
  if (reasons.length === 0) {
    reasons.push('Database schema partially matches migration state or has unclassified drift.');
  }

  return {
    state: 'STATE_C',
    stateLabel: 'STATE C: INCONSISTENT OR PARTIALLY APPLIED STATE. STOP! Do NOT rerun migrations. Manual inspection required.',
    isSafeToMigrate: false,
    isAlreadyApplied: false,
    requiresManualIntervention: true,
    reasons,
    details: {
      baseTablesValid,
      baseColumnsValid,
      pgcryptoCompatible,
      phase4ColumnsPresent: presentPhase4Cols.length > 0,
      phase4ColumnDefinitionsValid,
      phase4TokenUniqueValid,
      phase5HashPresent: hasHashCol,
      triggerValid,
      triggerFunctionValid,
      indexesValid,
      constraintsValid,
      voucherCodeStatus,
      hashConsistencyValid,
      hashConsistencyCheckAvailable,
    },
  };
}
