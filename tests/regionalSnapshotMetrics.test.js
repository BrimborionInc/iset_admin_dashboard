const {
  buildRegionalSnapshotIssueExplanation,
  calculateRegionalSnapshotMetrics,
  classifyApplicationOutcome,
  isExplicitManualReportingRecord,
  isRegionalSnapshotFundingEligible,
  resolveReportingApplicationLineage,
} = require('../src/server/regionalSnapshotMetrics');

const application = (overrides = {}) => ({
  id: 1,
  submissionId: 101,
  submittedAt: '2026-03-10',
  status: 'approved',
  decisionOutcome: 'approved',
  ...overrides,
});

const intervention = (overrides = {}) => ({
  id: 11,
  applicationId: 1,
  clientId: 201,
  startDate: '2026-05-01',
  activityDates: ['2026-05-01'],
  fundingOccurrences: [],
  ...overrides,
});

describe('regionalSnapshotMetrics', () => {
  it('explains application-link issues in plain English', () => {
    expect(
      buildRegionalSnapshotIssueExplanation({
        issueType: 'indirect_application_lineage',
        applicationReference: 'APP-123',
      })
    ).toBe(
      'The action plan is not directly linked to an application, although related PATH records ' +
      'agree that it belongs to APP-123. The report used that verified connection; add the missing ' +
      'direct link to clean up the record.'
    );
    expect(
      buildRegionalSnapshotIssueExplanation({
        issueType: 'missing_application_lineage',
      })
    ).toContain('valid approved funding remains included in Section C');
  });

  it('combines funding issue effects and corrective action into readable text', () => {
    expect(
      buildRegionalSnapshotIssueExplanation({
        issueType: 'unknown_funding_source',
        reportingEffect: 'Included the approved amount in CRF by default.',
        remediation: 'Assign the approved line to CRF or EI.',
      })
    ).toBe(
      'PATH does not identify whether this funding belongs to CRF or EI. ' +
      'The report included the approved amount in CRF by default; to correct this, assign the approved line to CRF or EI.'
    );
  });

  it('uses intervention reporting dates instead of the application submission date', () => {
    const march = calculateRegionalSnapshotMetrics({
      applications: [application()],
      interventions: [intervention()],
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    });
    const may = calculateRegionalSnapshotMetrics({
      applications: [application()],
      interventions: [intervention()],
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    });

    expect(march.liveMetrics.applicationsReceived).toBe(0);
    expect(may.liveMetrics).toEqual({
      applicationsReceived: 1,
      funded: 1,
      fundedApplications: 1,
      deniedIneligibleWithdrawn: 0,
      pendingDecision: 0,
    });
  });

  it('falls back to received date when an application has no dated interventions', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [application({ submittedAt: '2026-04-15' })],
      interventions: [],
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    });

    expect(result.liveMetrics.applicationsReceived).toBe(1);
  });

  it('deduplicates an application and client while summing every occurrence in the period', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [
        application(),
        application({ id: 2, submissionId: 102 }),
      ],
      interventions: [
        intervention({
          activityDates: ['2026-04-30', '2026-05-31'],
          fundingOccurrences: [
            { date: '2026-04-30', amount: 500, fundingSource: 'CRF' },
            { date: '2026-05-31', amount: 500, fundingSource: 'CRF' },
          ],
        }),
        intervention({
          id: 12,
          applicationId: 1,
          activityDates: ['2026-05-15'],
          fundingOccurrences: [
            { date: '2026-05-15', amount: 250, fundingSource: 'EI' },
          ],
        }),
        intervention({
          id: 13,
          applicationId: 2,
          clientId: 201,
          activityDates: ['2026-05-20'],
          fundingOccurrences: [
            { date: '2026-05-20', amount: 100, fundingSource: 'CRF' },
          ],
        }),
      ],
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    });

    expect(result.liveMetrics.applicationsReceived).toBe(2);
    expect(result.fundingMetrics).toEqual({
      crfFundingAmount: 600,
      eiFundingAmount: 250,
      fundedClientCount: 1,
      fundedInterventionCount: 3,
    });
  });

  it('partitions current outcomes and treats withdrawal as denied', () => {
    const applications = [
      application({ id: 1, status: 'approved' }),
      application({ id: 2, status: 'withdrawn', decisionOutcome: 'approved' }),
      application({ id: 3, status: 'submitted', decisionOutcome: null }),
    ];
    const interventions = applications.map((item, index) =>
      intervention({
        id: 20 + index,
        applicationId: item.id,
        activityDates: ['2026-06-01'],
      })
    );
    const result = calculateRegionalSnapshotMetrics({
      applications,
      interventions,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    });

    expect(result.liveMetrics).toMatchObject({
      applicationsReceived: 3,
      fundedApplications: 1,
      deniedIneligibleWithdrawn: 1,
      pendingDecision: 1,
    });
    expect(
      result.liveMetrics.fundedApplications +
        result.liveMetrics.deniedIneligibleWithdrawn +
        result.liveMetrics.pendingDecision
    ).toBe(result.liveMetrics.applicationsReceived);
  });

  it('classifies a linked application as approved from an approved new-intervention proposal', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [
        application({
          status: 'docs_requested',
          decisionOutcome: null,
        }),
      ],
      interventions: [
        intervention({
          activityDates: ['2026-06-01'],
          approvedNewInterventionProposal: true,
        }),
      ],
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    });

    expect(result.liveMetrics).toMatchObject({
      applicationsReceived: 1,
      fundedApplications: 1,
      deniedIneligibleWithdrawn: 0,
      pendingDecision: 0,
    });
  });

  it('keeps withdrawal ahead of approved new-intervention proposal inference', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [
        application({
          status: 'withdrawn',
          decisionOutcome: null,
        }),
      ],
      interventions: [
        intervention({
          activityDates: ['2026-06-01'],
          approvedNewInterventionProposal: true,
        }),
      ],
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    });

    expect(result.liveMetrics).toMatchObject({
      applicationsReceived: 1,
      fundedApplications: 0,
      deniedIneligibleWithdrawn: 1,
      pendingDecision: 0,
    });
  });

  it('keeps application-less interventions out of application activity but includes valid funding', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [],
      interventions: [
        intervention({
          applicationId: null,
          clientName: 'Sarah Froese',
          fundingOccurrences: [
            { date: '2026-07-13', amount: 5316.4, fundingSource: 'CRF' },
            { date: '2026-07-13', amount: 1400, fundingSource: 'CRF' },
            { date: '2026-08-13', amount: 1400, fundingSource: 'CRF' },
          ],
        }),
      ],
      periodStart: '2026-04-01',
      periodEnd: '2027-03-31',
      includeAuditDetails: true,
    });

    expect(result.liveMetrics.applicationsReceived).toBe(0);
    expect(result.fundingMetrics).toEqual({
      crfFundingAmount: 8116.4,
      eiFundingAmount: 0,
      fundedClientCount: 1,
      fundedInterventionCount: 1,
    });
    expect(result.auditDetails.approvedApplications).toEqual([]);
    expect(result.auditDetails.fundedClients).toEqual([
      expect.objectContaining({
        clientName: 'Sarah Froese',
        applicationReferences: [],
        crfFundingAmount: 8116.4,
      }),
    ]);
  });

  it('filters dated data-quality issues to the selected period', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [],
      interventions: [],
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      dataQualityIssues: [
        { id: 'april', reportingDate: '2026-04-15' },
        { id: 'may', reportingDate: '2026-05-15' },
        { id: 'unresolved', includeInEveryPeriod: true },
      ],
    });

    expect(result.dataQualityIssues.map(issue => issue.id)).toEqual(['april', 'unresolved']);
  });

  it('gives denied and withdrawn outcomes priority over stale approved decisions', () => {
    expect(classifyApplicationOutcome({ status: 'withdrawn', decisionOutcome: 'approved' })).toBe('denied');
    expect(classifyApplicationOutcome({ status: 'completed', decisionOutcome: 'approved' })).toBe('approved');
    expect(classifyApplicationOutcome({ status: 'in_review' })).toBe('pending');
  });

  it('distinguishes explicit manual backloads from unresolved application lineage', () => {
    expect(
      isExplicitManualReportingRecord({
        metadata: { source: 'manual_backload' },
      })
    ).toBe(true);
    expect(
      isExplicitManualReportingRecord({
        metadata: { entryMode: 'existing' },
      })
    ).toBe(true);
    expect(
      isExplicitManualReportingRecord({
        actionPlanMetadata: { source: 'manual_backload' },
      })
    ).toBe(true);
    expect(
      isExplicitManualReportingRecord({
        metadata: { source: 'auto_assessment' },
      })
    ).toBe(false);
    expect(isExplicitManualReportingRecord()).toBe(false);
  });

  it('resolves application lineage only when every authoritative source agrees', () => {
    expect(
      resolveReportingApplicationLineage({
        actionPlanApplicationId: null,
        proposalApplicationId: 52,
        esdcApplicationId: 52,
        uniquePlanProposalApplicationId: 52,
        planProposalApplicationCount: 1,
      })
    ).toMatchObject({
      applicationId: 52,
      conflict: false,
    });
    expect(
      resolveReportingApplicationLineage({
        actionPlanApplicationId: 48,
        proposalApplicationId: 49,
      })
    ).toEqual({
      applicationId: null,
      sources: ['action_plan', 'intervention_proposal'],
      candidateApplicationIds: [48, 49],
      conflict: true,
    });
  });

  it('does not infer lineage from a non-unique action-plan proposal set', () => {
    expect(
      resolveReportingApplicationLineage({
        uniquePlanProposalApplicationId: 52,
        planProposalApplicationCount: 2,
      })
    ).toEqual({
      applicationId: null,
      sources: [],
      candidateApplicationIds: [],
      conflict: false,
    });
  });

  it('does not count archived intervention funding even when an older proposal is approved', () => {
    expect(
      isRegionalSnapshotFundingEligible({
        effectiveStatus: 'approved',
        storedInterventionStatus: 'archived',
      })
    ).toBe(false);
    expect(
      isRegionalSnapshotFundingEligible({
        effectiveStatus: 'approved',
        storedInterventionStatus: 'approved',
        actionPlanArchivedAt: '2026-07-01 10:00:00',
      })
    ).toBe(false);
    expect(
      isRegionalSnapshotFundingEligible({
        effectiveStatus: 'approved',
        storedInterventionStatus: 'approved',
      })
    ).toBe(true);
  });

  it('counts original drafts but not pending draft revisions', () => {
    expect(
      isRegionalSnapshotFundingEligible({
        effectiveStatus: 'draft',
        storedInterventionStatus: 'draft',
        sourceInterventionId: null,
      })
    ).toBe(true);
    expect(
      isRegionalSnapshotFundingEligible({
        effectiveStatus: 'draft',
        storedInterventionStatus: 'draft',
        sourceInterventionId: 219,
      })
    ).toBe(false);
  });

  it('produces opt-in audit rows that reconcile approved applications and funded clients', () => {
    const result = calculateRegionalSnapshotMetrics({
      applications: [
        application({
          reference: 'APP-1',
          caseReference: 'CASE-1',
          clientId: 201,
          clientName: 'Test Client',
        }),
      ],
      interventions: [
        intervention({
          activityDates: ['2026-05-31'],
          fundingOccurrences: [
            { date: '2026-05-31', amount: 400, fundingSource: 'CRF' },
            { date: '2026-05-31', amount: 100, fundingSource: 'EI' },
          ],
        }),
      ],
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      includeAuditDetails: true,
    });

    expect(result.auditDetails.approvedApplications).toEqual([
      expect.objectContaining({
        applicationReference: 'APP-1',
        clientName: 'Test Client',
        fundedClient: true,
        crfFundingAmount: 400,
        eiFundingAmount: 100,
        totalFundingAmount: 500,
      }),
    ]);
    expect(result.auditDetails.fundedClients).toEqual([
      expect.objectContaining({
        clientName: 'Test Client',
        applicationReferences: ['APP-1'],
        fundingOccurrenceCount: 2,
        totalFundingAmount: 500,
      }),
    ]);
  });
});
