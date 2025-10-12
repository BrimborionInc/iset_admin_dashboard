locals {
  component_tags = merge(var.tags, {
    Component = "acm"
  })
}

resource "aws_acm_certificate" "this" {
  domain_name               = var.admin_domain_name
  subject_alternative_names = [var.portal_domain_name]
  validation_method         = "DNS"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  tags = merge(local.component_tags, {
    Purpose = "acm-certificate"
  })

  lifecycle {
    create_before_destroy = true
  }
}
