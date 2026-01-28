output "bucket" {
  description = "Uploads bucket metadata."
  value = {
    name = aws_s3_bucket.this.bucket
    arn  = aws_s3_bucket.this.arn
  }
}

output "tags" {
  description = "Tags applied by the uploads module."
  value       = local.component_tags
}
