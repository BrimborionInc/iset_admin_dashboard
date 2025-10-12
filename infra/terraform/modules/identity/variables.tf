variable "name_prefix" {
  description = "Prefix for Cognito/app identity resources."
  type        = string
}

variable "aws_region" {
  description = "AWS region for Cognito pools."
  type        = string
  default     = "ca-central-1"
}

variable "tags" {
  description = "Base tags applied to identity resources."
  type        = map(string)
  default     = {}
}

variable "admin_callback_urls" {
  description = "Hosted UI callback URLs for admin app client."
  type        = list(string)
}

variable "admin_logout_urls" {
  description = "Hosted UI logout URLs for admin app client."
  type        = list(string)
}

variable "portal_callback_urls" {
  description = "Hosted UI callback URLs for applicant portal client."
  type        = list(string)
}

variable "portal_logout_urls" {
  description = "Hosted UI logout URLs for applicant portal client."
  type        = list(string)
}

variable "ses_sender_email" {
  description = "Verified SES sender email (optional)."
  type        = string
  default     = ""
}

variable "use_cognito_managed_emails" {
  description = "If true, rely on Cognito-managed email instead of SES."
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN used for Cognito encryption."
  type        = string
}

variable "admin_mfa_configuration" {
  description = "MFA configuration for admin user pool (OFF, OPTIONAL, ON)."
  type        = string
  default     = "OPTIONAL"
}

variable "portal_mfa_configuration" {
  description = "MFA configuration for applicant user pool."
  type        = string
  default     = "OFF"
}

