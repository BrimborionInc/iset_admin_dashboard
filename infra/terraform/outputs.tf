output "user_pool_id" {
  value       = aws_cognito_user_pool.admin.id
  description = "Cognito User Pool ID"
}

output "user_pool_arn" {
  value       = aws_cognito_user_pool.admin.arn
  description = "Cognito User Pool ARN"
}

output "user_pool_client_id" {
  value       = aws_cognito_user_pool_client.console.id
  description = "Cognito App Client ID"
}

output "portal_user_pool_client_id" {
  value       = aws_cognito_user_pool_client.portal.id
  description = "Cognito Portal (public) App Client ID"
}

output "issuer" {
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}"
  description = "OIDC issuer URL for JWT validation"
}

output "jwks_url" {
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}/.well-known/jwks.json"
  description = "JWKS URL"
}

output "hosted_ui_domain" {
  value       = aws_cognito_user_pool_domain.hosted.domain
  description = "Cognito Hosted UI domain prefix"
}

# Split applicant pool outputs (present only if created)
output "applicant_user_pool_id" {
  value       = try(aws_cognito_user_pool.applicant[0].id, null)
  description = "Applicant Cognito User Pool ID"
}

output "applicant_user_pool_client_id" {
  value       = try(aws_cognito_user_pool_client.applicant_portal[0].id, null)
  description = "Applicant Portal App Client ID"
}

output "applicant_issuer" {
  value       = try("https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.applicant[0].id}", null)
  description = "Applicant pool OIDC issuer URL"
}

output "applicant_hosted_ui_domain" {
  value       = try(aws_cognito_user_pool_domain.applicant[0].domain, null)
  description = "Applicant pool Hosted UI domain prefix"
}
