variable "admin_domain_name" {
  description = "Primary domain name for admin console."
  type        = string
}

variable "portal_domain_name" {
  description = "Secondary domain name for public portal."
  type        = string
}

variable "tags" {
  description = "Base tags."
  type        = map(string)
  default     = {}
}
