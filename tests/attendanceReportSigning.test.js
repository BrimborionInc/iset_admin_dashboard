const {
  ATTENDANCE_REPORT_KEYS: KEYS,
  applyAttendanceReportInitialValues,
  buildAttendanceReportInitialValues,
  validateAttendanceReportPayload,
} = require('../../shared/attendanceReport');

describe('monthly attendance report signing', () => {
  test('prefers the selected intervention and falls back to assessment details', () => {
    expect(buildAttendanceReportInitialValues({
      applicantName: '  Jane Participant ',
      intervention: {
        metadata_json: JSON.stringify({
          institution: 'Selected College',
          programName: 'Selected Program',
        }),
      },
      assessment: { institution: 'Assessment College', program_name: 'Assessment Program' },
    })).toEqual({
      [KEYS.clientName]: 'Jane Participant',
      [KEYS.institution]: 'Selected College',
      [KEYS.programName]: 'Selected Program',
    });
  });

  test('stores editable initial values in the signing schema', () => {
    const schema = applyAttendanceReportInitialValues(
      { steps: [{ stepId: 'details' }], meta: { workflowId: 54 } },
      { [KEYS.clientName]: 'Jane Participant' }
    );
    expect(schema.initialValues[KEYS.clientName]).toBe('Jane Participant');
    expect(schema.meta.initialValues[KEYS.clientName]).toBe('Jane Participant');
    expect(schema.meta.attendanceReport).toBe(true);
  });

  test('accepts a complete full-attendance declaration without absence evidence', () => {
    const result = validateAttendanceReportPayload({
      [KEYS.clientName]: 'Jane Participant',
      [KEYS.reportingMonth]: '2026-07',
      [KEYS.institution]: 'Example College',
      [KEYS.programName]: 'Example Program',
      [KEYS.attendanceStatus]: 'full_attendance',
      [KEYS.signature]: { signed: true, name: 'Jane Participant' },
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires absence details and an uploaded supporting document', () => {
    const base = {
      [KEYS.clientName]: 'Jane Participant',
      [KEYS.reportingMonth]: '2026-07',
      [KEYS.institution]: 'Example College',
      [KEYS.programName]: 'Example Program',
      [KEYS.attendanceStatus]: 'absences',
      [KEYS.signature]: { signed: true, name: 'Jane Participant' },
    };
    expect(validateAttendanceReportPayload(base).errors).toEqual([
      'absence_date_required',
      'absence_reason_required',
      'supporting_document_required',
    ]);
    expect(validateAttendanceReportPayload({
      ...base,
      [KEYS.absenceDate1]: '2026-07-08',
      [KEYS.absenceReason1]: 'Medical appointment',
      [KEYS.supportingDocuments]: [{ filePath: 'uploads/note.pdf', name: 'note.pdf' }],
    })).toEqual({ valid: true, errors: [] });
  });

  test('requires each optional absence row to be complete and within the reporting month', () => {
    const result = validateAttendanceReportPayload({
      [KEYS.clientName]: 'Jane Participant',
      [KEYS.reportingMonth]: '2026-07',
      [KEYS.institution]: 'Example College',
      [KEYS.programName]: 'Example Program',
      [KEYS.attendanceStatus]: 'absences',
      [KEYS.absenceDate1]: '2026-06-30',
      [KEYS.absenceReason1]: 'Medical appointment',
      'attendance-absence-reason-2': 'Family emergency',
      [KEYS.supportingDocuments]: [{ filePath: 'uploads/note.pdf', name: 'note.pdf' }],
      [KEYS.signature]: { signed: true, name: 'Jane Participant' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'absence_date_1_outside_reporting_month',
      'absence_date_2_required',
    ]));
  });

  test('does not accept a display name without an uploaded-object path as evidence', () => {
    const result = validateAttendanceReportPayload({
      [KEYS.clientName]: 'Jane Participant',
      [KEYS.reportingMonth]: '2026-07',
      [KEYS.institution]: 'Example College',
      [KEYS.programName]: 'Example Program',
      [KEYS.attendanceStatus]: 'absences',
      [KEYS.absenceDate1]: '2026-07-08',
      [KEYS.absenceReason1]: 'Medical appointment',
      [KEYS.supportingDocuments]: [{ name: 'not-an-upload.pdf' }],
      [KEYS.signature]: { signed: true, name: 'Jane Participant' },
    });
    expect(result.errors).toContain('supporting_document_required');
  });
});
