output "vpc_id" {
  description = "VPC id."
  value       = aws_vpc.core.id
}

output "private_subnet_ids" {
  description = "Private subnet ids."
  value       = [for subnet in aws_subnet.private : subnet.id]
}

output "isolated_subnet_ids" {
  description = "Isolated subnet ids."
  value       = [for subnet in aws_subnet.isolated : subnet.id]
}

output "public_subnet_ids" {
  description = "Public subnet ids (if NAT enabled)."
  value       = [for subnet in aws_subnet.public : subnet.id]
}

output "route_table_ids" {
  description = "Route table ids segmented by type."
  value = {
    public   = [for rt in aws_route_table.public : rt.id]
    private  = [for rt in aws_route_table.private : rt.id]
    isolated = [for rt in aws_route_table.isolated : rt.id]
  }
}

output "gateway_endpoints" {
  description = "Gateway endpoint ids for S3/DynamoDB."
  value = {
    s3       = aws_vpc_endpoint.s3.id
    dynamodb = aws_vpc_endpoint.dynamodb.id
  }
}

output "tags" {
  description = "Tags applied within the networking module."
  value       = local.component_tags
}

output "egress_security_group_id" {
  description = "Security group enforcing default egress policies."
  value       = aws_security_group.egress_restrict.id
}

output "flow_log_group_name" {
  description = "CloudWatch log group collecting VPC flow logs."
  value       = aws_cloudwatch_log_group.flow.name
}
