output "bootstrap" {
  value = module.bootstrap
}

output "networking" {
  value = module.networking
}

output "kms" {
  value = module.kms
}

output "logging" {
  value = module.logging
}

output "security" {
  value = module.security
}

output "acm" {
  value = module.acm
}

output "data" {
  value = module.data
}

output "identity" {
  value = module.identity
}

output "compute" {
  value = module.compute
}

# Note: modules currently expose maps/objects. Adjust once module interfaces solidify.
