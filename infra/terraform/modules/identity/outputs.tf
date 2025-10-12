output "admin_user_pool" {
  description = "Admin Cognito pool details"
  value = {
    id            = aws_cognito_user_pool.admin.id
    arn           = aws_cognito_user_pool.admin.arn
    client_id     = aws_cognito_user_pool_client.admin.id
    domain        = aws_cognito_user_pool_domain.admin.domain
    hosted_domain = "https://${aws_cognito_user_pool_domain.admin.domain}.auth.${var.aws_region}.amazoncognito.com"
  }
}

output "portal_user_pool" {
  description = "Applicant Cognito pool details"
  value = {
    id            = aws_cognito_user_pool.portal.id
    arn           = aws_cognito_user_pool.portal.arn
    client_id     = aws_cognito_user_pool_client.portal.id
    domain        = aws_cognito_user_pool_domain.portal.domain
    hosted_domain = "https://${aws_cognito_user_pool_domain.portal.domain}.auth.${var.aws_region}.amazoncognito.com"
  }
}

