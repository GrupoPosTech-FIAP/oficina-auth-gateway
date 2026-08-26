import { isCpfValido, limparDocumento } from "../../src/shared/cpf";

describe("isCpfValido", () => {
  it("aceita um CPF válido sem máscara", () => {
    expect(isCpfValido("52998224725")).toBe(true);
  });

  it("aceita um CPF válido com máscara", () => {
    expect(isCpfValido("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com tamanho incorreto", () => {
    expect(isCpfValido("123456789")).toBe(false);
    expect(isCpfValido("123456789012")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(isCpfValido("11111111111")).toBe(false);
    expect(isCpfValido("00000000000")).toBe(false);
  });

  it("rejeita CPF com dígito verificador incorreto", () => {
    expect(isCpfValido("52998224726")).toBe(false);
  });

  it("rejeita valores vazios ou nulos", () => {
    expect(isCpfValido("")).toBe(false);
    expect(isCpfValido(null)).toBe(false);
    expect(isCpfValido(undefined)).toBe(false);
  });
});

describe("limparDocumento", () => {
  it("remove máscara mantendo só os dígitos", () => {
    expect(limparDocumento("529.982.247-25")).toBe("52998224725");
  });
});
