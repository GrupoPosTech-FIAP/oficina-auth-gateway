# Le o remote state do oficina-infra-cluster (mesmo bucket/key que
# oficina-infra-database ja usa) para reaproveitar VPC, sub-redes e tags,
# em vez de recriar essa rede aqui.
data "terraform_remote_state" "infra" {
  backend = "s3"

  config = {
    bucket = var.infra_state_bucket
    key    = "cluster/s3/terraform.tfstate"
    region = "us-east-1"
  }
}
