import { validarToken } from "../shared/jwt";

interface AuthorizerEvent {
  headers?: Record<string, string | undefined>;
}

interface AuthorizerResult {
  isAuthorized: boolean;
  context?: Record<string, unknown>;
}

const PREFIXO_BEARER = "Bearer ";

// Lambda Authorizer do tipo REQUEST com simple response (config em terraform/apigateway.tf).
export async function handler(event: AuthorizerEvent): Promise<AuthorizerResult> {
  const cabecalho = event.headers?.authorization ?? event.headers?.Authorization;

  if (!cabecalho || !cabecalho.startsWith(PREFIXO_BEARER)) {
    return { isAuthorized: false };
  }

  const token = cabecalho.slice(PREFIXO_BEARER.length);

  try {
    const payload = validarToken(token);
    return { isAuthorized: true, context: { cpf: payload.sub } };
  } catch (erro) {
    console.warn("Token inválido recebido no authorizer", erro);
    return { isAuthorized: false };
  }
}
