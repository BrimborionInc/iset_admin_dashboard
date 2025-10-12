output "guardduty_detector_id" {
  description = "GuardDuty detector ID."
  value       = aws_guardduty_detector.this.id
}

output "securityhub_account_id" {
  description = "Security Hub account ID (same as AWS account)."
  value       = aws_securityhub_account.this.id
}

output "access_analyzer_name" {
  description = "Access Analyzer name."
  value       = aws_accessanalyzer_analyzer.this.analyzer_name
}

output "tags" {
  description = "Tags applied within the security module."
  value       = local.component_tags
}
