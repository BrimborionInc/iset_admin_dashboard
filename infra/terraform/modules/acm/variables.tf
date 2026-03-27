variable "admin_domain_name" {
  description = "Primary domain name for admin console."
  type        = string
}

variable "portal_domain_name" {
  description = "Secondary domain name for public portal."
  type        = string
}

variable "portal_additional_domain_names" {
  description = "Additional domain names for the public portal certificate."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Base tags."
  type        = map(string)
  default     = {}
}
