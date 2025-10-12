variable "name_prefix" {
  description = "Prefix for database resources."
  type        = string
}

variable "tags" {
  description = "Base tags for data resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC where the database resides."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs (usually isolated) for the Aurora subnet group."
  type        = list(string)
}

variable "kms_key_arn" {
  description = "KMS Key ARN for storage encryption."
  type        = string
}

variable "database_name" {
  description = "Default database name."
  type        = string
  default     = "iset_intake"
}

variable "master_username" {
  description = "Database master username."
  type        = string
  default     = "app_admin"
}

variable "engine_version" {
  description = "Aurora MySQL engine version."
  type        = string
  default     = "8.0.mysql_aurora.3.04.0"
}

variable "instance_class" {
  description = "Instance class for Aurora cluster instances."
  type        = string
  default     = "db.r6g.large"
}

variable "backup_retention_days" {
  description = "Automated backup retention period."
  type        = number
  default     = 7
}

variable "preferred_backup_window" {
  description = "Backup window for the cluster."
  type        = string
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
  description = "Maintenance window for the cluster."
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to access the database."
  type        = list(string)
  default     = []
}

variable "apply_immediately" {
  description = "Apply modifications immediately."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection on the cluster."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip creating a final snapshot when the cluster is destroyed."
  type        = bool
  default     = false
}

