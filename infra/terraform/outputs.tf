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
