variable "name_prefix" {
  description = "Prefix applied to logging resources."
  type        = string
}

variable "aws_region" {
  description = "AWS region for regional logging resources."
  type        = string
  default     = "ca-central-1"
}

variable "tags" {
  description = "Base tags applied to logging resources."
  type        = map(string)
  default     = {}
}

variable "kms_key_arn" {
  description = "KMS key ARN used to encrypt CloudTrail/Config artifacts and log groups."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for CloudTrail delivery."
  type        = number
  default     = 400
}

variable "s3_lifecycle_glacier_days" {
  description = "Days before moving logs to Glacier."
  type        = number
  default     = 365
}

variable "s3_lifecycle_expire_days" {
  description = "Days before expiring log objects (0 = keep)."
  type        = number
  default     = 0
}

variable "enable_organization_trail" {
  description = "Configure CloudTrail as an organization trail (requires delegated admin)."
  type        = bool
  default     = false
}
