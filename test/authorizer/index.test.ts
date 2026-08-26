jest.mock("../../src/shared/jwt");

import { handler } from "../../src/authorizer";
import { validarToken } from "../../src/shared/jwt";

const validarTokenMock = validarToken as jest.MockedFunction<typeof validarToken>;

describe("authorizer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("nega quando não há header Authorization", async () => {
    const resultado = await handler({ headers: {} });

    expect(resultado.isAuthorized).toBe(false);
    expect(validarTokenMock).not.toHaveBeenCalled();
  });

  it("nega quando o header não usa o prefixo Bearer", async () => {
    const resultado = await handler({ headers: { authorization: "token-sem-prefixo" } });

    expect(resultado.isAuthorized).toBe(false);
  });

  it("nega quando o token é inválido ou expirado", async () => {
    validarTokenMock.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    const resultado = await handler({ headers: { authorization: "Bearer token-invalido" } });

    expect(resultado.isAuthorized).toBe(false);
  });

  it("autoriza e propaga o CPF no context quando o token é válido", async () => {
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { authorization: "Bearer token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toEqual({ cpf: "52998224725" });
  });

  it("funciona com header capitalizado (Authorization)", async () => {
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { Authorization: "Bearer token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
  });
});
