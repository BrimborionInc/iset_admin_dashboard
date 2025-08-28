```hcl
# NOTE: GitHub Actions workflow packages lambdas prior to plan/apply (scripts/package-post-confirmation.sh)
resource "aws_lambda_function" "post_confirmation" {
  function_name = "${var.project}-post-confirmation"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename         = "${path.module}/lambdas/postConfirmation/postConfirmation.zip"
  source_code_hash = filebase64sha256("${path.module}/lambdas/postConfirmation/postConfirmation.zip")
  environment {
    variables = {
      PROVISIONING_WEBHOOK_URL    = var.provisioning_webhook_url
      PROVISIONING_WEBHOOK_SECRET = var.provisioning_webhook_secret
    }
  }
  timeout = 10
  memory_size = 128
  role = aws_iam_role.post_confirmation_lambda_role.arn
}

resource "aws_lambda_permission" "allow_cognito_invoke_post_confirmation" {
  statement_id  = "AllowCognitoInvokePostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

// Attach trigger
resource "aws_cognito_user_pool_lambda_config" "post_confirmation_cfg" {
  user_pool_id       = aws_cognito_user_pool.main.id
  post_confirmation  = aws_lambda_function.post_confirmation.arn
}

// Variables (ensure defined elsewhere):
// variable "provisioning_webhook_url" {}
// variable "provisioning_webhook_secret" { sensitive = true }
```