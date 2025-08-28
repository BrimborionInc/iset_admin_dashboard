variable "aws_region" {
  type        = string
  description = "AWS region to deploy to"
}

variable "app_name" {
  type        = string
  description = "Application name prefix"
  default     = "iset-admin"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, test, prod)"
}

variable "cognito_domain_prefix" {
  type        = string
  description = "Cognito hosted UI domain prefix (must be globally unique)"
}

variable "oidc_callback_urls" {
  type        = list(string)
  description = "Allowed OAuth callback URLs"
}

variable "oidc_logout_urls" {
  type        = list(string)
  description = "Allowed OAuth logout URLs"
}

# Portal (public applicant) Hosted UI callback & logout URLs (distinct from console/admin)
variable "portal_callback_urls" {
  type        = list(string)
  description = "Allowed OAuth callback URLs for public portal app client"
  default     = []
}

variable "portal_logout_urls" {
  type        = list(string)
  description = "Allowed OAuth logout URLs for public portal app client"
  default     = []
}

variable "ses_sender" {
  type        = string
  description = "Verified SES sender email (unused when use_cognito_managed_emails = true)"
  default     = ""
}

variable "ses_identity_arn" {
  type        = string
  description = "SES identity ARN for the sender (unused when use_cognito_managed_emails = true)"
  default     = ""
}

variable "create_ses_identity" {
  type        = bool
  description = "Whether to create SES identity for sender"
  default     = false
}

variable "use_cognito_managed_emails" {
  type        = bool
  description = "Use Cognito-managed emails instead of SES (simpler for dev)"
  default     = true
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch logs retention for Lambda"
  default     = 30
}

variable "provisioning_webhook_url" {
  type        = string
  description = "Optional HTTPS endpoint the PostConfirmation lambda will POST {sub,email,locale} to for applicant provisioning"
  default     = ""
}
