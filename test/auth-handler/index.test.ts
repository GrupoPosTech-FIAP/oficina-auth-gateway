import type { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/shared/db");
jest.mock("../../src/shared/jwt");

import { handler } from "../../src/auth-handler";
import { buscarStatusClientePorDocumento } from "../../src/shared/db";
import { assinarToken } from "../../src/shared/jwt";

const buscarStatusClientePorDocumentoMock = buscarStatusClientePorDocumento as jest.MockedFunction<
  typeof buscarStatusClientePorDocumento
>;
const assinarTokenMock = assinarToken as jest.MockedFunction<typeof assinarToken>;

const CPF_VALIDO = "52998224725";

function criarEvento(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

describe("auth-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 400 quando o CPF é inválido", async () => {
    const resultado = await handler(criarEvento({ cpf: "123" }));

    expect(resultado.statusCode).toBe(400);
    expect(buscarStatusClientePorDocumentoMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o corpo não é um JSON válido", async () => {
    const resultado = await handler({ body: "{invalido" } as APIGatewayProxyEventV2);

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
