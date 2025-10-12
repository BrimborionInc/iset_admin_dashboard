output "alb" {
  description = "ALB details"
  value = {
    arn               = aws_lb.app.arn
    dns_name          = aws_lb.app.dns_name
    security_group_id = aws_security_group.alb.id
  }
}

output "autoscaling_group_name" {
  description = "Name of the application ASG"
  value       = aws_autoscaling_group.app.name
}

output "app_security_group_id" {
  description = "Security group attached to application instances"
  value       = aws_security_group.app.id
}

output "launch_template_id" {
  description = "Launch template id"
  value       = aws_launch_template.app.id
}

