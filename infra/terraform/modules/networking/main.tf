locals {
  component_tags = merge(var.tags, {
    Component = "networking"
  })

  azs = data.aws_availability_zones.available.names

  private_subnet_map  = { for idx, cidr in var.private_subnet_cidrs : tostring(idx) => cidr }
  isolated_subnet_map = { for idx, cidr in var.isolated_subnet_cidrs : tostring(idx) => cidr }
  public_subnet_list  = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : [for idx in range(length(var.private_subnet_cidrs)) : cidrsubnet(var.vpc_cidr, 8, idx + 200)]
  public_subnet_map   = { for idx, cidr in local.public_subnet_list : tostring(idx) => cidr }
}

resource "aws_vpc" "core" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.component_tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.core.id

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-igw"
    Purpose = "internet-gateway"
  })
}

resource "aws_subnet" "private" {
  for_each = local.private_subnet_map

  vpc_id                  = aws_vpc.core.id
  cidr_block              = each.value
  map_public_ip_on_launch = false
  availability_zone       = element(local.azs, tonumber(each.key))

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-private-${each.key}"
    SubnetType = "private"
  })
}

resource "aws_subnet" "isolated" {
  for_each = local.isolated_subnet_map

  vpc_id                  = aws_vpc.core.id
  cidr_block              = each.value
  map_public_ip_on_launch = false
  availability_zone       = element(local.azs, tonumber(each.key))

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-isolated-${each.key}"
    SubnetType = "isolated"
  })
}

resource "aws_subnet" "public" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  vpc_id                  = aws_vpc.core.id
  cidr_block              = each.value
  map_public_ip_on_launch = true
  availability_zone       = element(local.azs, tonumber(each.key))

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-public-${each.key}"
    SubnetType = "public"
  })
}

resource "aws_eip" "nat" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  domain = "vpc"

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-nat-eip-${each.key}"
    Purpose = "nat"
  })
}

resource "aws_nat_gateway" "this" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-nat-${each.key}"
    Purpose = "nat"
  })
}

resource "aws_route_table" "public" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  vpc_id = aws_vpc.core.id

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-rt-public-${each.key}"
    SubnetType = "public"
  })
}

resource "aws_route" "public_internet" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  route_table_id         = aws_route_table.public[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public" {
  for_each = var.enable_nat_gateway ? local.public_subnet_map : {}

  subnet_id      = aws_subnet.public[each.key].id
  route_table_id = aws_route_table.public[each.key].id
}

resource "aws_route_table" "private" {
  for_each = local.private_subnet_map

  vpc_id = aws_vpc.core.id

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-rt-private-${each.key}"
    SubnetType = "private"
  })
}

resource "aws_route_table_association" "private" {
  for_each = local.private_subnet_map

  subnet_id      = aws_subnet.private[each.key].id
  route_table_id = aws_route_table.private[each.key].id
}

resource "aws_route" "private_nat" {
  for_each = var.enable_nat_gateway ? local.private_subnet_map : {}

  route_table_id         = aws_route_table.private[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[each.key].id
}

resource "aws_route_table" "isolated" {
  for_each = local.isolated_subnet_map

  vpc_id = aws_vpc.core.id

  tags = merge(local.component_tags, {
    Name       = "${var.name_prefix}-rt-isolated-${each.key}"
    SubnetType = "isolated"
  })
}

resource "aws_route_table_association" "isolated" {
  for_each = local.isolated_subnet_map

  subnet_id      = aws_subnet.isolated[each.key].id
  route_table_id = aws_route_table.isolated[each.key].id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.core.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    values(aws_route_table.private)[*].id,
    values(aws_route_table.isolated)[*].id
  )

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-ep-s3"
    Purpose = "gateway-endpoint"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.core.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    values(aws_route_table.private)[*].id,
    values(aws_route_table.isolated)[*].id
  )

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-ep-dynamodb"
    Purpose = "gateway-endpoint"
  })
}

resource "aws_cloudwatch_log_group" "flow" {
  name              = "/nwac/test/vpc/${var.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = merge(local.component_tags, {
    Purpose = "network-flow-logs"
  })
}

resource "aws_iam_role" "flow" {
  name = "${var.name_prefix}-flow-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.component_tags, {
    Purpose = "flow-logs"
  })
}

resource "aws_iam_role_policy" "flow" {
  name = "${var.name_prefix}-flow-logs"
  role = aws_iam_role.flow.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"],
        Resource = "${aws_cloudwatch_log_group.flow.arn}:*"
      }
    ]
  })
}

resource "aws_flow_log" "vpc" {
  log_destination          = aws_cloudwatch_log_group.flow.arn
  log_destination_type     = "cloud-watch-logs"
  iam_role_arn             = aws_iam_role.flow.arn
  traffic_type             = "ALL"
  vpc_id                   = aws_vpc.core.id
  max_aggregation_interval = 60

  tags = merge(local.component_tags, {
    Name    = "${var.name_prefix}-flow-log"
    Purpose = "network-monitoring"
  })
}

resource "aws_security_group" "egress_restrict" {
  name        = "${var.name_prefix}-egress"
  description = "Default deny all egress; allow managed services via VPC endpoints."
  vpc_id      = aws_vpc.core.id

  egress {
    description = "Allow VPC local traffic"
    cidr_blocks = [var.vpc_cidr]
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
  }

  tags = merge(local.component_tags, {
    Name      = "${var.name_prefix}-egress"
    Purpose   = "egress-control"
    ManagedBy = "terraform"
  })
}
