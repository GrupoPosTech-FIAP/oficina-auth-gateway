import jwt, { JwtPayload } from "jsonwebtoken";

export interface ClienteTokenPayload extends JwtPayload {
  sub: string;
  tipo: "cliente";
}

/**
 * A mesma chave que oficina-app-api usa em JwtService.getChave(): o segredo
 * chega em Base64 e é decodificado para os bytes brutos usados na assinatura HMAC.
 */
function obterChave(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }
  return Buffer.from(secret, "base64");
}

function obterExpiracaoEmSegundos(): number {
  const valor = process.env.JWT_EXPIRATION_SECONDS;
  return valor ? Number(valor) : 3600;
}

export function assinarToken(cpf: string): string {
  const payload: ClienteTokenPayload = { sub: cpf, tipo: "cliente" };
  return jwt.sign(payload, obterChave(), {
    algorithm: "HS256",
    expiresIn: obterExpiracaoEmSegundos(),
  });
}

export function validarToken(token: string): ClienteTokenPayload {
  const payload = jwt.verify(token, obterChave(), { algorithms: ["HS256"] });
  if (typeof payload === "string") {
    throw new Error("Token com payload inválido");
  }
  return payload as ClienteTokenPayload;
}
