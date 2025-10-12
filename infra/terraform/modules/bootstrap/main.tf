variable "name_prefix" {
  description = "Consistent resource name prefix."
  type        = string
}

variable "aws_region" {
  description = "Primary region for regional resources (state bucket, etc.)."
  type        = string
  default     = "ca-central-1"
}

variable "tags" {
  description = "Base tags to apply to bootstrap resources."
  type        = map(string)
  default     = {}
}

data "aws_caller_identity" "current" {}

locals {
  component_tags = merge(var.tags, {
    Component = "bootstrap"
  })

  state_bucket_name = "${var.name_prefix}-terraform-state"
  lock_table_name   = "${replace(var.name_prefix, "-", "_")}_terraform_locks"
}

resource "aws_s3_bucket" "state" {
  bucket        = local.state_bucket_name
  force_destroy = false

  tags = merge(local.component_tags, {
    Purpose = "terraform-state"
  })
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "locks" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(local.component_tags, {
    Purpose = "terraform-locks"
  })
}

# Additional account guardrails (access analyzer, password policy, etc.) to be added later.
