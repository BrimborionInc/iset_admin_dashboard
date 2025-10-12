output "log_bucket" {
  description = "S3 bucket used for CloudTrail/Config logs."
  value = {
    name = aws_s3_bucket.log.bucket
    arn  = aws_s3_bucket.log.arn
  }
}

output "access_log_bucket" {
  description = "S3 bucket receiving access logs."
  value = {
    name = aws_s3_bucket.access_log.bucket
    arn  = aws_s3_bucket.access_log.arn
  }
}

output "cloudtrail_trail_arn" {
  description = "ARN of the CloudTrail trail."
  value       = aws_cloudtrail.this.arn
}

output "cloudtrail_log_group_name" {
  description = "CloudWatch log group receiving CloudTrail events."
  value       = aws_cloudwatch_log_group.cloudtrail.name
}

output "config_recorder_name" {
  description = "Configuration Recorder name."
  value       = aws_config_configuration_recorder.this.name
}

output "config_delivery_channel_name" {
  description = "Configuration delivery channel name."
  value       = aws_config_delivery_channel.this.name
}

output "tags" {
  description = "Tags applied by the logging module."
  value       = local.component_tags
}
