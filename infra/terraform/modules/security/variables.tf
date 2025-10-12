variable "name_prefix" {
  description = "Prefix for security resources."
  type        = string
}

variable "aws_region" {
  description = "Region for region-scoped detectors."
  type        = string
  default     = "ca-central-1"
}

variable "tags" {
  description = "Base tags for security resources."
  type        = map(string)
  default     = {}
}

variable "enable_security_hub_cis" {
  description = "Enable CIS AWS Foundations standard."
  type        = bool
  default     = true
}

variable "enable_security_hub_fsbp" {
  description = "Enable AWS Foundational Security Best Practices."
  type        = bool
  default     = true
}

variable "enable_security_hub_audit" {
  description = "Enable AWS Security Hub Audit standard (placeholder for CCCS mapping)."
  type        = bool
  default     = false
}

variable "security_hub_enable_org" {
  description = "If true, attempt to enable Security Hub organization."
  type        = bool
  default     = false
}

variable "guardduty_publishing_frequency" {
  description = "Frequency for GuardDuty finding export."
  type        = string
  default     = "FIFTEEN_MINUTES"
}

variable "sns_topic_arn" {
  description = "Optional SNS topic for high severity alerts."
  type        = string
  default     = ""
}
