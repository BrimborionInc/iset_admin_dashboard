const {
  createSubmissionPayloadFilePathSet,
  isSubmissionPayloadDocumentMatch,
} = require('../src/lib/applicationSubmissionDocumentScope');

describe('applicationSubmissionDocumentScope', () => {
  test('collects nested submission file paths once', () => {
    const paths = createSubmissionPayloadFilePathSet({
      answers: {
        govtId: { filePath: ' uploads/a.pdf ' },
        uploads: [
          { file_path: 'uploads/b.pdf' },
          { nested: { filePath: 'uploads/a.pdf' } },
        ],
      },
    });

    expect(Array.from(paths).sort()).toEqual(['uploads/a.pdf', 'uploads/b.pdf']);
  });

  test('matches only unscoped application-submission documents proven by payload file path', () => {
    const paths = createSubmissionPayloadFilePathSet({
      answers: {
        acceptanceLetter: { filePath: 'uploads/acceptance.pdf' },
      },
    });

    expect(
      isSubmissionPayloadDocumentMatch(
        {
          source: 'application_submission',
          file_path: 'uploads/acceptance.pdf',
          application_id: null,
          case_id: null,
          action_plan_id: null,
        },
        paths
      )
    ).toBe(true);
  });

  test('rejects docs that are already scoped or come from another source', () => {
    const paths = createSubmissionPayloadFilePathSet({
      answers: {
        statusCard: { filePath: 'uploads/status-card.pdf' },
      },
    });

    expect(
      isSubmissionPayloadDocumentMatch(
        {
          source: 'manual_upload',
          file_path: 'uploads/status-card.pdf',
          application_id: null,
          case_id: null,
          action_plan_id: null,
        },
        paths
      )
    ).toBe(false);

    expect(
      isSubmissionPayloadDocumentMatch(
        {
          source: 'application_submission',
          file_path: 'uploads/status-card.pdf',
          application_id: 4,
          case_id: null,
          action_plan_id: null,
        },
        paths
      )
    ).toBe(false);

    expect(
      isSubmissionPayloadDocumentMatch(
        {
          source: 'application_submission',
          file_path: 'uploads/status-card.pdf',
          application_id: null,
          case_id: 86,
          action_plan_id: null,
        },
        paths
      )
    ).toBe(false);
  });
});
