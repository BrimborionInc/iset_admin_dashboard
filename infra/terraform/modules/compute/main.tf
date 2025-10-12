locals {
  component_tags = merge(var.tags, {
    Component = "compute"
  })
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app"
  description = "Application security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow ALB to reach admin service"
    from_port       = 5001
    to_port         = 5001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Allow ALB to reach portal service"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.component_tags, {
    Purpose = "app-sg"
  })
}

resource "aws_security_group_rule" "db_access" {
  security_group_id        = var.db_security_group_id
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  description              = "Allow application instances to reach database"
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "ALB security group"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_ingress_cidrs
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_ingress_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.component_tags, {
    Purpose = "alb-sg"
  })
}

resource "aws_lb" "app" {
  name                       = "${var.name_prefix}-alb"
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  enable_deletion_protection = false

  tags = merge(local.component_tags, {
    Purpose = "app-alb"
  })
}

resource "aws_lb_target_group" "admin" {
  name     = "${var.name_prefix}-admin-tg"
  port     = 5001
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/healthz"
    healthy_threshold   = 3
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
    matcher             = "200-399"
  }

  tags = merge(local.component_tags, {
    Purpose = "admin-target-group"
  })
}

resource "aws_lb_target_group" "portal" {
  name     = "${var.name_prefix}-portal-tg"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/healthz"
    healthy_threshold   = 3
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
    matcher             = "200-399"
  }

  tags = merge(local.component_tags, {
    Purpose = "portal-target-group"
  })
}

resource "aws_lb_listener" "https" {
  count = var.alb_certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
}

resource "aws_lb_listener" "http_forward" {
  count = var.alb_certificate_arn == "" ? 1 : 0

  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  count = var.alb_certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

locals {
  https_listener_arn       = try(aws_lb_listener.https[0].arn, null)
  http_forward_listener_arn = try(aws_lb_listener.http_forward[0].arn, null)
}

resource "aws_lb_listener_rule" "https_admin" {
  count        = local.https_listener_arn != null && var.admin_domain_name != "" ? 1 : 0
  listener_arn = local.https_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    host_header {
      values = [var.admin_domain_name]
    }
  }
}

resource "aws_lb_listener_rule" "https_portal" {
  count        = local.https_listener_arn != null && var.portal_domain_name != "" ? 1 : 0
  listener_arn = local.https_listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portal.arn
  }

  condition {
    host_header {
      values = [var.portal_domain_name]
    }
  }
}

resource "aws_lb_listener_rule" "http_admin" {
  count        = local.http_forward_listener_arn != null && var.admin_domain_name != "" ? 1 : 0
  listener_arn = local.http_forward_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    host_header {
      values = [var.admin_domain_name]
    }
  }
}

resource "aws_lb_listener_rule" "http_portal" {
  count        = local.http_forward_listener_arn != null && var.portal_domain_name != "" ? 1 : 0
  listener_arn = local.http_forward_listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portal.arn
  }

  condition {
    host_header {
      values = [var.portal_domain_name]
    }
  }
}

resource "aws_iam_role" "app" {
  name = "${var.name_prefix}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.component_tags, {
    Purpose = "app-instance-role"
  })
}

resource "aws_iam_role_policy_attachment" "app_ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "app_runtime" {
  name = "${var.name_prefix}-app-runtime"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParameterHistory"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/nwac/test/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::nwac-test-*",
          "arn:aws:s3:::nwac-test-*/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.name_prefix}-app"
  role = aws_iam_role.app.name
}

resource "aws_launch_template" "app" {
  name_prefix            = "${var.name_prefix}-lt-"
  image_id               = var.ami_id
  instance_type          = var.app_instance_type
  key_name               = length(var.key_name) > 0 ? var.key_name : null
  update_default_version = true

  vpc_security_group_ids = [aws_security_group.app.id]

  user_data = length(var.user_data_render) > 0 ? base64encode(var.user_data_render) : null

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.component_tags, {
      Purpose = "app-instance"
      Role    = "application"
    })
  }

  tags = merge(local.component_tags, {
    Purpose = "launch-template"
  })
}

resource "aws_autoscaling_group" "app" {
  name                      = "${var.name_prefix}-asg"
  min_size                  = 2
  max_size                  = 4
  desired_capacity          = 2
  vpc_zone_identifier       = var.private_subnet_ids
  health_check_type         = "ELB"
  health_check_grace_period = 120

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  target_group_arns = [
    aws_lb_target_group.admin.arn,
    aws_lb_target_group.portal.arn,
  ]

  tag {
    key                 = "Name"
    value               = "${var.name_prefix}-app"
    propagate_at_launch = true
  }
  tag {
    key                 = "Component"
    value               = "compute"
    propagate_at_launch = true
  }
}

