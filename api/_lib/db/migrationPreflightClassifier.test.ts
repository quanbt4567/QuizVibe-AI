import { describe, it, expect } from 'vitest';
import {
  classifyMigrationState,
  DatabaseSchemaSnapshot,
  REQUIRED_BASE_TABLES,
  REQUIRED_BASE_QUIZ_SESSION_COLUMNS,
} from './migrationPreflightClassifier.js';

function createCleanPreMigrationSnapshot(): DatabaseSchemaSnapshot {
  return {
    tables: [...REQUIRED_BASE_TABLES],
    quizSessionColumns: REQUIRED_BASE_QUIZ_SESSION_COLUMNS.map(col => ({
      columnName: col,
      isNullable: 'NO',
      dataType: 'text',
    })),
    leadsColumns: [
      { columnName: 'id', isNullable: 'NO' },
      { columnName: 'campaign_id', isNullable: 'NO' },
      { columnName: 'voucher_code', isNullable: 'NO' }, // Original NOT NULL
    ],
    pgcrypto: {
      installed: true,
      schema: 'extensions',
      digestCallable: true,
    },
    constraints: [
      {
        name: 'quiz_sessions_pkey',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'PRIMARY KEY',
        columns: ['id'],
        isValidated: true,
      },
    ],
    indexes: [
      {
        name: 'idx_quiz_sessions_campaign_created',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        columns: ['campaign_id', 'created_at'],
      },
    ],
    trigger: null,
    triggerFunction: null,
    hashAnomalies: {
      nullHashCount: 0,
      emptyHashCount: 0,
      mismatchHashCount: 0,
      emptyTokenCount: 0,
      hashOnlyCount: 0,
    },
  };
}

function createFullyAppliedSnapshot(): DatabaseSchemaSnapshot {
  return {
    tables: [...REQUIRED_BASE_TABLES],
    quizSessionColumns: [
      ...REQUIRED_BASE_QUIZ_SESSION_COLUMNS.map(col => ({
        columnName: col,
        isNullable: 'NO' as const,
        dataType: 'text',
      })),
      { columnName: 'session_token', isNullable: 'YES', dataType: 'text', columnDefault: null },
      { columnName: 'current_question_index', isNullable: 'NO', dataType: 'smallint', columnDefault: '0' },
      { columnName: 'current_question_started_at', isNullable: 'NO', dataType: 'timestamp with time zone', columnDefault: 'now()' },
      { columnName: 'session_token_hash', isNullable: 'YES' },
    ],
    leadsColumns: [
      { columnName: 'id', isNullable: 'NO' },
      { columnName: 'campaign_id', isNullable: 'NO' },
      { columnName: 'voucher_code', isNullable: 'YES' }, // Relaxed to NULLABLE
    ],
    pgcrypto: {
      installed: true,
      schema: 'extensions',
      digestCallable: true,
    },
    constraints: [
      {
        name: 'quiz_sessions_pkey',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'PRIMARY KEY',
        columns: ['id'],
        isValidated: true,
      },
      // Phase 4 token uniqueness invariant
      {
        name: 'quiz_sessions_session_token_key',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'UNIQUE',
        columns: ['session_token'],
        isValidated: true,
      },
      // Phase 5 hash uniqueness constraint
      {
        name: 'quiz_sessions_token_hash_unique',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'UNIQUE',
        columns: ['session_token_hash'],
        isValidated: true,
      },
    ],
    indexes: [
      {
        name: 'idx_quiz_sessions_campaign_created',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        columns: ['campaign_id', 'created_at'],
      },
      {
        name: 'idx_quiz_sessions_token',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        isUnique: false,
        accessMethod: 'btree',
        keyColumnCount: 1,
        totalColumnCount: 1,
        columns: ['session_token'],
        predicate: '(session_token IS NOT NULL)',
      },
      {
        name: 'idx_quiz_sessions_token_hash',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        isUnique: false,
        accessMethod: 'btree',
        keyColumnCount: 1,
        totalColumnCount: 1,
        columns: ['session_token_hash'],
        predicate: '(session_token_hash IS NOT NULL)',
      },
      {
        name: 'idx_quiz_sessions_campaign_status',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        isUnique: false,
        accessMethod: 'btree',
        keyColumnCount: 2,
        totalColumnCount: 2,
        columns: ['campaign_id', 'status'],
      },
    ],
    trigger: {
      name: 'trg_sync_quiz_sessions_token_hash',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isInternal: false,
      enabled: true,
      tgenabled: 'O',
      functionName: 'sync_quiz_sessions_token_hash',
      functionSchema: 'public',
      timingEventCorrect: true,
      definitionCorrect: true,
    },
    triggerFunction: {
      name: 'sync_quiz_sessions_token_hash',
      schema: 'public',
      securityDefiner: true,
      searchPathConfigured: true,
      searchPathValue: 'public, extensions',
    },
    hashAnomalies: {
      nullHashCount: 0,
      emptyHashCount: 0,
      mismatchHashCount: 0,
      emptyTokenCount: 0,
      hashOnlyCount: 5, // Legitimate under ENABLE_LEGACY_SESSION_TOKEN_WRITE=false
    },
  };
}

function createPhase4AppliedSnapshot(): DatabaseSchemaSnapshot {
  return {
    tables: [...REQUIRED_BASE_TABLES],
    quizSessionColumns: [
      ...REQUIRED_BASE_QUIZ_SESSION_COLUMNS.map(col => ({
        columnName: col,
        isNullable: 'NO' as const,
        dataType: 'text',
      })),
      { columnName: 'session_token', isNullable: 'YES', dataType: 'text', columnDefault: null },
      { columnName: 'current_question_index', isNullable: 'NO', dataType: 'smallint', columnDefault: '0' },
      { columnName: 'current_question_started_at', isNullable: 'NO', dataType: 'timestamp with time zone', columnDefault: 'now()' },
    ],
    leadsColumns: [
      { columnName: 'id', isNullable: 'NO' },
      { columnName: 'campaign_id', isNullable: 'NO' },
      { columnName: 'voucher_code', isNullable: 'NO' }, // Original NOT NULL preserved
    ],
    pgcrypto: {
      installed: true,
      schema: 'extensions',
      digestCallable: true,
    },
    constraints: [
      {
        name: 'quiz_sessions_pkey',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'PRIMARY KEY',
        columns: ['id'],
        isValidated: true,
      },
      {
        name: 'quiz_sessions_session_token_key',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        type: 'UNIQUE',
        columns: ['session_token'],
        isValidated: true,
      },
    ],
    indexes: [
      {
        name: 'idx_quiz_sessions_campaign_created',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        columns: ['campaign_id', 'created_at'],
      },
      {
        name: 'idx_quiz_sessions_token',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        isUnique: false,
        accessMethod: 'btree',
        keyColumnCount: 1,
        totalColumnCount: 1,
        columns: ['session_token'],
        predicate: '(session_token IS NOT NULL)',
      },
      {
        name: 'idx_quiz_sessions_campaign_status',
        tableSchema: 'public',
        tableName: 'quiz_sessions',
        isValid: true,
        isReady: true,
        isUnique: false,
        accessMethod: 'btree',
        keyColumnCount: 2,
        totalColumnCount: 2,
        columns: ['campaign_id', 'status'],
      },
    ],
    trigger: null,
    triggerFunction: null,
  };
}

