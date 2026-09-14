# A auth-handler roda dentro da VPC para alcancar o RDS, e as subnets do
# oficina-infra-cluster sao publicas sem NAT: uma ENI de Lambda nao recebe IP
# publico, entao nao tem saida para a internet. Sem este endpoint a chamada ao
# DynamoDB do rate limit fica pendurada ate a Lambda estourar o timeout (o
# fail-open nao salva, porque travar nao lanca excecao).
data "aws_region" "atual" {}

data "aws_route_tables" "vpc" {
  vpc_id = data.terraform_remote_state.infra.outputs.VPC_ID
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = data.terraform_remote_state.infra.outputs.VPC_ID
  service_name      = "com.amazonaws.${data.aws_region.atual.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.vpc.ids

  tags = data.terraform_remote_state.infra.outputs.Tags
}
