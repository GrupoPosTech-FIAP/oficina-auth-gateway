# O zip e gerado pelo workflow de deploy (npm run build + zip de dist/ e
# node_modules de producao) antes do "terraform apply". As duas funcoes
# abaixo compartilham o mesmo zip, cada uma apontando para um handler
# diferente dentro dele.
locals {
  lambda_zip_path = "${path.module}/../build/lambda.zip"
}

resource "aws_lambda_function" "auth_handler" {
  function_name    = "oficina-auth-handler"
  role             = data.aws_iam_role.lab.arn
  handler          = "auth-handler/index.handler"
  runtime          = "nodejs20.x"
  filename         = local.lambda_zip_path
  source_code_hash = filebase64sha256(local.lambda_zip_path)
  timeout          = 10

  # Precisa estar na VPC do RDS para conseguir consultar a tabela "clientes".
  vpc_config {
    subnet_ids         = data.terraform_remote_state.infra.outputs.SUBNET_ID
    security_group_ids = [aws_security_group.lambda_auth_handler.id]
  }

  environment {
    variables = {
      JWT_SECRET             = var.jwt_secret
      JWT_EXPIRATION_SECONDS = var.jwt_expiration_seconds
      PGHOST                 = var.rds_endpoint
      PGPORT                 = "5432"
      PGDATABASE             = var.rds_database
      PGUSER                 = var.rds_username
      PGPASSWORD             = var.rds_password
    }
  }

  tags = data.terraform_remote_state.infra.outputs.Tags
}

resource "aws_lambda_function" "authorizer" {
  function_name    = "oficina-auth-authorizer"
  role             = data.aws_iam_role.lab.arn
  handler          = "authorizer/index.handler"
  runtime          = "nodejs20.x"
  filename         = local.lambda_zip_path
  source_code_hash = filebase64sha256(local.lambda_zip_path)
  timeout          = 5

  # Nao acessa banco nenhum, so valida assinatura do JWT -> nao precisa de VPC
  # (evita o cold start extra de anexar uma ENI).
  environment {
    variables = {
      JWT_SECRET = var.jwt_secret
    }
  }

  tags = data.terraform_remote_state.infra.outputs.Tags
}
