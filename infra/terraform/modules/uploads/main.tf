locals {
  component_tags = merge(var.tags, {
    Component = "uploads"
  })

  base_name   = "${var.name_prefix}-uploads"
  bucket_name = var.bucket_name_override != "" ? var.bucket_name_override : "${local.base_name}-${random_id.suffix.hex}"
}

resource "random_id" "suffix" {
  byte_length = 2
}

resource "aws_s3_bucket" "this" {
  bucket        = local.bucket_name
  force_destroy = false

  tags = merge(local.component_tags, {
    Purpose = "uploads"
  })
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != "" ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : null
    }
  }
}

resource "aws_s3_bucket_logging" "this" {
  count         = var.log_bucket_name != "" ? 1 : 0
  bucket        = aws_s3_bucket.this.id
  target_bucket = var.log_bucket_name
  target_prefix = "s3-access/${local.bucket_name}/"
}

data "aws_iam_policy_document" "secure_transport" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    resources = [
      aws_s3_bucket.this.arn,
      "${aws_s3_bucket.this.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "secure_transport" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.secure_transport.json
}
