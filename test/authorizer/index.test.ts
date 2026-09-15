jest.mock("../../src/shared/jwt");

import { handler } from "../../src/authorizer";
import { validarToken } from "../../src/shared/jwt";

const validarTokenMock = validarToken as jest.MockedFunction<typeof validarToken>;

describe("authorizer", () => {
  const envOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it("nega quando não há header x-gateway-auth", async () => {
    const resultado = await handler({ headers: {} });

    expect(resultado.isAuthorized).toBe(false);
    expect(validarTokenMock).not.toHaveBeenCalled();
  });

  it("nega quando o header x-gateway-auth está vazio", async () => {
    const resultado = await handler({ headers: { "x-gateway-auth": "   " } });

    expect(resultado.isAuthorized).toBe(false);
    expect(validarTokenMock).not.toHaveBeenCalled();
  });

  it("nega quando o token é inválido ou expirado", async () => {
    validarTokenMock.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    const resultado = await handler({ headers: { "x-gateway-auth": "token-invalido" } });

    expect(resultado.isAuthorized).toBe(false);
  });

  it("autoriza quando o header usa token puro (sem prefixo Bearer)", async () => {
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { "x-gateway-auth": "token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toEqual({ cpf: "52998224725" });
    expect(validarTokenMock).toHaveBeenCalledWith("token-valido");
  });

  it("autoriza quando o header usa prefixo Bearer", async () => {
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { "x-gateway-auth": "Bearer token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toEqual({ cpf: "52998224725" });
    expect(validarTokenMock).toHaveBeenCalledWith("token-valido");
  });

  it("funciona com header em caixa alta / mista (X-Gateway-Auth)", async () => {
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { "X-Gateway-Auth": "token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toEqual({ cpf: "52998224725" });
  });

  it("respeita cabeçalho customizado via GATEWAY_AUTH_HEADER", async () => {
    process.env.GATEWAY_AUTH_HEADER = "x-custom-token";
    validarTokenMock.mockReturnValue({ sub: "52998224725", tipo: "cliente" });

    const resultado = await handler({ headers: { "x-custom-token": "Bearer token-valido" } });

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toEqual({ cpf: "52998224725" });
    expect(validarTokenMock).toHaveBeenCalledWith("token-valido");
  });
});
