output "cluster" {
  description = "Aurora cluster information"
  value = {
    id                = aws_rds_cluster.this.id
    arn               = aws_rds_cluster.this.arn
    endpoint          = aws_rds_cluster.this.endpoint
    reader_endpoint   = aws_rds_cluster.this.reader_endpoint
    database_name     = aws_rds_cluster.this.database_name
    security_group_id = aws_security_group.db.id
    subnet_group_name = aws_db_subnet_group.this.name
  }
}

output "master_secret_arn" {
  description = "Secrets Manager ARN containing master credentials"
  value       = aws_secretsmanager_secret.master.arn
}

