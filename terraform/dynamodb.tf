# Rate limiting por IP no auth-handler: mitiga a principal fragilidade de
# autenticar só com CPF (que não é segredo) - alguém varrendo vários CPFs
# em sequência até achar um cadastrado e ativo. O TTL apaga o item sozinho,
# funcionando como uma janela fixa que se "reseta".
resource "aws_dynamodb_table" "auth_rate_limit" {
  name         = "oficina-auth-rate-limit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ip"

  attribute {
    name = "ip"
    type = "S"
  }

  ttl {
    attribute_name = "expira_em"
    enabled        = true
  }

  tags = data.terraform_remote_state.infra.outputs.Tags
}
