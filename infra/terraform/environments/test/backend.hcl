bucket         = "nwac-test-terraform-state"    # Placeholder – create bucket via bootstrap module
dynamodb_table = "nwac_test_terraform_locks"    # Placeholder – create table via bootstrap module
key            = "nwac-test/terraform.tfstate"
region         = "ca-central-1"
encrypt        = true
profile        = "default"
