import { validarToken } from "../shared/jwt";

interface AuthorizerEvent {
  headers?: Record<string, string | undefined>;
}

interface AuthorizerResult {
  isAuthorized: boolean;
  context?: Record<string, unknown>;
}

const PREFIXO_BEARER = "Bearer ";
const DEFAULT_AUTH_HEADER = "x-gateway-auth";

// Lambda Authorizer do tipo REQUEST com simple response (config em terraform/apigateway.tf).
export async function handler(event: AuthorizerEvent): Promise<AuthorizerResult> {
  const targetHeader = (process.env.GATEWAY_AUTH_HEADER || DEFAULT_AUTH_HEADER).toLowerCase();

  let cabecalho: string | undefined;
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (key.toLowerCase() === targetHeader && value) {
        cabecalho = value;
        break;
      }
    }
  }

  if (!cabecalho) {
    return { isAuthorized: false };
  }

  const token = cabecalho.startsWith(PREFIXO_BEARER)
    ? cabecalho.slice(PREFIXO_BEARER.length).trim()
    : cabecalho.trim();

  if (!token) {
    return { isAuthorized: false };
  }

  try {
    const payload = validarToken(token);
    return { isAuthorized: true, context: { cpf: payload.sub } };
  } catch (erro) {
    console.warn("Token inválido recebido no authorizer", erro);
    return { isAuthorized: false };
  }
}
