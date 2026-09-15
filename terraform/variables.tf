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

variable "rds_username" {
  description = "Usuario master do RDS (obtido com: terraform output -raw DB_Username em oficina-infra-database)"
  type        = string
  default     = "postgres"
}

variable "rds_password" {
  description = "Senha master do RDS Postgres. Mesmo segredo de grupo (RDS_PASSWORD) usado pelo deploy de oficina-infra-database."
  type        = string
  sensitive   = true
}

variable "app_api_base_url" {
  description = "Hostname do LoadBalancer da oficina-app-api no EKS (kubectl get svc oficina-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'). Muda a cada recriacao do Service."
  type        = string
}

variable "rate_limit_max_tentativas" {
  description = "Numero maximo de chamadas a POST /auth aceitas por IP dentro da janela (rate_limit_window_seconds) antes de responder 429"
  type        = string
  default     = "10"
}

variable "rate_limit_window_seconds" {
  description = "Duracao da janela de rate limiting por IP, em segundos"
  type        = string
  default     = "300"
}

variable "gateway_auth_header" {
  description = "Nome do cabecalho HTTP customizado usado pelo API Gateway Authorizer para validar o JWT do cliente"
  type        = string
  default     = "x-gateway-auth"
}
