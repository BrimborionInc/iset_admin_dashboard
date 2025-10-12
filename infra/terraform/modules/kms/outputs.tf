output "keys" {
  description = "Map of KMS key metadata."
  value = {
    for key, resource in aws_kms_key.this : key => {
      key_arn   = resource.arn
      key_id    = resource.key_id
      alias_arn = aws_kms_alias.this[key].arn
      alias     = aws_kms_alias.this[key].name
    }
  }
}

output "tags" {
  description = "Tags applied within the KMS module."
  value       = local.component_tags
}
