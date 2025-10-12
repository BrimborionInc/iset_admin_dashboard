data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  component_tags = merge(var.tags, {
    Component = "security"
  })
}

# GuardDuty detector
resource "aws_guardduty_detector" "this" {
  enable                       = true
  finding_publishing_frequency = var.guardduty_publishing_frequency

  tags = merge(local.component_tags, {
    Purpose = "guardduty"
  })
}

# Security Hub enablement
resource "aws_securityhub_account" "this" {}

resource "aws_securityhub_standards_subscription" "cis" {
  count         = var.enable_security_hub_cis ? 1 : 0
  standards_arn = "arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0"
  depends_on    = [aws_securityhub_account.this]
}

resource "aws_securityhub_standards_subscription" "fsbp" {
  count         = var.enable_security_hub_fsbp ? 1 : 0
  standards_arn = "arn:aws:securityhub:${data.aws_region.current.name}::standards/aws-foundational-security-best-practices/v/1.0.0"
  depends_on    = [aws_securityhub_account.this]
}

resource "aws_securityhub_standards_subscription" "audit" {
  count         = var.enable_security_hub_audit ? 1 : 0
  standards_arn = "arn:aws:securityhub:${data.aws_region.current.name}::standards/aws-security-hub-best-practices/v/1.0.0"
  depends_on    = [aws_securityhub_account.this]
}

# IAM Access Analyzer (account level)
resource "aws_accessanalyzer_analyzer" "this" {
  analyzer_name = "${var.name_prefix}-access-analyzer"
  type          = "ACCOUNT"

  tags = merge(local.component_tags, {
    Purpose = "iam-access-analyzer"
  })
}

# Security Hub finding aggregator (multi-region)
resource "aws_securityhub_finding_aggregator" "this" {
  linking_mode = "ALL_REGIONS"
}

# Optional SNS notifications for critical/high findings
locals {
  enable_sns = length(trim(var.sns_topic_arn, " ")) > 0
}

resource "aws_cloudwatch_event_rule" "critical_findings" {
  count = local.enable_sns ? 1 : 0

  name        = "${var.name_prefix}-critical-findings"
  description = "Route critical Security Hub findings to SNS"

  event_pattern = jsonencode({
    "source"      = ["aws.securityhub"],
    "detail-type" = ["Security Hub Findings - Imported"],
    "detail" = {
      "findings" = {
        "Severity" = {
          "Label" = ["CRITICAL", "HIGH"]
        }
        "Workflow" = {
          "Status" = ["NEW"]
        }
        "RecordState" = ["ACTIVE"]
      }
    }
  })

  tags = merge(local.component_tags, {
    Purpose = "securityhub-alerting"
  })
}

resource "aws_cloudwatch_event_target" "critical_findings" {
  count = local.enable_sns ? 1 : 0

  rule      = aws_cloudwatch_event_rule.critical_findings[0].name
  target_id = "sns"
  arn       = var.sns_topic_arn
}

resource "aws_sns_topic_policy" "sns" {
  count = local.enable_sns ? 1 : 0

  arn = var.sns_topic_arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgePublish"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = var.sns_topic_arn
      }
    ]
  })
}

