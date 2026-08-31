# Backend remoto do state deste repositório. O bucket é o mesmo usado pelos
# demais repositórios do grupo (oficina-infra-cluster/oficina-infra-database) e é
# informado em tempo de `terraform init` via:
#   terraform init -backend-config="bucket=<TF_BUCKET_NAME>"
terraform {
  backend "s3" {
    key     = "auth-gateway/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
