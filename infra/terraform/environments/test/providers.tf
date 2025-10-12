terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment    = "test"
      Project        = "NWAC"
      Classification = "cccs-medium"
      ManagedBy      = "terraform"
    }
  }
}

provider "random" {}

# Optional alternate providers (e.g., security/log accounts) can be aliased later.
