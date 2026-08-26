resource "aws_apigatewayv2_api" "auth_gateway" {
  name          = "oficina-auth-gateway"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.auth_gateway.id
  name        = "$default"
  auto_deploy = true
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
  identity_sources                  = ["$request.header.Authorization"]
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
}

resource "aws_apigatewayv2_route" "protected_proxy" {
  api_id             = aws_apigatewayv2_api.auth_gateway.id
  route_key          = "ANY /app/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.app_api_proxy.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cliente_jwt.id
}
