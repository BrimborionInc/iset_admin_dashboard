/**
 * Secrets Manager placeholder for the admin OPENROUTER_API_KEY in test.
 * The secret value is set out-of-band (console/CLI) to avoid storing it in Terraform state.
 */
resource "aws_secretsmanager_secret" "openrouter_api_key" {
  name                    = "${var.name_prefix}-openrouter-api-key"
  description             = "OPENROUTER_API_KEY for ${var.name_prefix} admin AI integration (value set outside Terraform)."
  kms_key_id              = module.kms.keys.general.key_arn
  recovery_window_in_days = 7

  tags = merge(local.tags, {
    Purpose = "ai-api-key"
  })

  lifecycle {
    prevent_destroy = true
  }
}
