import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// maxAttempts=1: sem retry, para o custo de uma falha nao multiplicar no timeout
// da Lambda (ver TIMEOUT_MS abaixo).
const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 1 }));

const TIMEOUT_MS = 2000;

export interface ResultadoLimite {
  permitido: boolean;
  tentativas: number;
}

/**
 * Mitiga o principal risco de autenticar só com CPF (que não é segredo):
 * alguém varrendo vários CPFs em sequência até achar um cadastrado e ativo.
 * Contador de tentativas por IP de origem, janela fixa com TTL no DynamoDB
 * (o próprio item expira e "reseta" a janela).
 */
export async function registrarTentativa(ip: string): Promise<ResultadoLimite> {
  const tabela = process.env.RATE_LIMIT_TABLE;
  const maxTentativas = Number(process.env.RATE_LIMIT_MAX_TENTATIVAS ?? "10");
  const janelaSegundos = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? "300");

  if (!tabela) {
    // Sem tabela configurada (ex.: execução local/testes) - não bloqueia.
    return { permitido: true, tentativas: 0 };
  }

  const agora = Math.floor(Date.now() / 1000);
  const expiraEm = agora + janelaSegundos;

  // Aborta explicitamente: sem isso, uma chamada que nunca responde (rede da VPC
  // sem rota para o DynamoDB) consome todo o timeout da Lambda e nunca cai no catch.
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TIMEOUT_MS);

  try {
    const resultado = await cliente.send(
      new UpdateCommand({
        TableName: tabela,
        Key: { ip },
        UpdateExpression: "SET expira_em = if_not_exists(expira_em, :expiraEm) ADD tentativas :incr",
        ExpressionAttributeValues: { ":incr": 1, ":expiraEm": expiraEm },
        ReturnValues: "UPDATED_NEW",
      }),
      { abortSignal: controle.signal }
    );

    const tentativas = Number(resultado.Attributes?.tentativas ?? 0);
    return { permitido: tentativas <= maxTentativas, tentativas };
  } catch (erro) {
    // Falha no rate limiter não deve derrubar a autenticação (fail-open) -
    // só registra, já que o throttling do API Gateway segue como defesa.
    console.error("Falha ao registrar tentativa de autenticação no rate limiter", erro);
    return { permitido: true, tentativas: 0 };
  } finally {
    clearTimeout(limite);
  }
}
