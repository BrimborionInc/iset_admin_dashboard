locals {
  tags = {
    Environment    = "test"
    Project        = "NWAC"
    Classification = "cccs-medium"
    ManagedBy      = "terraform"
  }
}

data "aws_ssm_parameter" "app_ami" {
  name = var.app_ami_parameter_name
}

module "bootstrap" {
  source = "../../modules/bootstrap"

  name_prefix = var.name_prefix
  aws_region  = var.aws_region
  tags        = local.tags
}

module "kms" {
  source = "../../modules/kms"

  name_prefix = var.name_prefix
  tags        = local.tags
}

module "networking" {
  source = "../../modules/networking"

  name_prefix           = var.name_prefix
  vpc_cidr              = var.vpc_cidr
  private_subnet_cidrs  = var.private_subnet_cidrs
  isolated_subnet_cidrs = var.isolated_subnet_cidrs
  public_subnet_cidrs   = var.public_subnet_cidrs
  log_retention_days    = var.log_retention_days
  tags                  = local.tags
}

module "logging" {
  source = "../../modules/logging"

  name_prefix        = var.name_prefix
  aws_region         = var.aws_region
  kms_key_arn        = module.kms.keys.logging.key_arn
  log_retention_days = var.log_retention_days
  tags               = local.tags
}

module "security" {
  source = "../../modules/security"

  name_prefix = var.name_prefix
  aws_region  = var.aws_region
  tags        = local.tags

  depends_on = [
    module.logging
  ]
}

module "acm" {
  source = "../../modules/acm"

  admin_domain_name  = var.admin_domain_name
  portal_domain_name = var.portal_domain_name
  tags               = local.tags
}

module "data" {
  source = "../../modules/data"

  name_prefix                  = var.name_prefix
  tags                         = local.tags
  vpc_id                       = module.networking.vpc_id
  subnet_ids                   = module.networking.isolated_subnet_ids
  kms_key_arn                  = module.kms.keys.data.key_arn
  database_name                = var.db_name
  master_username              = var.db_master_username
  engine_version               = var.db_engine_version
  instance_class               = var.db_instance_class
  backup_retention_days        = var.db_backup_retention_days
  preferred_backup_window      = var.db_preferred_backup_window
  preferred_maintenance_window = var.db_preferred_maintenance_window
  allowed_security_group_ids   = var.db_allowed_security_group_ids
  apply_immediately            = var.db_apply_immediately
  deletion_protection          = var.db_deletion_protection
  skip_final_snapshot          = var.db_skip_final_snapshot
}

# Additional modules (compute, etc.) will be added iteratively.
module "identity" {
  source = "../../modules/identity"

  name_prefix                = var.name_prefix
  aws_region                 = var.aws_region
  kms_key_arn                = module.kms.keys.identity.key_arn
  admin_callback_urls        = var.admin_callback_urls
  admin_logout_urls          = var.admin_logout_urls
  portal_callback_urls       = var.portal_callback_urls
  portal_logout_urls         = var.portal_logout_urls
  ses_sender_email           = var.ses_sender_email
  use_cognito_managed_emails = var.use_cognito_managed_emails
  admin_mfa_configuration    = var.admin_mfa_configuration
  portal_mfa_configuration   = var.portal_mfa_configuration
  tags                       = local.tags
}

# Additional modules (compute, etc.) will be added iteratively.

module "compute" {
  source = "../../modules/compute"

  name_prefix           = var.name_prefix
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_subnet_ids
  db_security_group_id  = module.data.cluster.security_group_id
  app_instance_type     = var.app_instance_type
  ami_id                = data.aws_ssm_parameter.app_ami.value
  key_name              = var.app_key_name
  alb_certificate_arn   = var.alb_certificate_arn
  allowed_ingress_cidrs = var.alb_allowed_ingress_cidrs
  user_data_render      = var.app_user_data
  admin_domain_name     = var.admin_domain_name
  portal_domain_name    = var.portal_domain_name
  tags                  = local.tags
}
