const { buildDataset } = require('./pathDataSyncCatalog');

function runtimePayload(workflowId, workflowName = 'ISET Intake') {
  return {
    meta: {
      workflowId: String(workflowId),
      generatedAt: '2026-06-16T12:00:00.000Z',
      schemaMeta: {
        workflow: {
          id: workflowId,
          name: workflowName,
          status: 'active',
          type: 'main-intake',
        },
      },
    },
    schema: [],
    version: `2026-06-16T12:00:00.000Z#${workflowId}`,
    publishedAt: '2026-06-16T12:00:00.000Z',
    checksum: 'test-checksum',
  };
}

function makePool(runtime) {
  return {
    query: jest.fn(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('FROM iset_runtime_config')) {
        return [[{
          id: 58,
          scope: 'publish',
          k: 'workflow.schema.intake',
          value_json: JSON.stringify(runtime),
          updated_at: '2026-06-16 08:00:00',
        }]];
      }
      if (normalized.includes('FROM workflow WHERE id = ?')) {
        return [[{
          id: 21,
          name: 'ISET Intake',
          status: 'active',
          workflow_type: 'main-intake',
          document_type: null,
          created_at: '2026-01-01 00:00:00',
          updated_at: '2026-06-16 08:00:00',
        }]];
      }
      if (normalized.includes('FROM workflow_step WHERE workflow_id = ?')) {
        return [[{ workflow_id: 21, step_id: 90, is_start: 1 }]];
      }
      if (normalized.includes('FROM step WHERE id IN (?)')) {
        return [[{
          id: 90,
          name: 'Demographics',
          status: 'active',
          ui_meta_json: '{}',
          created_at: '2026-01-01 00:00:00',
          updated_at: '2026-06-16 08:00:00',
        }]];
      }
      if (normalized.includes('FROM step_component WHERE step_id IN (?)')) {
        return [[]];
      }
      if (normalized.includes('FROM workflow_route WHERE workflow_id = ?')) {
        return [[]];
      }
      if (normalized.includes('FROM workflow_route_option WHERE workflow_id = ?')) {
        return [[]];
      }
      if (normalized.includes('FROM workflow_step ws JOIN step s')) {
        return [[]];
      }
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    }),
  };
}

describe('pathDataSyncCatalog runtime workflow guard', () => {
  test('refuses an intake release when the published runtime row belongs to a different workflow', async () => {
    const pool = makePool(runtimePayload(53, 'Legal Aid Demo'));

    await expect(buildDataset(pool, 'intake-release', {
      sourceEnv: 'dev',
      targetEnv: 'prod',
      workflowId: 21,
    })).rejects.toThrow(
      'Source DEV publish/workflow.schema.intake belongs to workflow 53 (Legal Aid Demo), not requested workflow 21'
    );
  });

  test('builds an intake release when workflow authoring and runtime workflow id match', async () => {
    const pool = makePool(runtimePayload(21));

    const bundle = await buildDataset(pool, 'intake-release', {
      sourceEnv: 'dev',
      targetEnv: 'prod',
      workflowId: 21,
    });

    expect(bundle.summary.workflowAuthoring.workflow.id).toBe(21);
    expect(bundle.summary.runtimePublish.runtime.workflowId).toBe(21);
    expect(bundle.summary.runtimePublish.runtime.workflowName).toBe('ISET Intake');
    expect(bundle.statements.some(statement => String(statement).includes('INSERT INTO iset_runtime_config'))).toBe(true);
  });

  test('requires workflow id for standalone runtime publish promotions', async () => {
    const pool = makePool(runtimePayload(21));

    await expect(buildDataset(pool, 'intake-runtime-publish', {
      sourceEnv: 'dev',
      targetEnv: 'prod',
    })).rejects.toThrow('Dataset intake-runtime-publish requires --workflow-id');
  });
});
