resource "aws_apigatewayv2_api" "auth_gateway" {
  name          = "oficina-auth-gateway"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.auth_gateway.id
  name        = "$default"
  auto_deploy = true

  # Defesa em profundidade contra varredura de CPFs em POST /auth, alem do
  # rate limiting por IP feito no proprio auth-handler (DynamoDB): aqui e
  # uma trava mais grosseira, na porta de entrada, que tambem protege as
  # rotas protegidas de um flood generico.
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }

  route_settings {
    route_key              = aws_apigatewayv2_route.post_auth.route_key
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw_access_logs" {
  name              = "/aws/apigateway/oficina-auth-gateway"
  retention_in_days = 14
}

data "aws_iam_policy_document" "api_gw_logs" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api_gw_access_logs.arn}:*"]

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_cloudwatch_log_resource_policy" "api_gw_logs" {
  policy_name     = "oficina-auth-gateway-apigw-logs"
  policy_document = data.aws_iam_policy_document.api_gw_logs.json
}

# --- Rota publica: POST /auth (sem authorizer) ---

resource "aws_lambda_permission" "allow_apigw_invoke_auth_handler" {
  statement_id  = "AllowAPIGatewayInvokeAuthHandler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.auth_gateway.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "auth_handler" {
  api_id                 = aws_apigatewayv2_api.auth_gateway.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_auth" {
  api_id    = aws_apigatewayv2_api.auth_gateway.id
  route_key = "POST /auth"
  target    = "integrations/${aws_apigatewayv2_integration.auth_handler.id}"
}

# --- Lambda Authorizer: valida o Bearer JWT antes das rotas protegidas ---

resource "aws_lambda_permission" "allow_apigw_invoke_authorizer" {
  statement_id  = "AllowAPIGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.auth_gateway.execution_arn}/*/*"
}

resource "aws_apigatewayv2_authorizer" "cliente_jwt" {
  api_id                            = aws_apigatewayv2_api.auth_gateway.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  name                              = "cliente-jwt-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.${var.gateway_auth_header}"]
  # ttl 0: cada requisicao revalida o token (evita cachear uma decisao de
  # autorizacao por mais tempo do que o necessario num ambiente de estudo).
  authorizer_result_ttl_in_seconds = 0
}

# --- Rotas protegidas: proxy HTTP para a oficina-app-api no EKS ---
# app_api_base_url e o hostname do LoadBalancer do Service "oficina-api"
# (muda a cada recriacao, por isso vem como variavel informada no deploy).

resource "aws_apigatewayv2_integration" "app_api_proxy" {
  api_id                 = aws_apigatewayv2_api.auth_gateway.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://${var.app_api_base_url}:8080/{proxy}"
  payload_format_version = "1.0"

  # Nao tente mexer no header Authorization aqui: a AWS recusa o parameter
  # mapping com "Operations on header authorization are restricted", tanto para
  # "remove:" quanto para "overwrite:". Por isso ele segue sendo repassado para
  # a oficina-app-api - ver a limitacao conhecida no README.
}

resource "aws_apigatewayv2_route" "protected_proxy" {
  api_id             = aws_apigatewayv2_api.auth_gateway.id
  route_key          = "ANY /app/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.app_api_proxy.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cliente_jwt.id
}
