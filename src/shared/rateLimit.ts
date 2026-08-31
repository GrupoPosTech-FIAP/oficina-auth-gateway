import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

  try {
    const resultado = await cliente.send(
      new UpdateCommand({
        TableName: tabela,
        Key: { ip },
        UpdateExpression: "SET expira_em = if_not_exists(expira_em, :expiraEm) ADD tentativas :incr",
        ExpressionAttributeValues: { ":incr": 1, ":expiraEm": expiraEm },
        ReturnValues: "UPDATED_NEW",
      })
    );

    const tentativas = Number(resultado.Attributes?.tentativas ?? 0);
    return { permitido: tentativas <= maxTentativas, tentativas };
  } catch (erro) {
    // Falha no rate limiter não deve derrubar a autenticação (fail-open) -
    // só registra, já que o throttling do API Gateway segue como defesa.
    console.error("Falha ao registrar tentativa de autenticação no rate limiter", erro);
    return { permitido: true, tentativas: 0 };
  }
}
