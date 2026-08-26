variable "infra_state_bucket" {
  description = "Nome do bucket S3 onde esta o remote state da infraestrutura (VPC/EKS), o mesmo usado por oficina-infra-database"
  type        = string
}

variable "jwt_secret" {
  description = "Segredo (Base64) usado para assinar/validar os JWTs emitidos para clientes autenticados por CPF"
  type        = string
  sensitive   = true
}

variable "jwt_expiration_seconds" {
  description = "Tempo de expiracao do JWT de cliente, em segundos"
  type        = string
  default     = "3600"
}

variable "rds_endpoint" {
  description = "Endpoint do RDS Postgres (obtido com: terraform output -raw DB_Endpoint em oficina-infra-database). Muda a cada recriacao do banco."
  type        = string
}

variable "rds_database" {
  description = "Nome do banco de dados usado pela oficina-app-api"
  type        = string
  default     = "oficina_db"
}

variable "rds_secret_arn" {
  description = "ARN do segredo no Secrets Manager com usuario/senha do RDS (obtido com: terraform output -raw DB_Secret_Arn em oficina-infra-database). Nao e sensivel - e so um identificador; o LabRole tem permissao de ler o valor em tempo de execucao."
  type        = string
}

variable "app_api_base_url" {
  description = "Hostname do LoadBalancer da oficina-app-api no EKS (kubectl get svc oficina-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'). Muda a cada recriacao do Service."
  type        = string
}
