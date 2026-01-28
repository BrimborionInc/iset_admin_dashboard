variable "name_prefix" {
  description = "Prefix for resources."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for bucket encryption. Empty for SSE-S3."
  type        = string
  default     = ""
}

variable "log_bucket_name" {
  description = "Optional access log bucket name."
  type        = string
  default     = ""
}

variable "bucket_name_override" {
  description = "Optional explicit bucket name."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
  default     = {}
}
