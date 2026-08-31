output "API_Gateway_URL" {
  description = "URL base do API Gateway. Ex: <URL>/auth para autenticar, <URL>/app/{...} para rotas protegidas"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "Lambda_Security_Group_Id" {
  description = "SG da Lambda auth-handler - precisa ser liberado no ingress do RDS (porta 5432) em oficina-infra-database"
  value       = aws_security_group.lambda_auth_handler.id
}
