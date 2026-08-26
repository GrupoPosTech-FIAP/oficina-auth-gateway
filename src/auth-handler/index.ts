import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { isCpfValido, limparDocumento } from "../shared/cpf";
import { buscarStatusClientePorDocumento } from "../shared/db";
import { assinarToken } from "../shared/jwt";
import { registrarTentativa } from "../shared/rateLimit";

interface AuthRequestBody {
  cpf?: string;
}

function resposta(statusCode: number, body: Record<string, unknown>): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const ipOrigem = event.requestContext?.http?.sourceIp ?? "desconhecido";
  const limite = await registrarTentativa(ipOrigem);
  if (!limite.permitido) {
    return resposta(429, { message: "Muitas tentativas de autenticação. Tente novamente mais tarde." });
  }

  let body: AuthRequestBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return resposta(400, { message: "Corpo da requisição inválido" });
  }

  if (!isCpfValido(body.cpf)) {
    return resposta(400, { message: "CPF inválido" });
  }

  const documento = limparDocumento(body.cpf as string);

  try {
    const status = await buscarStatusClientePorDocumento(documento);

    if (!status.encontrado) {
      return resposta(404, { message: "Cliente não encontrado" });
    }

    if (!status.ativo) {
      return resposta(403, { message: "Cliente inativo" });
    }

    const token = assinarToken(documento);
    return resposta(200, { token });
  } catch (erro) {
    console.error("Erro ao autenticar cliente por CPF", erro);
    return resposta(500, { message: "Erro interno ao processar a autenticação" });
  }
}
