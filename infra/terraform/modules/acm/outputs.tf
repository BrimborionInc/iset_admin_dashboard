output "certificate_arn" {
  description = "ARN of the requested ACM certificate"
  value       = aws_acm_certificate.this.arn
}

output "validation_records" {
  description = "DNS validation records to add"
  value       = aws_acm_certificate.this.domain_validation_options
}