describe('Phase 5.1.3: PostgreSQL Catalog Integrity & Preflight Classifier', () => {
  // Test 1: pgcrypto absent while hash column exists
  it('Test 1: returns STATE C if pgcrypto is absent while hash column exists, without throwing', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.pgcrypto = {
      installed: false,
      schema: undefined,
      digestCallable: false,
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.details.hashConsistencyCheckAvailable).toBe(false);
    expect(result.reasons.some(r => r.includes('pgcrypto extension is not installed'))).toBe(true);
    expect(result.reasons.some(r => r.includes('UNAVAILABLE'))).toBe(true);
  });

  // Test 2: pgcrypto installed in an incompatible schema while hash column exists
  it('Test 2: returns STATE C if pgcrypto is in an incompatible schema (e.g. custom_schema)', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.pgcrypto = {
      installed: true,
      schema: 'custom_schema',
      digestCallable: false,
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.details.hashConsistencyCheckAvailable).toBe(false);
    expect(result.reasons.some(r => r.includes('incompatible schema "custom_schema"'))).toBe(true);
  });

  // Test 3: Trigger with expected name attached to a different schema's table
  it('Test 3: returns STATE C if trigger is attached to audit.quiz_sessions instead of public.quiz_sessions', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.trigger = {
      name: 'trg_sync_quiz_sessions_token_hash',
      tableSchema: 'audit',
      tableName: 'quiz_sessions',
      isInternal: false,
      enabled: true,
      tgenabled: 'O',
      functionName: 'sync_quiz_sessions_token_hash',
      functionSchema: 'public',
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('attached to audit.quiz_sessions, expected public.quiz_sessions'))).toBe(true);
  });

  // Test 4: Trigger calling a different function
  it('Test 4: returns STATE C if trigger invokes an unexpected function', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.trigger = {
      name: 'trg_sync_quiz_sessions_token_hash',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isInternal: false,
      enabled: true,
      tgenabled: 'O',
      functionName: 'unrelated_function',
      functionSchema: 'public',
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('invokes public.unrelated_function, expected public.sync_quiz_sessions_token_hash'))).toBe(true);
  });

  // Test 5: Missing Phase 4 session_token uniqueness invariant
  it('Test 5: returns STATE C if Phase 4 session_token uniqueness invariant is missing', () => {
    const snapshot = createFullyAppliedSnapshot();
    // Remove the session_token unique constraint
    snapshot.constraints = snapshot.constraints.filter(
      c => typeof c !== 'object' || !c.columns.includes('session_token')
    );

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('Missing Phase 4 session_token unique constraint'))).toBe(true);
  });

  // Test 6: Same-named index with indisvalid = false
  it('Test 6: returns STATE C if a required index has indisvalid = false', () => {
    const snapshot = createFullyAppliedSnapshot();
    const idx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof idx === 'object') {
      idx.isValid = false;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('idx_quiz_sessions_token_hash is INVALID (indisvalid = false)'))).toBe(true);
  });

  // Test 7: Same-named index with indisready = false
  it('Test 7: returns STATE C if a required index has indisready = false', () => {
    const snapshot = createFullyAppliedSnapshot();
    const idx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token'
    );
    if (typeof idx === 'object') {
      idx.isReady = false;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('idx_quiz_sessions_token is NOT ready (indisready = false)'))).toBe(true);
  });

  // Test 8: Same-named index with incorrect indexed columns
  it('Test 8: returns STATE C if an index is built on incorrect columns', () => {
    const snapshot = createFullyAppliedSnapshot();
    const idx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof idx === 'object') {
      idx.columns = ['id']; // Incorrect indexed column
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('indexes columns [id], expected [session_token_hash]'))).toBe(true);
  });

  // Test 9: Hash unique constraint with incorrect constrained columns
  it('Test 9: returns STATE C if hash unique constraint constrains the wrong column', () => {
    const snapshot = createFullyAppliedSnapshot();
    const con = snapshot.constraints.find(
      c => typeof c === 'object' && c.name === 'quiz_sessions_token_hash_unique'
    );
    if (typeof con === 'object') {
      con.columns = ['id']; // Wrong column
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('incorrect columns [id], expected [session_token_hash]'))).toBe(true);
  });

  // Test 10: Constraint not validated (convalidated = false)
  it('Test 10: returns STATE C if a constraint is not validated (convalidated = false)', () => {
    const snapshot = createFullyAppliedSnapshot();
    const con = snapshot.constraints.find(
      c => typeof c === 'object' && c.name === 'quiz_sessions_token_hash_unique'
    );
    if (typeof con === 'object') {
      con.isValidated = false;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('NOT validated (convalidated = false)'))).toBe(true);
  });

  // Test 11: Fully valid STATE A remains STATE A
  it('Test 11: fully valid clean pre-migration schema remains STATE A', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    const result = classifyMigrationState(snapshot);

    expect(result.state).toBe('STATE_A');
    expect(result.isSafeToMigrate).toBe(true);
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.requiresManualIntervention).toBe(false);
    expect(result.reasons).toEqual([]);
    expect(result.stateLabel).toContain('STATE A: CLEAN PRE-MIGRATION STATE');
  });

  // Test 12: Fully valid STATE B remains STATE B
  it('Test 12: fully valid expand migration state with all catalog invariants remains STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    const result = classifyMigrationState(snapshot);

    expect(result.state).toBe('STATE_B');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.isAlreadyApplied).toBe(true);
    expect(result.requiresManualIntervention).toBe(false);
    expect(result.reasons).toEqual([]);
    expect(result.stateLabel).toContain('STATE B: MIGRATIONS ALREADY APPLIED');
  });

  // Test 13: Invalid existing index must not qualify as STATE A
  it('Test 13: invalid existing index must NOT qualify as STATE A (must fail to STATE C)', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    // Simulate an invalid index present before migration
    snapshot.indexes.push({
      name: 'idx_quiz_sessions_token',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isValid: false, // Invalid index
      isReady: false,
      columns: ['session_token'],
    });

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
  });

  // Test 14: Malformed existing index must not qualify as STATE A
  it('Test 14: malformed existing index (wrong columns) must NOT qualify as STATE A', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    // Simulate an index with wrong column present before migration
    snapshot.indexes.push({
      name: 'idx_quiz_sessions_token',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isValid: true,
      isReady: true,
      columns: ['wrong_col'],
    });

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
  });

  // Test 15: Hash-only rows are legitimate during Expand phase
  it('Test 15: non-zero hash-only rows do NOT prevent STATE B (legitimate under ENABLE_LEGACY_SESSION_TOKEN_WRITE=false)', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.hashAnomalies) {
      snapshot.hashAnomalies.hashOnlyCount = 12; // Permitted under Expand compatibility
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_B');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.isAlreadyApplied).toBe(true);
    expect(result.requiresManualIntervention).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  // Test 16: Incorrect trigger timing/event must prevent STATE B
  it('Test 16: incorrect trigger timing/event must prevent STATE B and fail to STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      snapshot.trigger.timingEventCorrect = false; // e.g. AFTER instead of BEFORE or missing UPDATE
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('incorrect timing/event'))).toBe(true);
  });

  // Test 17: Incorrect trigger definition must prevent STATE B
  it('Test 17: incorrect trigger definition must prevent STATE B and fail to STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      snapshot.trigger.definitionCorrect = false; // pg_get_triggerdef mismatch
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('definition mismatch in pg_get_triggerdef'))).toBe(true);
  });

  // Test 18: Incorrect function search_path must prevent STATE B
  it('Test 18: incorrect function search_path must prevent STATE B and fail to STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathConfigured = false;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('search_path does not include public, extensions'))).toBe(true);
  });

  // Test 19: Missing campaign_status index must prevent STATE B
  it('Test 19: missing idx_quiz_sessions_campaign_status must prevent STATE B and fail to STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.indexes = snapshot.indexes.filter(
      i => (typeof i === 'string' ? i : i.name) !== 'idx_quiz_sessions_campaign_status'
    );

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
  });

  // Test 20: Failed digest probe prevents STATE A and fails to STATE C
  it('Test 20: failed digest probe (digestCallable: false) prevents STATE A and fails to STATE C', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    snapshot.pgcrypto.digestCallable = false; // probe failed

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('digest() function failed test execution probe'))).toBe(true);
  });

  // Test 21: Missing hash for a non-empty plaintext token forces STATE C
  it('Test 21: missing hash for a non-empty plaintext token (nullHashCount > 0) forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.hashAnomalies) {
      snapshot.hashAnomalies.nullHashCount = 1;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('NULL session_token_hash'))).toBe(true);
  });

  // Test 22: Empty hash string forces STATE C
  it('Test 22: empty string hash (emptyHashCount > 0) forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.hashAnomalies) {
      snapshot.hashAnomalies.emptyHashCount = 1;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('empty or whitespace session_token_hash'))).toBe(true);
  });

  // Test 23: Empty plaintext token string forces STATE C
  it('Test 23: empty plaintext token string (emptyTokenCount > 0) forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.hashAnomalies) {
      snapshot.hashAnomalies.emptyTokenCount = 1;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('empty or whitespace plaintext session_token'))).toBe(true);
  });

  // Test 24: Token hash mismatch forces STATE C
  it('Test 24: token hash mismatch (mismatchHashCount > 0) forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.hashAnomalies) {
      snapshot.hashAnomalies.mismatchHashCount = 1;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('does not match digest(session_token)'))).toBe(true);
  });

  // Test 25: Untrusted schema preceding public in search_path forces STATE C
  it('Test 25: untrusted schema preceding public in search_path ("evil, public, extensions") forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathValue = 'evil, public, extensions';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('violates exact trusted contract "public, extensions"'))).toBe(true);
  });

  // Test 26: Unexpected schema appended to search_path forces STATE C
  it('Test 26: unexpected schema appended to search_path ("public, extensions, evil") forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathValue = 'public, extensions, evil';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('violates exact trusted contract "public, extensions"'))).toBe(true);
  });

  // Test 27: Reversed schema ordering in search_path forces STATE C
  it('Test 27: reversed schema ordering in search_path ("extensions, public") forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathValue = 'extensions, public';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('violates exact trusted contract "public, extensions"'))).toBe(true);
  });

  // Test 28: Missing extensions in search_path forces STATE C
  it('Test 28: missing extensions in search_path ("public") forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathValue = 'public';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('violates exact trusted contract "public, extensions"'))).toBe(true);
  });

  // Test 29: Missing public in search_path forces STATE C
  it('Test 29: missing public in search_path ("extensions") forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      snapshot.triggerFunction.searchPathValue = 'extensions';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('violates exact trusted contract "public, extensions"'))).toBe(true);
  });

  // Test 30: Unexpected unique flag on migration index forces STATE C
  it('Test 30: unexpected UNIQUE flag on idx_quiz_sessions_token forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token'
    );
    if (typeof tokenIdx === 'object') {
      tokenIdx.isUnique = true; // Unexpected unique flag
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('unexpected UNIQUE flag'))).toBe(true);
  });

  // Test 31: Non-btree access method forces STATE C
  it('Test 31: non-btree access method on migration index forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token'
    );
    if (typeof tokenIdx === 'object') {
      tokenIdx.accessMethod = 'hash'; // Unexpected access method
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.requiresManualIntervention).toBe(true);
    expect(result.reasons.some(r => r.includes('uses access method "hash", expected "btree"'))).toBe(true);
  });

  // Test 32: Missing (undefined) digestCallable on clean pre-migration snapshot fails closed to STATE C
  it('Test 32: missing (undefined) digestCallable on clean pre-migration snapshot forces STATE C', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    delete (snapshot.pgcrypto as any).digestCallable;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('digestCallable is missing or undefined'))).toBe(true);
  });

  // Test 33: Missing (undefined) digestCallable on applied snapshot forces STATE C
  it('Test 33: missing (undefined) digestCallable on applied snapshot forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    delete (snapshot.pgcrypto as any).digestCallable;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('digestCallable is missing or undefined'))).toBe(true);
  });

  // Test 34: Missing searchPathValue on trigger function forces STATE C
  it('Test 34: missing searchPathValue on trigger function forces STATE C even if searchPathConfigured is true', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.triggerFunction) {
      delete (snapshot.triggerFunction as any).searchPathValue;
      snapshot.triggerFunction.searchPathConfigured = true;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('search_path configuration value is missing or undefined'))).toBe(true);
  });

  // Test 35: Missing index access method forces STATE C
  it('Test 35: missing accessMethod (undefined) on migration index forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token'
    );
    if (typeof tokenIdx === 'object') {
      delete (tokenIdx as any).accessMethod;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('uses access method "unknown", expected "btree"'))).toBe(true);
  });

  // Test 36: Missing index keyColumnCount forces STATE C
  it('Test 36: missing keyColumnCount (undefined) on migration index forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      delete (hashIdx as any).keyColumnCount;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('key column count is undefined, expected 1'))).toBe(true);
  });

  // Test 37: Missing index totalColumnCount forces STATE C
  it('Test 37: missing totalColumnCount (undefined) on migration index forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const campIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_campaign_status'
    );
    if (typeof campIdx === 'object') {
      delete (campIdx as any).totalColumnCount;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('total column count is undefined, expected 2'))).toBe(true);
  });

  // Test 38: Missing token partial predicate forces STATE C
  it('Test 38: missing partial predicate on idx_quiz_sessions_token forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token'
    );
    if (typeof tokenIdx === 'object') {
      delete (tokenIdx as any).predicate;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('missing required partial predicate "session_token IS NOT NULL"'))).toBe(true);
  });

  // Test 39: Missing hash partial predicate forces STATE C
  it('Test 39: missing partial predicate on idx_quiz_sessions_token_hash forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      delete (hashIdx as any).predicate;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('missing required partial predicate "session_token_hash IS NOT NULL"'))).toBe(true);
  });

  // Test 40: Unexpected partial predicate on idx_quiz_sessions_campaign_status forces STATE C
  it('Test 40: unexpected partial predicate on idx_quiz_sessions_campaign_status forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const campIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_campaign_status'
    );
    if (typeof campIdx === 'object') {
      campIdx.predicate = '(status = \'active\')';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('has unexpected partial predicate "(status = \'active\')", expected none'))).toBe(true);
  });

  // Test 40b: Composite predicate on idx_quiz_sessions_token_hash forces STATE C
  it('Test 40b: composite predicate with AND on idx_quiz_sessions_token_hash forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      hashIdx.predicate = "(session_token_hash IS NOT NULL AND status = 'in_progress')";
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('does not match required predicate "session_token_hash IS NOT NULL"'))).toBe(true);
  });

  // Test 40c: Disjunctive predicate on idx_quiz_sessions_token_hash forces STATE C
  it('Test 40c: disjunctive predicate with OR on idx_quiz_sessions_token_hash forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      hashIdx.predicate = "(session_token_hash IS NOT NULL OR true)";
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('does not match required predicate "session_token_hash IS NOT NULL"'))).toBe(true);
  });

  // Test 40d: Predicate with wrong column on idx_quiz_sessions_token_hash forces STATE C
  it('Test 40d: predicate with wrong column on idx_quiz_sessions_token_hash forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      hashIdx.predicate = '(session_token IS NOT NULL)';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('does not match required predicate "session_token_hash IS NOT NULL"'))).toBe(true);
  });

  // Test 40e: Nested parenthesized predicate on idx_quiz_sessions_token_hash is accepted in STATE B
  it('Test 40e: nested parenthesized predicate on idx_quiz_sessions_token_hash is accepted in STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    const hashIdx = snapshot.indexes.find(
      i => typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash'
    );
    if (typeof hashIdx === 'object') {
      hashIdx.predicate = '((session_token_hash IS NOT NULL))';
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_B');
    expect(result.isAlreadyApplied).toBe(true);
  });

  // Test 41: Missing trigger.tableSchema forces STATE C
  it('Test 41: missing trigger.tableSchema forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).tableSchema;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('table schema is "undefined", expected "public"'))).toBe(true);
  });

  // Test 42: Missing trigger.tableName forces STATE C
  it('Test 42: missing trigger.tableName forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).tableName;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('table name is "undefined", expected "quiz_sessions"'))).toBe(true);
  });

  // Test 43: Missing trigger.functionName forces STATE C
  it('Test 43: missing trigger.functionName forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).functionName;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('invokes function "undefined", expected "sync_quiz_sessions_token_hash"'))).toBe(true);
  });

  // Test 44: Missing trigger.functionSchema forces STATE C
  it('Test 44: missing trigger.functionSchema forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).functionSchema;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('invokes function in schema "undefined", expected "public"'))).toBe(true);
  });

  // Test 45: Missing trigger.timingEventCorrect forces STATE C
  it('Test 45: missing trigger.timingEventCorrect forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).timingEventCorrect;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('unverified timing/event (timingEventCorrect = undefined, expected true)'))).toBe(true);
  });

  // Test 46: Missing trigger.definitionCorrect forces STATE C
  it('Test 46: missing trigger.definitionCorrect forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).definitionCorrect;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('unverified definition (definitionCorrect = undefined, expected true)'))).toBe(true);
  });

  // Test 47: Missing trigger.tgenabled forces STATE C
  it('Test 47: missing trigger.tgenabled forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    if (snapshot.trigger) {
      delete (snapshot.trigger as any).tgenabled;
    }

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.reasons.some(r => r.includes('missing origin enabled status (enabled = true, tgenabled = "undefined", expected \'O\')'))).toBe(true);
  });

  // Test 48: String-only constraint fixture cannot establish STATE B
  it('Test 48: string-only constraint fixture cannot establish STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    // Replace structured constraint objects with raw string names
    snapshot.constraints = [
      'quiz_sessions_pkey',
      'quiz_sessions_session_token_key',
      'quiz_sessions_token_hash_unique',
    ];

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('not validated or missing catalog metadata'))).toBe(true);
  });

  // Test 49: Missing hashAnomalies on applied snapshot forces STATE C
  it('Test 49: missing hashAnomalies on applied snapshot forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    delete (snapshot as any).hashAnomalies;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.hashConsistencyCheckAvailable).toBe(false);
    expect(result.reasons.some(r => r.includes('Missing required hashAnomalies diagnostic object'))).toBe(true);
  });

  // Test 50: Missing individual counter in hashAnomalies forces STATE C
  it('Test 50: missing individual counter in hashAnomalies forces STATE C', () => {
    const snapshot = createFullyAppliedSnapshot();
    delete (snapshot.hashAnomalies as any).emptyHashCount;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('Diagnostic counter "emptyHashCount" is invalid (value: undefined)'))).toBe(true);
  });

  // Test 51: NaN, Infinity, negative, and non-integer counters in hashAnomalies force STATE C
  it('Test 51: NaN, Infinity, negative, and non-integer counters in hashAnomalies force STATE C', () => {
    const invalidValues = [NaN, Infinity, -1, 2.5, '0' as any];

    for (const val of invalidValues) {
      const snapshot = createFullyAppliedSnapshot();
      snapshot.hashAnomalies!.mismatchHashCount = val;

      const result = classifyMigrationState(snapshot);
      expect(result.state).toBe('STATE_C');
      expect(result.isAlreadyApplied).toBe(false);
      expect(result.reasons.some(r => r.includes('Diagnostic counter "mismatchHashCount" is invalid'))).toBe(true);
    }
  });

  // Test 52: Legitimate positive hashOnlyCount remains valid in STATE B
  it('Test 52: legitimate positive hashOnlyCount remains valid in STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.hashAnomalies!.hashOnlyCount = 42; // Modern sessions written without plaintext tokens

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_B');
    expect(result.isAlreadyApplied).toBe(true);
    expect(result.details.hashConsistencyValid).toBe(true);
    expect(result.details.hashConsistencyCheckAvailable).toBe(true);
  });

  // Test 53: String-only idx_quiz_sessions_token cannot establish STATE B
  it('Test 53: string-only idx_quiz_sessions_token cannot establish STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    // Replace idx_quiz_sessions_token object with bare string
    snapshot.indexes = snapshot.indexes.map(i =>
      typeof i === 'object' && i.name === 'idx_quiz_sessions_token' ? 'idx_quiz_sessions_token' : i
    );

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('Index idx_quiz_sessions_token belongs to unknown.unknown, expected public.quiz_sessions'))).toBe(true);
  });

  // Test 54: String-only idx_quiz_sessions_token_hash cannot establish STATE B
  it('Test 54: string-only idx_quiz_sessions_token_hash cannot establish STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    // Replace idx_quiz_sessions_token_hash object with bare string
    snapshot.indexes = snapshot.indexes.map(i =>
      typeof i === 'object' && i.name === 'idx_quiz_sessions_token_hash' ? 'idx_quiz_sessions_token_hash' : i
    );

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('Index idx_quiz_sessions_token_hash belongs to unknown.unknown, expected public.quiz_sessions'))).toBe(true);
  });

  // Test 55: String-only idx_quiz_sessions_campaign_status cannot establish STATE B
  it('Test 55: string-only idx_quiz_sessions_campaign_status cannot establish STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    // Replace idx_quiz_sessions_campaign_status object with bare string
    snapshot.indexes = snapshot.indexes.map(i =>
      typeof i === 'object' && i.name === 'idx_quiz_sessions_campaign_status' ? 'idx_quiz_sessions_campaign_status' : i
    );

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.reasons.some(r => r.includes('Index idx_quiz_sessions_campaign_status belongs to unknown.unknown, expected public.quiz_sessions'))).toBe(true);
  });

  // Test 56: All three string-only migration index names together cannot establish STATE B
  it('Test 56: all three string-only migration index names together cannot establish STATE B', () => {
    const snapshot = createFullyAppliedSnapshot();
    snapshot.indexes = [
      'idx_quiz_sessions_token',
      'idx_quiz_sessions_token_hash',
      'idx_quiz_sessions_campaign_status',
    ];

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.indexesValid).toBe(false);
  });

  // Test 57: String-only index entries in pre-migration database are still detected by STATE A as premature migration artifacts
  it('Test 57: string-only index entries in pre-migration database are detected by STATE A as premature artifacts', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    // Prematurely add a string-only index fixture
    snapshot.indexes.push('idx_quiz_sessions_token');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 58: Verified live Phase 4 intermediate state returns STATE_A4
  it('Test 58: verified live Phase 4 intermediate state returns STATE_A4 (safe for Migration 000005)', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const result = classifyMigrationState(snapshot);

    expect(result.state).toBe('STATE_A4');
    expect(result.stateLabel).toContain('STATE A4: PHASE 4 APPLIED (READY FOR MIGRATION 000005)');
    expect(result.isSafeToMigrate).toBe(true);
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.requiresManualIntervention).toBe(false);
    expect(result.reasons).toEqual([]);
    expect(result.details.baseTablesValid).toBe(true);
    expect(result.details.baseColumnsValid).toBe(true);
    expect(result.details.pgcryptoCompatible).toBe(true);
    expect(result.details.phase4ColumnsPresent).toBe(true);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(true);
    expect(result.details.phase4TokenUniqueValid).toBe(true);
    expect(result.details.phase5HashPresent).toBe(false);
    expect(result.details.triggerValid).toBe(false);
    expect(result.details.triggerFunctionValid).toBe(false);
    expect(result.details.indexesValid).toBe(true);
    expect(result.details.constraintsValid).toBe(true);
    expect(result.details.voucherCodeStatus).toBe('PRE_MIGRATION_NOT_NULL');
  });

  // Test 59: Clean pre-migration database returns STATE_A
  it('Test 59: clean pre-migration database returns STATE_A', () => {
    const snapshot = createCleanPreMigrationSnapshot();
    const result = classifyMigrationState(snapshot);

    expect(result.state).toBe('STATE_A');
    expect(result.isSafeToMigrate).toBe(true);
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.requiresManualIntervention).toBe(false);
  });

  // Test 60: Fully applied Phase 5 returns STATE_B
  it('Test 60: fully applied Phase 5 returns STATE_B', () => {
    const snapshot = createFullyAppliedSnapshot();
    const result = classifyMigrationState(snapshot);

    expect(result.state).toBe('STATE_B');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.isAlreadyApplied).toBe(true);
    expect(result.requiresManualIntervention).toBe(false);
  });

  // Test 61: Intermediate state missing idx_quiz_sessions_token fails closed to STATE_C
  it('Test 61: intermediate state missing idx_quiz_sessions_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.indexes = snapshot.indexes.filter(i => (typeof i === 'string' ? i : i.name) !== 'idx_quiz_sessions_token');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Missing required Phase 4 index idx_quiz_sessions_token'))).toBe(true);
  });

  // Test 62: Intermediate state missing idx_quiz_sessions_campaign_status fails closed to STATE_C
  it('Test 62: intermediate state missing idx_quiz_sessions_campaign_status returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.indexes = snapshot.indexes.filter(i => (typeof i === 'string' ? i : i.name) !== 'idx_quiz_sessions_campaign_status');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Missing required Phase 4 index idx_quiz_sessions_campaign_status'))).toBe(true);
  });

  // Test 63: Intermediate state with invalid idx_quiz_sessions_token fails closed to STATE_C
  it('Test 63: intermediate state with invalid idx_quiz_sessions_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(i => (typeof i !== 'string' && i.name === 'idx_quiz_sessions_token')) as any;
    tokenIdx.isValid = false;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('INVALID'))).toBe(true);
  });

  // Test 64: Intermediate state with unready idx_quiz_sessions_token fails closed to STATE_C
  it('Test 64: intermediate state with unready idx_quiz_sessions_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(i => (typeof i !== 'string' && i.name === 'idx_quiz_sessions_token')) as any;
    tokenIdx.isReady = false;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('NOT ready'))).toBe(true);
  });

  // Test 65: Intermediate state with incorrect columns on idx_quiz_sessions_token fails closed to STATE_C
  it('Test 65: intermediate state with incorrect columns on idx_quiz_sessions_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const tokenIdx = snapshot.indexes.find(i => (typeof i !== 'string' && i.name === 'idx_quiz_sessions_token')) as any;
    tokenIdx.columns = ['wrong_column'];

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 66: Intermediate state missing Phase 4 session_token unique constraint fails closed to STATE_C
  it('Test 66: intermediate state missing session_token unique constraint returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.constraints = snapshot.constraints.filter(c => (typeof c === 'string' ? c : c.name) !== 'quiz_sessions_session_token_key');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Missing Phase 4 session_token unique constraint'))).toBe(true);
  });

  // Test 67: Intermediate state with unvalidated Phase 4 session_token unique constraint fails closed to STATE_C
  it('Test 67: intermediate state with unvalidated session_token unique constraint returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const tokenCon = snapshot.constraints.find(c => (typeof c !== 'string' && c.name === 'quiz_sessions_session_token_key')) as any;
    tokenCon.isValidated = false;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('NOT validated'))).toBe(true);
  });

  // Test 68: Intermediate state with premature session_token_hash column fails closed to STATE_C
  it('Test 68: intermediate state with premature session_token_hash column returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.quizSessionColumns.push({ columnName: 'session_token_hash', isNullable: 'YES' });

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 69: Intermediate state with premature quiz_sessions_token_hash_unique constraint fails closed to STATE_C
  it('Test 69: intermediate state with premature quiz_sessions_token_hash_unique constraint returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.constraints.push({
      name: 'quiz_sessions_token_hash_unique',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      type: 'UNIQUE',
      columns: ['session_token_hash'],
      isValidated: true,
    });

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Unexpected Phase 5 constraint quiz_sessions_token_hash_unique'))).toBe(true);
  });

  // Test 70: Intermediate state with premature idx_quiz_sessions_token_hash fails closed to STATE_C
  it('Test 70: intermediate state with premature idx_quiz_sessions_token_hash returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.indexes.push({
      name: 'idx_quiz_sessions_token_hash',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isValid: true,
      isReady: true,
      isUnique: false,
      accessMethod: 'btree',
      keyColumnCount: 1,
      totalColumnCount: 1,
      columns: ['session_token_hash'],
      predicate: '(session_token_hash IS NOT NULL)',
    });

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Unexpected Phase 5 index idx_quiz_sessions_token_hash'))).toBe(true);
  });

  // Test 71: Intermediate state with premature trg_sync_quiz_sessions_token_hash trigger fails closed to STATE_C
  it('Test 71: intermediate state with premature trg_sync_quiz_sessions_token_hash trigger returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.trigger = {
      name: 'trg_sync_quiz_sessions_token_hash',
      tableSchema: 'public',
      tableName: 'quiz_sessions',
      isInternal: false,
      enabled: true,
      tgenabled: 'O',
      functionName: 'sync_quiz_sessions_token_hash',
      functionSchema: 'public',
      timingEventCorrect: true,
      definitionCorrect: true,
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Unexpected Phase 5 trigger'))).toBe(true);
  });

  // Test 72: Intermediate state with premature sync_quiz_sessions_token_hash trigger function fails closed to STATE_C
  it('Test 72: intermediate state with premature sync_quiz_sessions_token_hash trigger function returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.triggerFunction = {
      name: 'sync_quiz_sessions_token_hash',
      schema: 'public',
      securityDefiner: true,
      searchPathConfigured: true,
      searchPathValue: 'public, extensions',
    };

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Unexpected Phase 5 trigger function'))).toBe(true);
  });

  // Test 73: Intermediate state with premature leads.voucher_code nullable ('YES') fails closed to STATE_C
  it('Test 73: intermediate state with premature leads.voucher_code nullable returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const vc = snapshot.leadsColumns.find(c => c.columnName === 'voucher_code');
    if (vc) vc.isNullable = 'YES';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
    expect(result.reasons.some(r => r.includes('Migration 000005 relaxation premature'))).toBe(true);
  });

  // Test 74: Intermediate state with string-only Phase 4 index fails closed to STATE_C without metadata
  it('Test 74: intermediate state with string-only Phase 4 index fails closed to STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.indexes = ['idx_quiz_sessions_token', 'idx_quiz_sessions_campaign_status'];

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 75: Intermediate state with missing base table fails closed to STATE_C
  it('Test 75: intermediate state with missing base table fails closed to STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.tables = snapshot.tables.filter(t => t !== 'quiz_sessions');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 76: Intermediate state with missing base quiz_sessions column fails closed to STATE_C
  it('Test 76: intermediate state with missing base quiz_sessions column fails closed to STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.quizSessionColumns = snapshot.quizSessionColumns.filter(c => c.columnName !== 'total_score');

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // Test 77: Intermediate state with missing pgcrypto or unverified digestCallable fails closed to STATE_C
  it('Test 77: intermediate state with unverified digestCallable fails closed to STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    snapshot.pgcrypto.digestCallable = false;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isSafeToMigrate).toBe(false);
  });

  // --- Phase 4 Column Definition Tests for STATE A4 ---

  // Test 78: Intermediate state with missing dataType on session_token fails closed to STATE_C
  it('Test 78: intermediate state with missing dataType on session_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.dataType = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing dataType metadata'))).toBe(true);
  });

  // Test 79: Intermediate state with incorrect dataType on session_token fails closed to STATE_C
  it('Test 79: intermediate state with incorrect dataType on session_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.dataType = 'varchar(255)';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "text"'))).toBe(true);
  });

  // Test 80: Intermediate state with incorrect isNullable on session_token fails closed to STATE_C
  it('Test 80: intermediate state with isNullable = NO on session_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.isNullable = 'NO';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "YES"'))).toBe(true);
  });

  // Test 81: Intermediate state with unexpected default on session_token fails closed to STATE_C
  it('Test 81: intermediate state with unexpected default on session_token returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.columnDefault = "'default_token'";

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('unexpected default'))).toBe(true);
  });

  // Test 81a: Intermediate state with session_token.columnDefault undefined fails closed to STATE_C
  it('Test 81a: intermediate state with session_token.columnDefault undefined returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.columnDefault = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('session_token is missing columnDefault metadata (expected null)'))).toBe(true);
  });

  // Test 81b: Intermediate state with session_token.columnDefault null or 'NULL' succeeds as STATE_A4
  it('Test 81b: intermediate state with session_token.columnDefault explicitly null or "NULL" returns STATE_A4', () => {
    const snapshotNull = createPhase4AppliedSnapshot();
    const colNull = snapshotNull.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    colNull.columnDefault = null;
    const resultNull = classifyMigrationState(snapshotNull);
    expect(resultNull.state).toBe('STATE_A4');
    expect(resultNull.details.phase4ColumnDefinitionsValid).toBe(true);

    const snapshotStr = createPhase4AppliedSnapshot();
    const colStr = snapshotStr.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    colStr.columnDefault = 'NULL';
    const resultStr = classifyMigrationState(snapshotStr);
    expect(resultStr.state).toBe('STATE_A4');
    expect(resultStr.details.phase4ColumnDefinitionsValid).toBe(true);
  });

  // Test 82: Intermediate state with missing dataType on current_question_index fails closed to STATE_C
  it('Test 82: intermediate state with missing dataType on current_question_index returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.dataType = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing dataType metadata'))).toBe(true);
  });

  // Test 83: Intermediate state with incorrect dataType on current_question_index fails closed to STATE_C
  it('Test 83: intermediate state with incorrect dataType on current_question_index returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.dataType = 'integer';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "smallint"'))).toBe(true);
  });

  // Test 84: Intermediate state with isNullable = YES on current_question_index fails closed to STATE_C
  it('Test 84: intermediate state with isNullable = YES on current_question_index returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.isNullable = 'YES';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "NO"'))).toBe(true);
  });

  // Test 85: Intermediate state with missing default on current_question_index fails closed to STATE_C
  it('Test 85: intermediate state with missing default on current_question_index returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.columnDefault = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing columnDefault metadata (expected 0)'))).toBe(true);
  });

  // Test 86: Intermediate state with incorrect default on current_question_index fails closed to STATE_C
  it('Test 86: intermediate state with incorrect default on current_question_index returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.columnDefault = '1';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "0"'))).toBe(true);
  });

  // Test 87: Intermediate state with missing dataType on current_question_started_at fails closed to STATE_C
  it('Test 87: intermediate state with missing dataType on current_question_started_at returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.dataType = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing dataType metadata'))).toBe(true);
  });

  // Test 88: Intermediate state with incorrect dataType on current_question_started_at fails closed to STATE_C
  it('Test 88: intermediate state with incorrect dataType on current_question_started_at returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.dataType = 'timestamp without time zone';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "timestamp with time zone"'))).toBe(true);
  });

  // Test 89: Intermediate state with isNullable = YES on current_question_started_at fails closed to STATE_C
  it('Test 89: intermediate state with isNullable = YES on current_question_started_at returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.isNullable = 'YES';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "NO"'))).toBe(true);
  });

  // Test 90: Intermediate state with missing default on current_question_started_at fails closed to STATE_C
  it('Test 90: intermediate state with missing default on current_question_started_at returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.columnDefault = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing columnDefault metadata (expected now())'))).toBe(true);
  });

  // Test 91: Intermediate state with incorrect default on current_question_started_at fails closed to STATE_C
  it('Test 91: intermediate state with incorrect default on current_question_started_at returns STATE_C', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.columnDefault = "'2026-01-01 00:00:00+00'";

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "now()"'))).toBe(true);
  });

  // Test 92: Intermediate state with valid normalized PostgreSQL default expressions succeeds as STATE_A4
  it('Test 92: intermediate state with normalized PostgreSQL aliases (int2, 0::smallint, timestamptz, CURRENT_TIMESTAMP) returns STATE_A4', () => {
    const snapshot = createPhase4AppliedSnapshot();
    const qIdx = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    qIdx.dataType = 'int2';
    qIdx.columnDefault = "'0'::smallint";

    const started = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    started.dataType = 'timestamptz';
    started.columnDefault = 'CURRENT_TIMESTAMP';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_A4');
    expect(result.details.phase4ColumnDefinitionsValid).toBe(true);
    expect(result.isSafeToMigrate).toBe(true);
  });

  // --- Phase 4 Column Definition Tests for STATE B ---

  // Test 93: Applied STATE B with missing dataType on session_token fails closed to STATE_C
  it('Test 93: applied STATE B with missing dataType on session_token returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.dataType = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('session_token is missing dataType metadata'))).toBe(true);
  });

  // Test 94: Applied STATE B with incorrect dataType on current_question_index fails closed to STATE_C
  it('Test 94: applied STATE B with incorrect dataType on current_question_index returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.dataType = 'bigint';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "smallint"'))).toBe(true);
  });

  // Test 95: Applied STATE B with isNullable = YES on current_question_started_at fails closed to STATE_C
  it('Test 95: applied STATE B with isNullable = YES on current_question_started_at returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.isNullable = 'YES';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('expected "NO"'))).toBe(true);
  });

  // Test 96: Applied STATE B with missing default on current_question_index fails closed to STATE_C
  it('Test 96: applied STATE B with missing default on current_question_index returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    col.columnDefault = null;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing columnDefault metadata (expected 0)'))).toBe(true);
  });

  // Test 97: Applied STATE B with missing default on current_question_started_at fails closed to STATE_C
  it('Test 97: applied STATE B with missing default on current_question_started_at returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    col.columnDefault = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('missing columnDefault metadata (expected now())'))).toBe(true);
  });

  // Test 98: Applied STATE B with unexpected default on session_token fails closed to STATE_C
  it('Test 98: applied STATE B with unexpected default on session_token returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.columnDefault = "'invalid_default'";

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('unexpected default'))).toBe(true);
  });

  // Test 98a: Applied STATE B with session_token.columnDefault undefined fails closed to STATE_C
  it('Test 98a: applied STATE B with session_token.columnDefault undefined returns STATE_C', () => {
    const snapshot = createFullyAppliedSnapshot();
    const col = snapshot.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    col.columnDefault = undefined;

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_C');
    expect(result.isAlreadyApplied).toBe(false);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(false);
    expect(result.reasons.some(r => r.includes('session_token is missing columnDefault metadata (expected null)'))).toBe(true);
  });

  // Test 98b: Applied STATE B with session_token.columnDefault explicitly null or 'NULL' remains STATE_B
  it('Test 98b: applied STATE B with session_token.columnDefault explicitly null or "NULL" remains STATE_B', () => {
    const snapshotNull = createFullyAppliedSnapshot();
    const colNull = snapshotNull.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    colNull.columnDefault = null;
    const resultNull = classifyMigrationState(snapshotNull);
    expect(resultNull.state).toBe('STATE_B');
    expect(resultNull.isAlreadyApplied).toBe(true);
    expect(resultNull.details.phase4ColumnDefinitionsValid).toBe(true);

    const snapshotStr = createFullyAppliedSnapshot();
    const colStr = snapshotStr.quizSessionColumns.find(c => c.columnName === 'session_token')!;
    colStr.columnDefault = 'NULL';
    const resultStr = classifyMigrationState(snapshotStr);
    expect(resultStr.state).toBe('STATE_B');
    expect(resultStr.isAlreadyApplied).toBe(true);
    expect(resultStr.details.phase4ColumnDefinitionsValid).toBe(true);
  });

  // Test 99: Applied STATE B with normalized PostgreSQL aliases remains STATE_B
  it('Test 99: applied STATE B with normalized PostgreSQL aliases (int2, timestamptz, now()::timestamptz) remains STATE_B', () => {
    const snapshot = createFullyAppliedSnapshot();
    const qIdx = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_index')!;
    qIdx.dataType = 'int2';
    qIdx.columnDefault = '0::int2';

    const started = snapshot.quizSessionColumns.find(c => c.columnName === 'current_question_started_at')!;
    started.dataType = 'timestamptz';
    started.columnDefault = 'now()::timestamptz';

    const result = classifyMigrationState(snapshot);
    expect(result.state).toBe('STATE_B');
    expect(result.isAlreadyApplied).toBe(true);
    expect(result.details.phase4ColumnDefinitionsValid).toBe(true);
  });
});

