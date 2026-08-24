variable "name_prefix" {
  description = "Prefix for compute resources."
  type        = string
}

variable "vpc_id" {
  description = "Core VPC id."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet ids for ALBs."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet ids for application instances."
  type        = list(string)
}

variable "db_security_group_id" {
  description = "Database security group to allow ingress from app tier."
  type        = string
}

variable "app_instance_type" {
  description = "Instance type for application servers."
  type        = string
  default     = "t3.large"
}

variable "ami_id" {
  description = "AMI for app instances (pre-baked with app or base image)."
  type        = string
}

variable "key_name" {
  description = "Optional EC2 key pair name for SSH (break-glass)."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Base tags."
  type        = map(string)
  default     = {}
}

variable "alb_certificate_arn" {
  description = "ACM certificate ARN for HTTPS."
  type        = string
  default     = ""
}

variable "allowed_ingress_cidrs" {
  description = "CIDR blocks allowed to hit the ALB (before basic auth)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "user_data_render" {
  description = "User data script content for app instances."
  type        = string
  default     = ""
}

variable "admin_domain_name" {
  description = "Hostname for the admin console (used for ALB routing)."
  type        = string
  default     = ""
}

variable "portal_domain_name" {
  description = "Hostname for the public portal (used for ALB routing)."
  type        = string
  default     = ""
}

variable "portal_additional_domain_names" {
  description = "Additional hostnames for the public portal (used for ALB routing)."
  type        = list(string)
  default     = []
}

variable "draft_upload_cleanup_bucket_arn" {
  description = "Optional exact upload-bucket ARN on which the portal may fully remove caller-owned pre-submission uploads. Leave empty to grant no cleanup permissions."
  type        = string
  default     = ""

  validation {
    condition     = var.draft_upload_cleanup_bucket_arn == "" || can(regex("^arn:(aws|aws-us-gov|aws-cn):s3:::[^/]+$", var.draft_upload_cleanup_bucket_arn))
    error_message = "draft_upload_cleanup_bucket_arn must be empty or an exact S3 bucket ARN without an object path."
  }
}

variable "app_min_size" {
  description = "Minimum number of application instances in the ASG."
  type        = number
  default     = 2
}

variable "app_max_size" {
  description = "Maximum number of application instances in the ASG."
  type        = number
  default     = 4
}

variable "app_desired_capacity" {
  description = "Desired number of application instances in the ASG."
  type        = number
  default     = 2
}

