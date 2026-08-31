const sendMock = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: sendMock }) },
  UpdateCommand: jest.fn().mockImplementation((input) => input),
}));
jest.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: jest.fn() }));

import { registrarTentativa } from "../../src/shared/rateLimit";

describe("registrarTentativa", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RATE_LIMIT_TABLE: "tabela-teste",
      RATE_LIMIT_MAX_TENTATIVAS: "3",
      RATE_LIMIT_WINDOW_SECONDS: "60",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("permite quando a tabela de rate limit não está configurada", async () => {
    delete process.env.RATE_LIMIT_TABLE;

    const resultado = await registrarTentativa("1.2.3.4");

    expect(resultado).toEqual({ permitido: true, tentativas: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("permite enquanto a contagem estiver dentro do limite", async () => {
    sendMock.mockResolvedValue({ Attributes: { tentativas: 2 } });

    const resultado = await registrarTentativa("1.2.3.4");

    expect(resultado).toEqual({ permitido: true, tentativas: 2 });
  });

  it("bloqueia quando a contagem ultrapassa o limite configurado", async () => {
    sendMock.mockResolvedValue({ Attributes: { tentativas: 4 } });

    const resultado = await registrarTentativa("1.2.3.4");

    expect(resultado).toEqual({ permitido: false, tentativas: 4 });
  });

  it("falha aberto (permite) se o DynamoDB der erro", async () => {
    sendMock.mockRejectedValue(new Error("timeout"));

    const resultado = await registrarTentativa("1.2.3.4");

    expect(resultado.permitido).toBe(true);
  });
});