describe('supabase/preflight_diagnostic_v2.sql Static SQL and PL/pgSQL Integrity', () => {
  const fs = require('fs');
  const path = require('path');
  const sqlPath = path.resolve(process.cwd(), 'supabase', 'preflight_diagnostic_v2.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  it('declares all PL/pgSQL variables used in the DO block without any undeclared variable', () => {
    const declareMatch = sqlContent.match(/DECLARE([\s\S]*?)BEGIN/);
    expect(declareMatch).not.toBeNull();
    const declareBlock = declareMatch![1];

    const bodyMatch = sqlContent.match(/BEGIN([\s\S]*?)END\s*\$\$;/);
    expect(bodyMatch).not.toBeNull();
    const bodyBlock = bodyMatch![1];

    const declRegex = /(v_[a-zA-Z0-9_]+)/g;
    const declaredVars = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = declRegex.exec(declareBlock)) !== null) {
      declaredVars.add(m[1]);
    }

    const usedVars = new Set<string>();
    while ((m = declRegex.exec(bodyBlock)) !== null) {
      usedVars.add(m[1]);
    }

    // Verify declared variables are non-empty
    expect(declaredVars.size).toBeGreaterThanOrEqual(30);

    // Verify no undeclared variables
    const undeclared: string[] = [];
    for (const v of usedVars) {
      if (!declaredVars.has(v)) {
        undeclared.push(v);
      }
    }
    expect(undeclared).toEqual([]);

    // Verify all declared variables are actually used
    const unused: string[] = [];
    for (const v of declaredVars) {
      if (!usedVars.has(v)) {
        unused.push(v);
      }
    }
    expect(unused).toEqual([]);
  });

  it('explicitly does not contain the buggy v_missing_cols variable name anywhere', () => {
    expect(sqlContent).not.toContain('v_missing_cols');
    expect(sqlContent).toContain('v_missing_base_cols');
  });

  it('verifies that index checks in sections 8a, 8b, and 8c use scalar subqueries without outer FROM clauses', () => {
    // Check that section 8b does not have a trailing FROM clause on its SELECT INTO statement
    const section8bMatch = sqlContent.match(/-- 8b\. idx_quiz_sessions_token_hash([\s\S]*?)INTO v_hash_idx_exists, v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct;([\s\S]*?)-- 8c\./);
    expect(section8bMatch).not.toBeNull();
    const afterInto8b = section8bMatch![2].trim();
    expect(afterInto8b).not.toMatch(/FROM\s+pg_index/i);

    // Check that section 8c does not have a trailing FROM clause on its SELECT INTO statement
    const section8cMatch = sqlContent.match(/-- 8c\. idx_quiz_sessions_campaign_status([\s\S]*?)INTO v_campaign_status_idx_exists, v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct;([\s\S]*?)-- 9\./);
    expect(section8cMatch).not.toBeNull();
    const afterInto8c = section8cMatch![2].trim();
    expect(afterInto8c).not.toMatch(/FROM\s+pg_index/i);
  });

  it('verifies that STATE A condition checks index existence and requires digest capability', () => {
    const stateAMatch = sqlContent.match(/-- Strict STATE A[\s\S]*?IF([\s\S]*?)THEN\s*v_is_state_a := TRUE;/);
    expect(stateAMatch).not.toBeNull();
    const stateAConditions = stateAMatch![1];

    expect(stateAConditions).toContain('v_digest_resolvable');
    expect(stateAConditions).toContain('NOT v_token_idx_exists');
    expect(stateAConditions).toContain('NOT v_hash_idx_exists');
    expect(stateAConditions).toContain('NOT v_campaign_status_idx_exists');
    expect(stateAConditions).toContain('NOT v_token_con_exists');
    expect(stateAConditions).toContain('NOT v_hash_con_exists');
    expect(stateAConditions).toContain('NOT v_trigger_exists');
    expect(stateAConditions).toContain('NOT v_func_exists');
  });

  it('verifies that STATE B condition permits legitimate hash-only rows and checks genuine inconsistencies', () => {
    const stateBMatch = sqlContent.match(/-- Strict STATE B[\s\S]*?IF([\s\S]*?)THEN\s*v_is_state_b := TRUE;/);
    expect(stateBMatch).not.toBeNull();
    const stateBConditions = stateBMatch![1];

    // Must NOT require v_hash_only_count = 0
    expect(stateBConditions).not.toContain('v_hash_only_count = 0');

    // Must require zero genuine anomalies
    expect(stateBConditions).toContain('v_null_hash_count = 0');
    expect(stateBConditions).toContain('v_empty_hash_count = 0');
    expect(stateBConditions).toContain('v_mismatch_hash_count = 0');
    expect(stateBConditions).toContain('v_empty_token_count = 0');
  });

  it('verifies that function search_path uses exact trusted contract "public, extensions"', () => {
    // Regex in function check must enforce ^search_path\s*=\s*public\s*,\s*extensions$
    expect(sqlContent).toContain('^search_path\\s*=\\s*public\\s*,\\s*extensions$');
  });

  it('verifies that comprehensive diagnostic failure notices exist for every failed invariant in STATE C', () => {
    const stateCMatch = sqlContent.match(/VERDICT: STATE C: INCONSISTENT OR PARTIALLY APPLIED STATE([\s\S]*?)END \$\$;/);
    expect(stateCMatch).not.toBeNull();
    const stateCBody = stateCMatch![1];

    expect(stateCBody).toContain('-> FAILURE: Missing base tables:');
    expect(stateCBody).toContain('-> FAILURE: Missing base quiz_sessions columns:');
    expect(stateCBody).toContain('-> FAILURE: pgcrypto extension is not installed');
    expect(stateCBody).toContain('-> FAILURE: Partial Phase 4 columns present');
    expect(stateCBody).toContain('-> FAILURE: Premature migration artifacts exist on pre-migration database');
    expect(stateCBody).toContain('-> FAILURE: Index idx_quiz_sessions_token is invalid or malformed');
    expect(stateCBody).toContain('-> FAILURE: Index idx_quiz_sessions_token_hash is invalid or malformed');
    expect(stateCBody).toContain('-> FAILURE: Index idx_quiz_sessions_campaign_status is invalid or malformed');
    expect(stateCBody).toContain('-> FAILURE: Trigger trg_sync_quiz_sessions_token_hash has incorrect timing/event');
    expect(stateCBody).toContain('-> FAILURE: Trigger definition mismatch in pg_get_triggerdef');
    expect(stateCBody).toContain('-> FAILURE: Function sync_quiz_sessions_token_hash is missing exact trusted search_path (public, extensions)');
    expect(stateCBody).not.toContain('violating Expand compatibility contract'); // hash-only is not a failure
  });


  it('contains strictly zero mutation DDL or DML statements outside comments', () => {
    // Strip comments (-- line comments and /* block comments */)
    const stripped = sqlContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Forbidden mutation statements
    const forbiddenPatterns = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+public\./i,
      /\bDELETE\s+FROM\b/i,
      /\bALTER\s+TABLE\b/i,
      /\bCREATE\s+(TABLE|INDEX|TRIGGER|FUNCTION|PROCEDURE)\b/i,
      /\bDROP\s+(TABLE|INDEX|TRIGGER|FUNCTION|PROCEDURE|EXTENSION)\b/i,
      /\bTRUNCATE\b/i,
    ];

    for (const pattern of forbiddenPatterns) {
      expect(stripped).not.toMatch(pattern);
    }
  });

  it('guarantees all catalog attribute names in array constructors are explicitly cast to text (a.attname::text)', () => {
    // Find all occurrences of attname in the file outside comments
    const stripped = sqlContent.replace(/--.*$/gm, '');
    const attnameMatches = [...stripped.matchAll(/\b(?:[a-zA-Z0-9_]+\.)?attname\b/g)];
    expect(attnameMatches.length).toBeGreaterThanOrEqual(6);

    // Assert that every select of attname is followed by ::text
    const rawAttnameRegex = /\bSELECT\s+([a-zA-Z0-9_]+\.)?attname(?!\s*::\s*text)\b/gi;
    const rawMatches = [...stripped.matchAll(rawAttnameRegex)];
    expect(rawMatches).toHaveLength(0);
  });

  it('guarantees all array literal comparisons with catalog columns use explicit ::text[] casts', () => {
    const stripped = sqlContent.replace(/--.*$/gm, '');
    // Check that every "= ARRAY['...']" comparison has "::text[]"
    const uncastArrayComparison = /=\s*ARRAY\s*\[[^\]]+\](?!\s*::\s*text\[\])/gi;
    const uncastMatches = [...stripped.matchAll(uncastArrayComparison)];
    expect(uncastMatches).toHaveLength(0);
  });

  it('preserves WITH ORDINALITY column ordering in all constraint and index array extractions', () => {
    const stripped = sqlContent.replace(/--.*$/gm, '');
    // Check conkey and indkey extractions
    const conkeyMatches = [...stripped.matchAll(/unnest\([a-zA-Z0-9_]+\.conkey\)\s+WITH\s+ORDINALITY/gi)];
    const indkeyMatches = [...stripped.matchAll(/unnest\([a-zA-Z0-9_]+\.indkey\)\s+WITH\s+ORDINALITY/gi)];
    expect(conkeyMatches.length).toBeGreaterThanOrEqual(3);
    expect(indkeyMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('correctly uses aclexplode and grantee OID 0 for pseudo-role PUBLIC in schema privilege audit query', () => {
    const stripped = sqlContent.replace(/--.*$/gm, '');
    // Must NOT call has_schema_privilege with pseudo-role 'public'
    expect(stripped).not.toMatch(/has_schema_privilege\s*\(\s*['"]public['"]/i);

    // Must use aclexplode with acldefault fallback for NULL nspacl
    expect(sqlContent).toContain("aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner)))");

    // Must test a.grantee = 0 AND a.privilege_type = 'CREATE'
    expect(sqlContent).toContain("a.grantee = 0 AND a.privilege_type = 'CREATE'");

    // Must separately test explicit vs effective CREATE privileges for anon and authenticated
    expect(sqlContent).toContain("public_pseudo_role_has_explicit_create");
    expect(sqlContent).toContain("anon_has_explicit_create");
    expect(sqlContent).toContain("authenticated_has_explicit_create");
    expect(sqlContent).toContain("anon_has_effective_create");
    expect(sqlContent).toContain("authenticated_has_effective_create");

    // Must filter exactly on n.nspname = 'public'
    expect(sqlContent).toContain("WHERE n.nspname = 'public'");
  });

  it('contains a final SELECT statement returning the 10 required diagnostic verdict columns', () => {
    // Must find Section 10 with the required final SELECT
    const section10Match = sqlContent.match(/-- 10\. Final Migration-State Verdict Result Set[\s\S]*?SELECT([\s\S]*?);/);
    expect(section10Match).not.toBeNull();
    const selectBody = section10Match![1];

    const requiredColumns = [
      'verdict',
      'verdict_description',
      'pgcrypto_status',
      'base_schema_status',
      'session_token_status',
      'session_token_hash_status',
      'index_status',
      'trigger_status',
      'hash_anomaly_status',
      'blocking_reasons',
    ];

    for (const col of requiredColumns) {
      const aliasRegex = new RegExp(`AS\\s+${col}\\b`, 'i');
      expect(selectBody).toMatch(aliasRegex);
    }
  });

  it('verifies the DO block populates session parameters via set_config for all 10 verdict fields', () => {
    const requiredConfigKeys = [
      'quizvibe.preflight_verdict',
      'quizvibe.preflight_verdict_description',
      'quizvibe.preflight_pgcrypto_status',
      'quizvibe.preflight_base_schema_status',
      'quizvibe.preflight_session_token_status',
      'quizvibe.preflight_session_token_hash_status',
      'quizvibe.preflight_index_status',
      'quizvibe.preflight_trigger_status',
      'quizvibe.preflight_hash_anomaly_status',
      'quizvibe.preflight_blocking_reasons',
    ];

    for (const key of requiredConfigKeys) {
      // Must be set in the DO block
      expect(sqlContent).toContain(`set_config('${key}'`);
      // Must be retrieved in the final SELECT via current_setting
      expect(sqlContent).toContain(`current_setting('${key}'`);
    }
  });

  it('verifies that the final SELECT is the terminal statement of the diagnostic script', () => {
    // Strip trailing whitespace and comments
    const strippedEnd = sqlContent
      .trim()
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    expect(strippedEnd.endsWith(';')).toBe(true);
    expect(strippedEnd).toMatch(/AS\s+blocking_reasons;\s*$/i);
  });

  it('preserves strict four-state classification and fail-closed evaluation in the PL/pgSQL block', () => {
    // STATE A sets v_verdict := 'STATE A' and blocking_reasons := 'NONE...'
    expect(sqlContent).toContain("v_verdict := 'STATE A'");
    expect(sqlContent).toContain("v_blocking_reasons := 'NONE: Schema is clean and ready for Migration 000004.'");

    // STATE A4 sets v_verdict := 'STATE A4' and blocking_reasons := 'NONE...'
    expect(sqlContent).toContain("v_verdict := 'STATE A4'");
    expect(sqlContent).toContain("v_blocking_reasons := 'NONE: Phase 4 is fully applied and verified; schema is ready for Migration 000005.'");

    // STATE B sets v_verdict := 'STATE B' and blocking_reasons := 'NONE...'
    expect(sqlContent).toContain("v_verdict := 'STATE B'");
    expect(sqlContent).toContain("v_blocking_reasons := 'NONE: Migration already fully applied in Expand compatibility mode.'");

    // ELSE branch sets v_verdict := 'STATE C' and collects blocking_reasons
    expect(sqlContent).toContain("v_verdict := 'STATE C'");
    expect(sqlContent).toContain("v_verdict_description := 'STATE C: INCONSISTENT OR PARTIALLY APPLIED STATE. STOP!");
  });

  it('verifies that STATE A4 condition strictly validates Phase 4 artifacts and absence of Phase 5 artifacts', () => {
    const stateA4Match = sqlContent.match(/-- Strict STATE A4[\s\S]*?IF([\s\S]*?)THEN\s*v_is_state_a4 := TRUE;/);
    expect(stateA4Match).not.toBeNull();
    const stateA4Conditions = stateA4Match![1];

    expect(stateA4Conditions).toContain('v_missing_table_count = 0');
    expect(stateA4Conditions).toContain('v_missing_base_col_count = 0');
    expect(stateA4Conditions).toContain('v_phase4_col_count = 3');
    expect(stateA4Conditions).toContain('v_token_con_exists AND v_token_con_validated');
    expect(stateA4Conditions).toContain('v_token_idx_exists AND v_token_idx_valid AND v_token_idx_ready');
    expect(stateA4Conditions).toContain('v_campaign_status_idx_exists AND v_campaign_status_idx_valid AND v_campaign_status_idx_ready');
    expect(stateA4Conditions).toContain('NOT v_has_hash_col');
    expect(stateA4Conditions).toContain('NOT v_hash_con_exists');
    expect(stateA4Conditions).toContain('NOT v_hash_idx_exists');
    expect(stateA4Conditions).toContain('NOT v_trigger_exists');
    expect(stateA4Conditions).toContain('NOT v_func_exists');
    expect(stateA4Conditions).toContain("v_voucher_code_nullable = 'NO'");
    expect(stateA4Conditions).toContain('v_phase4_defs_correct');
  });

  it('verifies that Section 3 checks exact Phase 4 column definitions and contracts', () => {
    // 3a: session_token
    expect(sqlContent).toContain("column_name = 'session_token'");
    expect(sqlContent).toContain("lower(data_type) = 'text'");
    expect(sqlContent).toContain("is_nullable = 'YES'");
    expect(sqlContent).toContain('column_default IS NULL');

    // 3b: current_question_index
    expect(sqlContent).toContain("column_name = 'current_question_index'");
    expect(sqlContent).toContain("(lower(data_type) = 'smallint' OR lower(udt_name) = 'int2')");
    expect(sqlContent).toContain("is_nullable = 'NO'");
    expect(sqlContent).toContain("column_default ~ '^\\s*0(\\s*::\\s*(smallint|int2|integer))?\\s*$'");

    // 3c: current_question_started_at
    expect(sqlContent).toContain("column_name = 'current_question_started_at'");
    expect(sqlContent).toContain("(lower(data_type) = 'timestamp with time zone' OR lower(udt_name) = 'timestamptz')");
    expect(sqlContent).toContain("column_default ~* '^\\s*(now\\(\\)|CURRENT_TIMESTAMP|pg_catalog\\.now\\(\\))(\\s*::\\s*(timestamp with time zone|timestamptz))?\\s*$'");

    // Aggregated boolean
    expect(sqlContent).toContain('v_phase4_defs_correct := (v_phase4_col_count = 3)');
    expect(sqlContent).toContain('AND v_phase4_session_token_def_correct');
    expect(sqlContent).toContain('AND v_phase4_question_index_def_correct');
    expect(sqlContent).toContain('AND v_phase4_started_at_def_correct');
  });

  it('verifies that both STATE A4 and STATE B conditions enforce v_phase4_defs_correct', () => {
    const stateA4Match = sqlContent.match(/-- Strict STATE A4[\s\S]*?IF([\s\S]*?)THEN\s*v_is_state_a4 := TRUE;/);
    expect(stateA4Match).not.toBeNull();
    expect(stateA4Match![1]).toContain('v_phase4_defs_correct');

    const stateBMatch = sqlContent.match(/-- Strict STATE B[\s\S]*?IF([\s\S]*?)THEN\s*v_is_state_b := TRUE;/);
    expect(stateBMatch).not.toBeNull();
    expect(stateBMatch![1]).toContain('v_phase4_defs_correct');
  });

  it('verifies that failure notices are raised in STATE C if Phase 4 column definitions violate contract', () => {
    expect(sqlContent).toContain('IF v_phase4_col_count = 3 AND NOT v_phase4_defs_correct THEN');
    expect(sqlContent).toContain('Column quiz_sessions.session_token definition does not match contract (expected text, nullable YES, no default)');
    expect(sqlContent).toContain('Column quiz_sessions.current_question_index definition does not match contract (expected smallint, nullable NO, default 0)');
    expect(sqlContent).toContain('Column quiz_sessions.current_question_started_at definition does not match contract (expected timestamptz, nullable NO, default now())');
  });

  it('verifies that v_session_token_status in Section 10 includes defs_correct status', () => {
    expect(sqlContent).toContain('phase4_cols=%s/3, defs_correct=%s (token=%s, q_idx=%s, started_at=%s)');
  });

  it('verifies that index predicate checks in Section 8 use strict anchored regexes', () => {
    expect(sqlContent).toContain("SELECT pg_get_expr(i.indpred, i.indrelid) ~* '^\\s*\\(+\\s*session_token\\s+IS\\s+NOT\\s+NULL\\s*\\)+\\s*$'");
    expect(sqlContent).toContain("SELECT pg_get_expr(i.indpred, i.indrelid) ~* '^\\s*\\(+\\s*session_token_hash\\s+IS\\s+NOT\\s+NULL\\s*\\)+\\s*$'");
  });
});

describe('supabase/migrations/20261105000005_player_session_token_hash.sql Static Migration Safety & Integrity', () => {
  const fs = require('fs');
  const path = require('path');
  const migPath = path.resolve(process.cwd(), 'supabase', 'migrations', '20261105000005_player_session_token_hash.sql');
  const migContent = fs.readFileSync(migPath, 'utf8');

  it('guarantees existing mismatched plaintext/hash pairs are reconciled by backfill using schema-qualified digest', () => {
    // Must update when hash is null, empty, or differs from computed digest using dynamic SQL identifier %I.digest
    expect(migContent).toMatch(/UPDATE\s+public\.quiz_sessions\s+SET\s+session_token_hash\s*=\s*encode\(%I\.digest\(session_token,\s*'sha256'\),\s*'hex'\)/i);
    expect(migContent).toContain("session_token_hash <> encode(%I.digest(session_token, 'sha256'), 'hex')");
  });

  it('fails migration transaction if pgcrypto is missing or in an unsupported schema during backfill', () => {
    expect(migContent).toContain("IF v_pgcrypto_schema IS NULL THEN");
    expect(migContent).toContain("RAISE EXCEPTION 'Cannot migrate: pgcrypto extension is not installed; cannot proceed with Migration 000005.'");
    expect(migContent).toContain("IF v_pgcrypto_schema NOT IN ('public', 'extensions') THEN");
    expect(migContent).toContain("RAISE EXCEPTION 'Cannot migrate: pgcrypto is installed in unsupported schema \"%\"");
  });

  it('guarantees strictly zero unqualified digest() calls exist in Migration 000005 outside comments', () => {
    const stripped = migContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Unqualified digest calls would be "digest(" NOT preceded by "%I.", "extensions.", or "public."
    // and not preceded by an identifier char or dot
    const unqualifiedDigestMatches = [...stripped.matchAll(/(?<!(%I|%|extensions|public|\w)\.)\bdigest\s*\(/g)];
    expect(unqualifiedDigestMatches).toHaveLength(0);
  });

  it('verifies trigger function configuration fails closed if pgcrypto schema is unsupported', () => {
    expect(migContent).toContain("ELSIF v_pgcrypto_schema = 'public' THEN");
    expect(migContent).toContain("RAISE EXCEPTION 'Cannot configure trigger: pgcrypto is installed in unsupported schema \"%\"");
  });

  it('preserves legitimate hash-only rows without modification', () => {
    // Strip comments to inspect actual migration backfill statement
    const stripped = migContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const updateMatch = stripped.match(/UPDATE\s+public\.quiz_sessions[\s\S]*?;/i);
    expect(updateMatch).not.toBeNull();
    const updateStmt = updateMatch![0];
    expect(updateStmt).toContain('session_token IS NOT NULL');
    // Does NOT touch or set session_token
    expect(updateStmt).not.toContain('session_token =');
  });

  it('strictly rejects empty or whitespace plaintext session_tokens before migration', () => {
    expect(migContent).toContain('length(trim(session_token)) = 0');
    expect(migContent).toContain("RAISE EXCEPTION 'Cannot migrate: found % row(s) with empty or whitespace session_token");
  });

  it('scopes unique constraint check specifically to public.quiz_sessions and avoids suppression from other relations', () => {
    // Must check pg_constraint joined with pg_class and pg_namespace
    expect(migContent).toContain("n.nspname = 'public'");
    expect(migContent).toContain("t.relname = 'quiz_sessions'");
    expect(migContent).toContain("c.conname = 'quiz_sessions_token_hash_unique'");
  });

  it('raises an explicit exception if an incompatible constraint exists on public.quiz_sessions', () => {
    expect(migContent).toContain("IF v_existing_con.contype <> 'u' OR v_cols <> ARRAY['session_token_hash']::text[] THEN");
    expect(migContent).toContain("RAISE EXCEPTION 'Incompatible constraint quiz_sessions_token_hash_unique already exists on public.quiz_sessions");
  });

  it('guarantees trigger function checks whitespace tokens and uses exact trusted search_path', () => {
    expect(migContent).toContain('SET search_path = public, extensions');
    expect(migContent).toContain('length(trim(NEW.session_token)) = 0');
    expect(migContent).toContain("RAISE EXCEPTION 'session_token cannot be empty or whitespace'");
    expect(migContent).toContain('NEW.session_token_hash <> v_computed_hash');
  });

  it('does NOT drop or remove session_token column (preserves Expand phase compatibility)', () => {
    const stripped = migContent.replace(/--.*$/gm, '');
    expect(stripped).not.toMatch(/ALTER\s+TABLE\s+public\.quiz_sessions\s+DROP\s+COLUMN\s+session_token/i);
  });

  it('scopes index inspection to public.quiz_sessions and raises exception if index belongs to another relation', () => {
    expect(migContent).toContain("IF v_existing_idx.tablename <> 'quiz_sessions' THEN");
    expect(migContent).toContain("RAISE EXCEPTION 'Index idx_quiz_sessions_token_hash already exists on public.% instead of public.quiz_sessions");
  });

  it('raises explicit exception if existing idx_quiz_sessions_token_hash is incompatible or invalid', () => {
    expect(migContent).toContain("IF v_existing_idx.amname <> 'btree'");
    expect(migContent).toContain("OR v_cols <> ARRAY['session_token_hash']::text[]");
    expect(migContent).toContain("OR v_existing_idx.pred_expr !~* '^\\s*\\(+\\s*session_token_hash\\s+IS\\s+NOT\\s+NULL\\s*\\)+\\s*$'");
    expect(migContent).toContain("RAISE EXCEPTION 'Incompatible or invalid index idx_quiz_sessions_token_hash exists on public.quiz_sessions");
  });

  it('creates and immediately verifies catalog state for idx_quiz_sessions_token_hash if absent using strict anchored predicate regex', () => {
    expect(migContent).toContain('CREATE INDEX idx_quiz_sessions_token_hash');
    expect(migContent).toContain("AND pg_get_expr(i.indpred, i.indrelid) ~* '^\\s*\\(+\\s*session_token_hash\\s+IS\\s+NOT\\s+NULL\\s*\\)+\\s*$'");
    expect(migContent).toContain("RAISE EXCEPTION 'Failed to verify index idx_quiz_sessions_token_hash after creation on public.quiz_sessions.'");
  });

  it('explicitly identifies dropping session_token_hash as a potentially destructive operation', () => {
    expect(migContent).toContain('CRITICAL WARNING — POTENTIALLY DESTRUCTIVE OPERATION');
    expect(migContent).toContain('Dropping session_token_hash is NOT fully lossless');
    expect(migContent).toContain('session_token IS NULL AND session_token_hash IS NOT NULL');
  });

  it('mandates a pre-rollback diagnostic query counting hash-only rows and documents triage options', () => {
    expect(migContent).toContain('MANDATORY PRE-ROLLBACK DIAGNOSTIC QUERY');
    expect(migContent).toContain('count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NOT NULL) AS hash_only_sessions');
    expect(migContent).toContain('OPERATIONAL TRIAGE PROTOCOL');
    expect(migContent).toContain('Session Draining: Wait for active hash-only sessions to finish or expire naturally');
    expect(migContent).toContain("UPDATE public.quiz_sessions\n--          SET status = 'expired'\n--          WHERE session_token IS NULL AND session_token_hash IS NOT NULL;");
    expect(migContent).toContain('Stakeholder Approval: An authorized engineering lead must explicitly review');
  });

  it('qualifies digest() call with extensions.digest or public.digest to prevent search_path shadowing', () => {
    expect(migContent).toContain("encode(extensions.digest(NEW.session_token, 'sha256'), 'hex')");
    expect(migContent).toContain("encode(public.digest(NEW.session_token, 'sha256'), 'hex')");
  });
});

describe('supabase/migrations/20261105000006_player_session_token_contract.sql Static Contract Safety & Integrity', () => {
  const fs = require('fs');
  const path = require('path');
  const contractPath = path.resolve(process.cwd(), 'supabase', 'migrations', '20261105000006_player_session_token_contract.sql');
  const contractContent = fs.readFileSync(contractPath, 'utf8');

  it('guarantees pgcrypto schema detection and dynamic schema qualification in Check 2c', () => {
    expect(contractContent).toContain('SELECT n.nspname INTO v_pgcrypto_schema');
    expect(contractContent).toContain("IF v_pgcrypto_schema NOT IN ('public', 'extensions') THEN");
    expect(contractContent).toContain("session_token_hash <> encode(%I.digest(session_token, 'sha256'), 'hex')");
  });

  it('guarantees strictly zero unqualified digest() calls exist in Migration 000006 outside comments', () => {
    const stripped = contractContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    const unqualifiedDigestMatches = [...stripped.matchAll(/(?<!(%I|%|extensions|public|\w)\.)\bdigest\s*\(/g)];
    expect(unqualifiedDigestMatches).toHaveLength(0);
  });

  it('enforces complete hash coverage across all rows regardless of status before dropping session_token', () => {
    expect(contractContent).toContain('WHERE session_token_hash IS NULL OR length(trim(session_token_hash)) = 0;');
    expect(contractContent).toContain("RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) with NULL, empty, or whitespace session_token_hash.");
  });

  it('strictly rejects corrupt empty or whitespace plaintext tokens and duplicate hashes', () => {
    expect(contractContent).toContain('WHERE session_token IS NOT NULL AND length(trim(session_token)) = 0;');
    expect(contractContent).toContain('GROUP BY session_token_hash');
    expect(contractContent).toContain('HAVING count(*) > 1');
  });

  it('enforces SHA-256 hash format integrity gate (Check 2e) across all rows using canonical lowercase hex regex', () => {
    expect(contractContent).toContain("WHERE session_token_hash !~ '^[0-9a-f]{64}$';");
    expect(contractContent).toContain("RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) with malformed session_token_hash.");
    expect(contractContent).toContain('v_malformed_hash_count');
  });

  it('verifies unique constraint quiz_sessions_token_hash_unique on public.quiz_sessions', () => {
    expect(contractContent).toContain("c.conname = 'quiz_sessions_token_hash_unique'");
    expect(contractContent).toContain("v_existing_con.contype <> 'u'");
    expect(contractContent).toContain('NOT v_existing_con.convalidated');
    expect(contractContent).toContain("v_cols <> ARRAY['session_token_hash']::text[]");
  });

  it('verifies partial B-tree index idx_quiz_sessions_token_hash with strict anchored predicate regex', () => {
    expect(contractContent).toContain("ic.relname = 'idx_quiz_sessions_token_hash'");
    expect(contractContent).toContain("v_existing_idx.amname <> 'btree'");
    expect(contractContent).toContain('NOT v_existing_idx.indisvalid');
    expect(contractContent).toContain('NOT v_existing_idx.indisready');
    expect(contractContent).toContain('v_existing_idx.indisunique');
    expect(contractContent).toContain("v_cols <> ARRAY['session_token_hash']::text[]");
    expect(contractContent).toContain("v_existing_idx.pred_expr !~* '^\\s*\\(+\\s*session_token_hash\\s+IS\\s+NOT\\s+NULL\\s*\\)+\\s*$'");
  });

  it('verifies trigger and trigger function preconditions before dropping them', () => {
    expect(contractContent).toContain("tg.tgname = 'trg_sync_quiz_sessions_token_hash'");
    expect(contractContent).toContain("v_existing_tg.tgenabled NOT IN ('O', 'A')");
    expect(contractContent).toContain("v_existing_tg.fn_schema <> 'public'");
    expect(contractContent).toContain("v_existing_tg.proname <> 'sync_quiz_sessions_token_hash'");
    expect(contractContent).toContain('v_existing_tg.tgtype <> 23');
    expect(contractContent).toContain('NOT v_existing_fn.prosecdef');
    expect(contractContent).toContain("cfg ~* '^search_path\\s*=\\s*public\\s*,\\s*extensions$'");
  });

  it('documents irreversible one-way transition and rollback risks in header', () => {
    expect(contractContent).toContain('CRITICAL DATA-INTEGRITY & ROLLBACK WARNING');
    expect(contractContent).toContain('Dropping session_token is an IRREVERSIBLE, ONE-WAY cryptographic transition');
    expect(contractContent).toContain('Original plaintext session tokens CANNOT be reconstructed');
  });

  it('enforces Phase 5.3.3 operational status, 4 dimensions, conservative stop condition, and post-DDL gate', () => {
    // Audit status
    expect(contractContent).toContain('STATUS: DRAFT / PENDING OPERATIONAL DRAINING GATE VERIFICATION.');
    expect(contractContent).toContain('DO NOT MARK APPROVED OR PRODUCTION-READY UNTIL ALL FOUR INDEPENDENT GATES ARE SATISFIED.');

    // 4 dimensions documented
    expect(contractContent).toContain('FOUR INDEPENDENT OPERATIONAL DIMENSIONS (DO NOT CONFUSE OR SUBSTITUTE):');
    expect(contractContent).toContain('1. Hash Completeness:');
    expect(contractContent).toContain('2. Plaintext-Write Draining:');
    expect(contractContent).toContain('3. Vercel Deployment Routing:');
    expect(contractContent).toContain('4. Expiration of In-Flight Requests & Old Serverless Instances:');

    // Conservative stop condition
    expect(contractContent).toContain('CONSERVATIVE STOP CONDITION:');
    expect(contractContent).toContain('If any write with session_token IS NOT NULL is observed, or Vercel routing telemetry shows any');
    expect(contractContent).toContain('Keep the database in STATE B (Expand Mode)');

    // Correct RAISE exception without %I in format string
    expect(contractContent).toContain("session_token_hash does not match %.digest(session_token, ''sha256'')");

    // Post-DDL verification block with explicit pg_class tc join and alias declaration
    expect(contractContent).toContain('6. Post-DDL Invariant Verification (Pre-Commit Fail-Closed Gate)');
    expect(contractContent).toContain("RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: session_token column still exists in public.quiz_sessions.';");
    expect(contractContent).toContain("RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: session_token_hash column is missing from public.quiz_sessions.';");
    expect(contractContent).toContain("RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: quiz_sessions_token_hash_unique constraint is missing or invalid.';");
    expect(contractContent).toContain('JOIN pg_class tc ON i.indrelid = tc.oid');
    expect(contractContent).toContain("tc.relname = 'quiz_sessions'");
    expect(contractContent).toContain("RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: idx_quiz_sessions_token_hash index is missing or invalid.';");
    expect(contractContent).toContain("RAISE NOTICE 'MIGRATION 000006 SUCCESS: session_token dropped; hash column, index, and constraint verified.';");
  });

  it('verifies that supabase/README.md documents the 4 dimensions, application write paths, conservative stop condition, and telemetry limitations', () => {
    const readmePath = path.resolve(process.cwd(), 'supabase', 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    expect(readmeContent).toContain('### 7.1 The Four Independent Operational Dimensions');
    expect(readmeContent).toContain('Hash Completeness');
    expect(readmeContent).toContain('Plaintext-Write Draining');
    expect(readmeContent).toContain('Vercel Deployment Routing');
    expect(readmeContent).toContain('Expiration of In-Flight Requests & Old Serverless Instances');

    expect(readmeContent).toContain('### 7.2 Operational Evidence vs. Absolute Proof in Serverless Container Lifecycles');
    expect(readmeContent).toContain('### 7.3 Application Write Paths & Critical Telemetry Limitations');
    expect(readmeContent).toContain('api/lib/quiz/quizService.ts');
    expect(readmeContent).toContain('api/lib/db/repository.ts');
    expect(readmeContent).toContain('`public.quiz_sessions` does NOT possess an `updated_at` column');
    expect(readmeContent).toContain('It is NOT equivalent to an `updated_at` column and does NOT constitute comprehensive write telemetry');

    expect(readmeContent).toContain('### 7.4 Conservative Stop Condition & Abort Protocol');
    expect(readmeContent).toContain('SELECT count(*) AS legacy_lifecycle_events_last_10m');
    expect(readmeContent).toContain('missing_hashes = 0');
    expect(readmeContent).toContain('malformed_hashes = 0');
    expect(readmeContent).toContain('corrupt_empty_tokens = 0');
  });
});
