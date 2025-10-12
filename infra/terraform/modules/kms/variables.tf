variable "name_prefix" {
  description = "Prefix applied to KMS keys."
  type        = string
}

variable "tags" {
  description = "Base tags for KMS resources."
  type        = map(string)
  default     = {}
}

variable "enable_rotation" {
  description = "Enable automatic rotation on customer managed keys."
  type        = bool
  default     = true
}
