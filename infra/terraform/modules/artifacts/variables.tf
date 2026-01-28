variable "name_prefix" {
  description = "Resource name prefix to keep stacks discoverable."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for default bucket encryption. Leave blank to use SSE-S3."
  type        = string
  default     = ""
}

variable "log_bucket_name" {
  description = "Optional S3 bucket name that receives access logs."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to resources."
  type        = map(string)
  default     = {}
}
