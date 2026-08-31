import jwt from "jsonwebtoken";
import { assinarToken, validarToken } from "../../src/shared/jwt";

const SECRET_BASE64 = Buffer.from("segredo-de-teste-bem-longo-para-hmac-sha256").toString("base64");

describe("jwt", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: SECRET_BASE64, JWT_EXPIRATION_SECONDS: "3600" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("gera um token e valida ele com sucesso", () => {
    const token = assinarToken("52998224725");

    const payload = validarToken(token);

    expect(payload.sub).toBe("52998224725");
    expect(payload.tipo).toBe("cliente");
  });

  it("rejeita token expirado", () => {
    const chave = Buffer.from(SECRET_BASE64, "base64");
    const tokenExpirado = jwt.sign({ sub: "52998224725", tipo: "cliente" }, chave, {
      algorithm: "HS256",
      expiresIn: -10,
    });

    expect(() => validarToken(tokenExpirado)).toThrow();
  });

  it("rejeita token com assinatura adulterada", () => {
    const token = assinarToken("52998224725");
    const tokenAdulterado = token.slice(0, -2) + (token.slice(-2) === "aa" ? "bb" : "aa");

    expect(() => validarToken(tokenAdulterado)).toThrow();
  });

  it("lança erro claro quando JWT_SECRET não está configurado", () => {
    delete process.env.JWT_SECRET;

    expect(() => assinarToken("52998224725")).toThrow("JWT_SECRET não configurado");
  });
});
