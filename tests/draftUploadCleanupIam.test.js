const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('portal draft-upload cleanup IAM', () => {
  const computePolicy = read('infra/terraform/modules/compute/main.tf');
  const computeVariables = read('infra/terraform/modules/compute/variables.tf');
  const prodEnvironment = read('infra/terraform/environments/prod/main.tf');
  const testEnvironment = read('infra/terraform/environments/test/main.tf');
  const cleanupPolicyStart = computePolicy.indexOf('resource "aws_iam_role_policy" "app_draft_upload_cleanup"');
  const cleanupPolicyEnd = computePolicy.indexOf('resource "aws_iam_role_policy"', cleanupPolicyStart + 1);
  const cleanupPolicy = computePolicy.slice(cleanupPolicyStart, cleanupPolicyEnd);

  test('is opt-in and accepts only an exact S3 bucket ARN', () => {
    expect(computeVariables).toMatch(/variable "draft_upload_cleanup_bucket_arn"/u);
    expect(computeVariables).toMatch(/default\s+= ""/u);
    expect(computeVariables).toMatch(/exact S3 bucket ARN without an object path/u);
    expect(cleanupPolicyStart).toBeGreaterThan(-1);
    expect(cleanupPolicy).toMatch(/count = var\.draft_upload_cleanup_bucket_arn == "" \? 0 : 1/u);
  });

  test('limits object-history listing and deletion to the portal upload prefix', () => {
    expect(cleanupPolicy).toMatch(/"s3:ListBucketVersions"/u);
    expect(cleanupPolicy).toMatch(/"s3:prefix" = "uploads\/\*"/u);
    expect(cleanupPolicy).toMatch(/"s3:DeleteObject"/u);
    expect(cleanupPolicy).toMatch(/"s3:DeleteObjectVersion"/u);
    expect(cleanupPolicy).toMatch(/\$\{var\.draft_upload_cleanup_bucket_arn\}\/uploads\/\*/u);
    expect(cleanupPolicy).not.toMatch(/previews\/word/u);
    expect(cleanupPolicy).not.toMatch(/Resource\s+= "\*"/u);
  });

  test('stays default-deny in deployed environments until the shared-prefix risk is accepted', () => {
    expect(prodEnvironment).not.toMatch(/draft_upload_cleanup_bucket_arn/u);
    expect(testEnvironment).not.toMatch(/draft_upload_cleanup_bucket_arn/u);
  });
});
