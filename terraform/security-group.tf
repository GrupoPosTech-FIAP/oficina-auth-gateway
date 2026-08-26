# SG da Lambda auth-handler: ela roda dentro da VPC (para alcancar o RDS,
# que nao e publico) e por isso precisa de um Security Group proprio.
# So egress e necessario aqui - quem controla a entrada e o SG do RDS,
# que precisa liberar este SG na porta 5432 (mudanca feita em
# oficina-infra-database, coordenada na Fase 10 do plano).
resource "aws_security_group" "lambda_auth_handler" {
  name        = "lambda-auth-handler-sg"
  description = "SG da Lambda auth-handler (oficina-auth-gateway), usada para liberar acesso dela ao RDS"
  vpc_id      = data.terraform_remote_state.infra.outputs.VPC_ID

  egress {
    description = "Saida liberada (padrao) - inclui acesso ao RDS na porta 5432"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = data.terraform_remote_state.infra.outputs.Tags
}
