import type { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/shared/db");
jest.mock("../../src/shared/jwt");
jest.mock("../../src/shared/rateLimit");

import { handler } from "../../src/auth-handler";
import { buscarStatusClientePorDocumento } from "../../src/shared/db";
import { assinarToken } from "../../src/shared/jwt";
import { registrarTentativa } from "../../src/shared/rateLimit";

const buscarStatusClientePorDocumentoMock = buscarStatusClientePorDocumento as jest.MockedFunction<
  typeof buscarStatusClientePorDocumento
>;
const assinarTokenMock = assinarToken as jest.MockedFunction<typeof assinarToken>;
const registrarTentativaMock = registrarTentativa as jest.MockedFunction<typeof registrarTentativa>;

const CPF_VALIDO = "52998224725";

function criarEvento(body: unknown, ip = "203.0.113.10"): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    requestContext: { http: { sourceIp: ip } },
  } as APIGatewayProxyEventV2;
}

describe("auth-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registrarTentativaMock.mockResolvedValue({ permitido: true, tentativas: 1 });
  });

  it("retorna 429 quando o rate limit por IP é excedido", async () => {
    registrarTentativaMock.mockResolvedValue({ permitido: false, tentativas: 11 });

    const resultado = await handler(criarEvento({ cpf: CPF_VALIDO }));

    expect(resultado.statusCode).toBe(429);
    expect(buscarStatusClientePorDocumentoMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o CPF é inválido", async () => {
    const resultado = await handler(criarEvento({ cpf: "123" }));

    expect(resultado.statusCode).toBe(400);
    expect(buscarStatusClientePorDocumentoMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o corpo não é um JSON válido", async () => {
    const eventoComCorpoInvalido = {
      body: "{invalido",
      requestContext: { http: { sourceIp: "203.0.113.10" } },
    } as unknown as APIGatewayProxyEventV2;

    const resultado = await handler(eventoComCorpoInvalido);

    expect(resultado.statusCode).toBe(400);
  });

  it("retorna 404 quando o cliente não é encontrado", async () => {
    buscarStatusClientePorDocumentoMock.mockResolvedValue({ encontrado: false, ativo: false });

    const resultado = await handler(criarEvento({ cpf: CPF_VALIDO }));

    expect(resultado.statusCode).toBe(404);
  });

  it("retorna 403 quando o cliente está inativo", async () => {
    buscarStatusClientePorDocumentoMock.mockResolvedValue({ encontrado: true, ativo: false });

    const resultado = await handler(criarEvento({ cpf: CPF_VALIDO }));

    expect(resultado.statusCode).toBe(403);
  });

  it("retorna 200 com o token quando o cliente está ativo", async () => {
    buscarStatusClientePorDocumentoMock.mockResolvedValue({ encontrado: true, ativo: true });
    assinarTokenMock.mockReturnValue("token-fake");

    const resultado = await handler(criarEvento({ cpf: CPF_VALIDO }));

    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body as string)).toEqual({ token: "token-fake" });
    expect(assinarTokenMock).toHaveBeenCalledWith(CPF_VALIDO);
  });

  it("retorna 500 quando a consulta ao banco falha", async () => {
    buscarStatusClientePorDocumentoMock.mockRejectedValue(new Error("conexão recusada"));

    const resultado = await handler(criarEvento({ cpf: CPF_VALIDO }));

    expect(resultado.statusCode).toBe(500);
  });
});
