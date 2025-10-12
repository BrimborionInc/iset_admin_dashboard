variable "aws_region" {
  description = "AWS region for the test environment."
  type        = string
  default     = "ca-central-1"
}

variable "name_prefix" {
  description = "Resource name prefix to keep stacks discoverable."
  type        = string
  default     = "nwac-test"
}

variable "vpc_cidr" {
  description = "CIDR block for the core VPC."
  type        = string
  default     = "10.48.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "Private subnets per AZ for application workloads."
  type        = list(string)
  default = [
    "10.48.0.0/20",
    "10.48.16.0/20",
    "10.48.32.0/20",
  ]
}

variable "isolated_subnet_cidrs" {
  description = "Isolated subnets for database workloads."
  type        = list(string)
  default = [
    "10.48.64.0/24",
    "10.48.65.0/24",
    "10.48.66.0/24",
  ]
}

variable "public_subnet_cidrs" {
  description = "Public subnets for NAT/ingress workloads."
  type        = list(string)
  default = [
    "10.48.96.0/24",
    "10.48.97.0/24",
    "10.48.98.0/24",
  ]
}

variable "log_retention_days" {
  description = "Default CloudWatch Logs retention."
  type        = number
  default     = 400
}

variable "admin_callback_urls" {
  description = "Hosted UI callback URLs for admin app."
  type        = list(string)
}

variable "admin_logout_urls" {
  description = "Hosted UI logout URLs for admin app."
  type        = list(string)
}

variable "portal_callback_urls" {
  description = "Hosted UI callback URLs for applicant portal."
  type        = list(string)
}

variable "portal_logout_urls" {
  description = "Hosted UI logout URLs for applicant portal."
  type        = list(string)
}

variable "ses_sender_email" {
  description = "Verified SES sender email (optional)."
  type        = string
  default     = ""
}

variable "use_cognito_managed_emails" {
  description = "If true, rely on Cognito-managed email."
  type        = bool
  default     = true
}

variable "admin_mfa_configuration" {
  description = "Admin pool MFA configuration."
  type        = string
  default     = "OPTIONAL"
}

variable "portal_mfa_configuration" {
  description = "Applicant pool MFA configuration."
  type        = string
  default     = "OFF"
}

variable "db_name" {
  description = "Primary database name."
  type        = string
  default     = "iset_intake"
}

variable "db_master_username" {
  description = "Master username for the database."
  type        = string
  default     = "app_admin"
}

variable "db_instance_class" {
  description = "Aurora instance class."
  type        = string
  default     = "db.r6g.large"
}

variable "db_engine_version" {
  description = "Aurora MySQL engine version."
  type        = string
  default     = "8.0.mysql_aurora.3.04.0"
}

variable "db_backup_retention_days" {
  description = "Automated backup retention."
  type        = number
  default     = 7
}

variable "db_preferred_backup_window" {
  description = "Backup window."
  type        = string
  default     = "03:00-04:00"
}

variable "db_preferred_maintenance_window" {
  description = "Maintenance window."
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "db_allowed_security_group_ids" {
  description = "Security groups permitted to connect to the database."
  type        = list(string)
  default     = []
}

variable "db_apply_immediately" {
  description = "Apply DB changes immediately."
  type        = bool
  default     = true
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the cluster."
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "Skip creating a final snapshot when destroying the Aurora cluster."
  type        = bool
  default     = false
}

variable "app_instance_type" {
  description = "EC2 instance type for app tier."
  type        = string
  default     = "t3.large"
}

variable "app_ami_parameter_name" {
  description = "SSM parameter containing the desired AMI ID."
  type        = string
  default     = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

variable "app_key_name" {
  description = "Optional EC2 key pair name."
  type        = string
  default     = ""
}

variable "alb_certificate_arn" {
  description = "ACM certificate ARN for HTTPS listeners (leave blank until issued)."
  type        = string
  default     = ""
}

variable "alb_allowed_ingress_cidrs" {
  description = "CIDR blocks permitted to reach ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_user_data" {
  description = "User data script for app instances."
  type        = string
  default     = ""
}

variable "admin_domain_name" {
  description = "Admin console hostname."
  type        = string
  default     = "nwac-console-test.awentech.ca"
}

variable "portal_domain_name" {
  description = "Public portal hostname."
  type        = string
  default     = "nwac-public-test.awentech.ca"
}
