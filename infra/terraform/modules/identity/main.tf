data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_partition" "current" {}

locals {
  component_tags = merge(var.tags, {
    Component = "identity"
  })

  admin_domain_prefix  = "${var.name_prefix}-admin-${substr(md5(var.name_prefix), 0, 6)}"
  portal_domain_prefix = "${var.name_prefix}-portal-${substr(md5(var.name_prefix), 6, 6)}"
}

# Admin user pool
resource "aws_cognito_user_pool" "admin" {
  name = "${var.name_prefix}-admin"

  mfa_configuration = var.admin_mfa_configuration
  software_token_mfa_configuration {
    enabled = var.admin_mfa_configuration != "OFF"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account  = var.use_cognito_managed_emails ? "COGNITO_DEFAULT" : "DEVELOPER"
    reply_to_email_address = length(var.ses_sender_email) > 0 ? var.ses_sender_email : null
    source_arn             = length(var.ses_sender_email) > 0 ? "arn:${data.aws_partition.current.partition}:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_sender_email}" : null
  }

  tags = merge(local.component_tags, {
    Purpose = "admin"
  })
}

resource "aws_cognito_user_pool_domain" "admin" {
  domain       = local.admin_domain_prefix
  user_pool_id = aws_cognito_user_pool.admin.id
}

resource "aws_cognito_user_pool_client" "admin" {
  name                = "${var.name_prefix}-admin-client"
  user_pool_id        = aws_cognito_user_pool.admin.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]

  callback_urls = var.admin_callback_urls
  logout_urls   = var.admin_logout_urls

  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "ENABLED"

}

# Applicant user pool
resource "aws_cognito_user_pool" "portal" {
  name = "${var.name_prefix}-portal"

  mfa_configuration = var.portal_mfa_configuration

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account  = var.use_cognito_managed_emails ? "COGNITO_DEFAULT" : "DEVELOPER"
    reply_to_email_address = length(var.ses_sender_email) > 0 ? var.ses_sender_email : null
    source_arn             = length(var.ses_sender_email) > 0 ? "arn:${data.aws_partition.current.partition}:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_sender_email}" : null
  }

  tags = merge(local.component_tags, {
    Purpose = "portal"
  })
}

resource "aws_cognito_user_pool_domain" "portal" {
  domain       = local.portal_domain_prefix
  user_pool_id = aws_cognito_user_pool.portal.id
}

resource "aws_cognito_user_pool_client" "portal" {
  name                = "${var.name_prefix}-portal-client"
  user_pool_id        = aws_cognito_user_pool.portal.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]

  callback_urls = var.portal_callback_urls
  logout_urls   = var.portal_logout_urls

  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "ENABLED"

}
