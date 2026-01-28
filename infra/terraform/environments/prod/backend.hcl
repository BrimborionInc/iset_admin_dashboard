bucket         = "nwac-prod-terraform-state"    # Placeholder – create bucket via bootstrap module
dynamodb_table = "nwac_prod_terraform_locks"    # Placeholder – create table via bootstrap module
key            = "nwac-prod/terraform.tfstate"
region         = "ca-central-1"
encrypt        = true
