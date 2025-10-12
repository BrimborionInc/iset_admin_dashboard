data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  component_tags = merge(var.tags, {
    Component = "kms"
  })

  key_definitions = {
    data = {
      description = "Encrypt application data workloads (Aurora, S3 uploads, EBS)."
    }
    logging = {
      description = "Protect logging/audit stores (CloudTrail, CloudWatch, Config)."
    }
    identity = {
      description = "Used for Cognito, SES, and identity-centric services."
    }
    general = {
      description = "General purpose encryption for secrets/parameters."
    }
  }

  logging_policy_statements = [
    {
      Sid       = "AllowCloudTrailEncrypt"
      Effect    = "Allow"
      Principal = { Service = "cloudtrail.amazonaws.com" }
      Action = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
        "kms:CreateGrant",
        "kms:ReEncrypt*"
      ]
      Resource = "*"
    },
    {
      Sid       = "AllowConfigEncrypt"
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
        "kms:CreateGrant",
        "kms:ReEncrypt*"
      ]
      Resource = "*"
    },
    {
      Sid       = "AllowCloudWatchLogsEncrypt"
      Effect    = "Allow"
      Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
      Action = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
        "kms:CreateGrant",
        "kms:ReEncrypt*"
      ]
      Resource = "*"
    }
  ]
}

resource "aws_kms_key" "this" {
  for_each = local.key_definitions

  description             = "${var.name_prefix} ${each.key} key"
  enable_key_rotation     = var.enable_rotation
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Sid       = "EnableRootAccount"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      }
    ], [for statement in local.logging_policy_statements : statement if each.key == "logging"])
  })

  tags = merge(local.component_tags, {
    Purpose = each.key
    Name    = "${var.name_prefix}-${each.key}"
  })
}

resource "aws_kms_alias" "this" {
  for_each = local.key_definitions

  name          = "alias/${var.name_prefix}/${each.key}"
  target_key_id = aws_kms_key.this[each.key].key_id
}
