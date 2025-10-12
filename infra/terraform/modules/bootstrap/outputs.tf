output "account_id" {
  description = "AWS account id targeted by this deployment."
  value       = data.aws_caller_identity.current.account_id
}

output "state_bucket" {
  description = "Terraform state bucket name."
  value = {
    name = aws_s3_bucket.state.bucket
    arn  = aws_s3_bucket.state.arn
  }
}

output "lock_table" {
  description = "Terraform state lock table name."
  value = {
    name = aws_dynamodb_table.locks.name
    arn  = aws_dynamodb_table.locks.arn
  }
}

output "tags" {
  description = "Tags applied by the bootstrap module."
  value       = local.component_tags
}
