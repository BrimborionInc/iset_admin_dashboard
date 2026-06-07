const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");

const readRepoFile = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("action plan start education requirement", () => {
  test("create action plan route requires education level and province before persistence", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const route = extractBetween(
      serverSource,
      "app.post('/api/cases/:id/action-plans'",
      "app.get('/api/cases/:id/cfa-versions'"
    );

    expect(route).toContain("const educationLevelInput = normaliseActionPlanCode(req.body?.educationLevel");
    expect(route).toContain("error: 'education_level_required'");
    expect(route).toContain("const educationProvinceInput = normaliseActionPlanCode(req.body?.educationProvince");
    expect(route).toContain("error: 'education_province_required'");
    expect(route).toContain("const educationLevel = educationLevelInput;");
    expect(route).toContain("const educationProvince = educationProvinceInput;");
    expect(route).toContain("const socialAssistanceRecipient = requireCode(req.body.socialAssistanceRecipient");
    expect(route).toContain("const eiClaimantCode = requireCode(req.body.eiClaimant");
    expect(route).toContain("const prevEmployment = requireCode(req.body.prevEmployment");
    expect(route).toContain("error: 'barrier_to_employment_required'");
    expect(route).toContain("educationLevel,");
    expect(route).toContain("educationProvince,");
  });

  test("new action plan modal highlights missing start education", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/NewActionPlanModal.jsx");

    expect(modalSource).toContain('errors.educationLevel = "Education level at action plan start is required.";');
    expect(modalSource).toContain('errors.educationProvince = "Education province is required.";');
    expect(modalSource).toContain("errorText={fieldErrors.educationLevel}");
    expect(modalSource).toContain("invalid={Boolean(fieldErrors.educationLevel)}");
  });

  test("existing action plan backload captures and submits start education", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/ExistingActionPlanModal.jsx");

    expect(modalSource).toContain('educationLevel: "",');
    expect(modalSource).toContain('educationProvince: "",');
    expect(modalSource).toContain('socialAssistanceRecipient: "",');
    expect(modalSource).toContain('eiClaimant: "",');
    expect(modalSource).toContain('prevEmployment: "",');
    expect(modalSource).toContain('barriers: [],');
    expect(modalSource).toContain('nextErrors.educationLevel = "Education level at action plan start is required.";');
    expect(modalSource).toContain('nextErrors.educationProvince = "Education province is required.";');
    expect(modalSource).toContain('nextErrors.socialAssistanceRecipient = "Select Yes/No for social assistance.";');
    expect(modalSource).toContain('nextErrors.eiClaimant = "Select EI claimant status.";');
    expect(modalSource).toContain('nextErrors.prevEmployment = "Employment status at plan start is required.";');
    expect(modalSource).toContain('nextErrors.barriers = "Select at least one barrier to employment.";');
    expect(modalSource).toContain("educationLevel: form.educationLevel || null,");
    expect(modalSource).toContain("educationProvince: form.educationProvince || null,");
    expect(modalSource).toContain("socialAssistanceRecipient: form.socialAssistanceRecipient || null,");
    expect(modalSource).toContain("eiClaimant: form.eiClaimant || null,");
    expect(modalSource).toContain("prevEmployment: form.prevEmployment || null,");
    expect(modalSource).toContain("barriers: Array.isArray(form.barriers) ? form.barriers : [],");
    expect(modalSource).toContain('label="Education Level"');
    expect(modalSource).toContain('label="Education Province"');
    expect(modalSource).toContain('label="Social Assistance Recipient"');
    expect(modalSource).toContain('label="EI claimant status"');
    expect(modalSource).toContain('label="Employment status at plan start"');
    expect(modalSource).toContain('label="Barriers to employment"');
  });
});
