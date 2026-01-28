output "bucket" {
  description = "Artifacts bucket metadata."
  value = {
    name = aws_s3_bucket.this.bucket
    arn  = aws_s3_bucket.this.arn
  }
}
