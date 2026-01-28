output "bootstrap" {
  value = module.bootstrap
}

output "networking" {
  value = module.networking
}

output "kms" {
  value = module.kms
}

output "logging" {
  value = module.logging
}

output "artifacts" {
  value = module.artifacts
}

output "security" {
  value = module.security
}

output "acm" {
  value = module.acm
}

output "data" {
  value = module.data
}

output "identity" {
  value = module.identity
}

output "compute" {
  value = module.compute
}

output "openrouter_api_key_secret_arn" {
  description = "Secrets Manager ARN for the admin OPENROUTER_API_KEY (test). Value set outside Terraform to keep state clean."
  value       = aws_secretsmanager_secret.openrouter_api_key.arn
}

# Note: modules currently expose maps/objects. Adjust once module interfaces solidify.
