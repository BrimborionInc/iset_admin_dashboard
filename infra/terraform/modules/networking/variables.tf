variable "name_prefix" {
  description = "Consistent resource prefix."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR range for VPC."
  type        = string
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
}

variable "isolated_subnet_cidrs" {
  description = "CIDR blocks for isolated subnets (databases)."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (NAT/ingress)."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Base tags to apply to networking resources."
  type        = map(string)
  default     = {}
}

variable "enable_nat_gateway" {
  description = "Whether to create NAT gateways for private subnets."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Retention for VPC flow log CloudWatch group."
  type        = number
  default     = 400
}
