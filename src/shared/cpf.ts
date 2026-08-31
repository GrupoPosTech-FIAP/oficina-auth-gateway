const WEIGHTS_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

function limparCpf(cpf: string): string {
  return cpf.replace(/[^0-9]/g, "");
}

function calcularDigitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0);
  const resto = 11 - (soma % 11);
  return resto >= 10 ? 0 : resto;
}

/**
 * Mesma regra de validação de oficina-domain/Cpf.java: 11 dígitos,
 * rejeita sequências repetidas e confere os 2 dígitos verificadores (mod 11).
 */
export function isCpfValido(cpfComOuSemMascara: string | null | undefined): boolean {
  if (!cpfComOuSemMascara) return false;
  const cpf = limparCpf(cpfComOuSemMascara);

  if (cpf.length !== 11) return false;
  if (new Set(cpf.split("")).size === 1) return false;

  const digito1 = calcularDigitoVerificador(cpf, WEIGHTS_1);
  const digito2 = calcularDigitoVerificador(cpf, WEIGHTS_2);

  return Number(cpf[9]) === digito1 && Number(cpf[10]) === digito2;
}

export function limparDocumento(cpfComOuSemMascara: string): string {
  return limparCpf(cpfComOuSemMascara);
}
