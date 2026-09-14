# Ordem de deploy da stack

Os quatro repositórios do grupo têm dependências entre si que não são automáticas: parte é resolvida por `terraform_remote_state`, parte depende de valores copiados à mão entre um deploy e o outro. Esta é a sequência que funciona.

Todos os deploys são manuais (`workflow_dispatch`), porque as credenciais do AWS Academy Learner Lab expiram a cada ~4h.

## Passo 0 — Sessão e credenciais

1. Inicie a sessão no Learner Lab e espere ficar verde.
2. Em **AWS Details → AWS CLI → Show**, copie `aws_access_key_id`, `aws_secret_access_key` e `aws_session_token`.
3. Atualize os três secrets na organização: **GitHub → `GrupoPosTech-FIAP` → Settings → Secrets and variables → Actions**.

Os secrets `JWT_SECRET` e `RDS_PASSWORD` são estáveis, não mudam entre sessões.

## Passo 1 — Bucket do Terraform state

O Learner Lab apaga a conta entre sessões, **incluindo o bucket S3 do state**. O Terraform não cria o bucket do próprio backend, então ele precisa existir antes. No terminal do lab:

```bash
aws s3api create-bucket --bucket <nome-do-bucket> --region us-east-1
```

Sem `--create-bucket-configuration` — a AWS rejeita esse parâmetro em `us-east-1`. O nome é global, então pode precisar de sufixo.

Se o bucket não existir, o primeiro deploy falha com `Failed to get existing workspaces: S3 bucket ... does not exist`.

## Passo 2 — `oficina-infra-cluster`

Workflow **Terraform - CI/CD**, input `TF_BUCKET_NAME`. Cria VPC, subnets, ECR e o cluster EKS (~14 min). Exporta `VPC_ID`, `SUBNET_ID`, `EKS_Security_Group_Id` e `Tags`, lidos pelos demais repositórios via remote state.

## Passo 3 — `oficina-infra-database`

Workflow **RDS - CI/CD**, input `TF_BUCKET_NAME` e `LAMBDA_SG_ID` **vazio** (a Lambda ainda não existe). Provisiona o RDS Postgres (~6 min).

Guarde o `DB_Endpoint` impresso no fim do log — ele muda a cada recriação do banco.

## Passo 4 — `oficina-app-api`

Workflow **CD - Deploy na AWS (EKS)**, input `rds_endpoint` com o valor do passo 3. Faz build da imagem, push no ECR e aplica os manifestos no EKS.

Depois, pegue o hostname do LoadBalancer (o workflow não imprime esse valor):

```bash
aws elb describe-load-balancers --query 'LoadBalancerDescriptions[*].DNSName' --output text
```

## Passo 5 — `oficina-auth-gateway`

Workflow **CD - Deploy do Auth Gateway (AWS)**, com:

- `TF_BUCKET_NAME` — o mesmo bucket
- `rds_endpoint` — do passo 3
- `app_api_base_url` — o hostname do passo 4

Guarde os dois outputs: `API_Gateway_URL` e `Lambda_Security_Group_Id`.

## Passo 6 — Reaplicar `oficina-infra-database`

Rode o workflow **RDS - CI/CD** de novo, agora com `LAMBDA_SG_ID` preenchido com o `Lambda_Security_Group_Id` do passo 5. Isso libera a porta 5432 do RDS para o Security Group da Lambda.

Esse vai-e-volta existe porque a dependência é circular: o banco precisa do SG da Lambda, e a Lambda precisa do endpoint do banco.

**Sem este passo o `auth-handler` sobe, mas todo `POST /auth` falha ao consultar o banco.**

## Verificação

```bash
API=<API_Gateway_URL>

curl -X POST "$API/auth" -H 'Content-Type: application/json' -d '{"cpf":"11111111111"}'
# 400 {"message":"CPF inválido"}

curl -X POST "$API/auth" -H 'Content-Type: application/json' -d '{"cpf":"12345678909"}'
# 404 {"message":"Cliente não encontrado"}

curl -X POST "$API/auth" -H 'Content-Type: application/json' -d '{"cpf":"52998224725"}'
# 200 {"token":"..."}   <- CPF semeado pelo DevDataLoader

curl "$API/app/actuator/health"
# 401 {"message":"Unauthorized"}   <- sem header, barrado antes do authorizer

curl "$API/app/actuator/health" -H 'Authorization: Bearer token.invalido'
# 403 {"message":"Forbidden"}      <- authorizer negou na borda
```

Um `403` em rota protegida **com token válido** é a limitação conhecida do `JWT_SECRET` compartilhado, descrita no [README](../README.md#limitação-conhecida-o-token-de-cliente-atravessa-até-a-oficina-app-api).

## Diagnóstico

Logs das Lambdas, pelo terminal do lab:

```bash
aws logs tail /aws/lambda/oficina-auth-handler --since 15m --format short
aws logs tail /aws/lambda/oficina-auth-authorizer --since 15m --format short
```
