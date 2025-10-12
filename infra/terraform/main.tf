terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  app_name  = var.app_name
  env       = var.environment
  name_pref = "${local.app_name}-${local.env}"
}

# Package the Pre-Token-Gen Lambda from repo source
# Ensure the source exists at admin-dashboard/infra/lambda/pre-token-gen
# with an index.js exporting handler

data "archive_file" "pre_token_zip" {
  type        = "zip"
  source_dir  = "../lambda/pre-token-gen"
  output_path = "./.terraform/${local.name_pref}-pre-token-gen.zip"
}

# Package the Post-Confirmation Lambda (stub)
data "archive_file" "post_confirmation_zip" {
  type        = "zip"
  source_dir  = "../lambda/post-confirmation"
  output_path = "./.terraform/${local.name_pref}-post-confirmation.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "${local.name_pref}-pre-token-gen-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "pre_token_gen" {
  function_name    = "${local.name_pref}-pre-token-gen"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.pre_token_zip.output_path
  source_code_hash = data.archive_file.pre_token_zip.output_base64sha256
  timeout          = 10
}

# Post Confirmation Lambda (stub for applicant provisioning)
resource "aws_lambda_function" "post_confirmation" {
  function_name    = "${local.name_pref}-post-confirmation"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.post_confirmation_zip.output_path
  source_code_hash = data.archive_file.post_confirmation_zip.output_base64sha256
  timeout          = 10
  environment {
    variables = {
      PROVISIONING_WEBHOOK_URL = var.provisioning_webhook_url
    }
  }
}

resource "aws_cognito_user_pool" "admin" {
  name = "${local.app_name}-${local.env}"

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  mfa_configuration = "OPTIONAL"

  # Enable TOTP so OPTIONAL MFA is valid
  software_token_mfa_configuration {
    enabled = true
  }

  dynamic "email_configuration" {
    for_each = var.use_cognito_managed_emails ? [] : [1]
    content {
      email_sending_account = "DEVELOPER"
      from_email_address    = var.ses_sender
      source_arn            = var.ses_identity_arn
    }
  }

  lambda_config {
    pre_token_generation = aws_lambda_function.pre_token_gen.arn
    post_confirmation    = aws_lambda_function.post_confirmation.arn
  }
}

resource "aws_lambda_permission" "allow_cognito_invoke" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token_gen.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.admin.arn
}

resource "aws_lambda_permission" "allow_cognito_invoke_post_confirmation" {
  statement_id  = "AllowExecutionFromCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.admin.arn
}

resource "aws_cognito_user_pool_client" "console" {
  name         = "${local.app_name}-console"
  user_pool_id = aws_cognito_user_pool.admin.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.oidc_callback_urls
  logout_urls   = var.oidc_logout_urls

  generate_secret = false

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 12
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }
}

resource "aws_cognito_user_pool_domain" "hosted" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.admin.id
}

# Groups for roles
resource "aws_cognito_user_group" "sysadmin" {
  name         = "SysAdmin"
  user_pool_id = aws_cognito_user_pool.admin.id
}
resource "aws_cognito_user_group" "programadmin" {
  name         = "ProgramAdmin"
  user_pool_id = aws_cognito_user_pool.admin.id
}
resource "aws_cognito_user_group" "regionalcoordinator" {
  name         = "RegionalCoordinator"
  user_pool_id = aws_cognito_user_pool.admin.id
}
resource "aws_cognito_user_group" "adjudicator" {
  name         = "Adjudicator"
  user_pool_id = aws_cognito_user_pool.admin.id
}

# Applicant group for public portal users

# Public portal app client (PKCE, no secret, short token lifetimes configurable later)
resource "aws_cognito_user_pool_client" "portal" {
  name         = "${local.app_name}-portal"
  user_pool_id = aws_cognito_user_pool.admin.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.portal_callback_urls
  logout_urls   = var.portal_logout_urls

  generate_secret = false

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 30
  id_token_validity      = 30
  refresh_token_validity = 12
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }
}

# Optional: SES email identity (use domain identity in real setups)
resource "aws_ses_email_identity" "sender" {
  count = var.create_ses_identity ? 1 : 0
  email = var.ses_sender
}

# CloudWatch log retention for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.pre_token_gen.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_post_confirmation_logs" {
  name              = "/aws/lambda/${aws_lambda_function.post_confirmation.function_name}"
  retention_in_days = var.log_retention_days
}

# =============================================================
# Separate Applicant User Pool (split from admin pool)
# =============================================================
resource "aws_cognito_user_pool" "applicant" {
  count = var.applicant_app_name == "" ? 0 : 1
  name  = "${var.applicant_app_name}-${local.env}"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  mfa_configuration = "OFF" # Keep lighter for public sign-up; can raise later

  # Optional: reuse post-confirmation provisioning if desired
  lambda_config {
    post_confirmation = aws_lambda_function.post_confirmation.arn
  }
}

resource "aws_lambda_permission" "allow_cognito_invoke_post_confirmation_applicant" {
  count         = var.applicant_app_name == "" ? 0 : 1
  statement_id  = "AllowExecutionFromCognitoPostConfirmationApplicant"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.applicant[0].arn
}

resource "aws_cognito_user_pool_domain" "applicant" {
  count        = length(var.applicant_cognito_domain_prefix) == 0 ? 0 : 1
  domain       = var.applicant_cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.applicant[0].id
}

resource "aws_cognito_user_pool_client" "applicant_portal" {
  count        = var.applicant_app_name == "" ? 0 : 1
  name         = "${var.applicant_app_name}-portal"
  user_pool_id = aws_cognito_user_pool.applicant[0].id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # Allow direct username/password auth (custom hosted UI replacement)
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  callback_urls = var.applicant_callback_urls
  logout_urls   = var.applicant_logout_urls

  generate_secret = false

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 30
  id_token_validity      = 30
  refresh_token_validity = 12
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }
}
