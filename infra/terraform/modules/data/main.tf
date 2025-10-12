data "aws_caller_identity" "current" {}

locals {
  component_tags = merge(var.tags, {
    Component = "data"
  })
}

resource "random_password" "master" {
  length           = 20
  special          = true
  override_special = "!@#%^*-_+"
}

resource "aws_secretsmanager_secret" "master" {
  name        = "${var.name_prefix}-db-credentials"
  description = "Master credentials for ${var.name_prefix} Aurora cluster"

  tags = merge(local.component_tags, {
    Purpose = "db-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.subnet_ids

  tags = merge(local.component_tags, {
    Purpose = "db-subnet-group"
  })
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db"
  description = "Database security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.component_tags, {
    Purpose = "db-security"
  })
}

resource "aws_security_group_rule" "db_ingress" {
  for_each = { for idx, sg in var.allowed_security_group_ids : idx => sg }

  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = each.value
  description              = "Allow MySQL from allowed SG"
}

resource "aws_rds_cluster" "this" {
  cluster_identifier           = "${var.name_prefix}-db"
  engine                       = "aurora-mysql"
  engine_version               = var.engine_version
  database_name                = var.database_name
  master_username              = var.master_username
  master_password              = random_password.master.result
  backup_retention_period      = var.backup_retention_days
  preferred_backup_window      = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window
  storage_encrypted            = true
  kms_key_id                   = var.kms_key_arn
  apply_immediately            = var.apply_immediately
  deletion_protection          = var.deletion_protection
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  copy_tags_to_snapshot        = true
  skip_final_snapshot          = var.skip_final_snapshot
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${var.name_prefix}-db-1"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
  apply_immediately  = var.apply_immediately
  promotion_tier     = 1

  tags = merge(local.component_tags, {
    Purpose = "db-writer"
  })
}

