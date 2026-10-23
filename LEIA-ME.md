# Next Step CRM

CRM da Next Step: funil de vendas, follow-ups, contatos e empresas, relatórios e equipe com login.
O site fica no GitHub Pages (grátis) e os dados ficam no Supabase (grátis), um banco de dados na nuvem com login.

Tempo total para colocar no ar: uns 20 minutos.

---

## Passo 1. Criar o banco de dados no Supabase

1. Entre em https://supabase.com e clique em **Start your project**. Entre com sua conta do GitHub.
2. Clique em **New project**.
   - Name: `nextstep-crm`
   - Database Password: clique em **Generate a password** e guarde essa senha num lugar seguro.
   - Region: **South America (São Paulo)**.
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu da esquerda, abra **SQL Editor**, clique em **New query**.
4. Abra o arquivo `supabase/schema.sql` desta pasta, copie tudo, cole no editor e clique em **Run**.
   Deve aparecer "Success. No rows returned".

## Passo 2. Ajustar o login

1. No menu da esquerda, abra **Authentication** > **URL Configuration** (ou **Sign In / Providers** > **URL Configuration**).
2. Em **Site URL**, coloque o endereço do CRM: `https://marcelodomingos-dev.github.io/nextstep-crm/`
3. Em **Redirect URLs**, adicione o mesmo endereço e clique em **Save**.

Isso faz os links de "confirmar e-mail" e "esqueci minha senha" abrirem o CRM.

## Passo 3. Pegar a URL e a chave pública

1. Abra **Project Settings** (engrenagem) > **API** (ou **Data API** e **API Keys**).
2. Copie:
   - **Project URL** (algo como `https://abcdefghijkl.supabase.co`)
   - a chave **anon public** (um texto longo que começa com `eyJ...`). Se aparecer "publishable key" (`sb_publishable_...`), pode usar essa.
3. Abra o arquivo `js/config.js` e cole os dois valores entre as aspas.

Nunca use a chave **service_role** ou **secret** no CRM. A chave anon pode ficar pública: quem protege os dados são as regras de segurança do `schema.sql`.

## Passo 4. Publicar no GitHub Pages

1. No GitHub, crie um repositório chamado `nextstep-crm` (público).
2. Envie todos os arquivos desta pasta para ele (o `index.html` precisa ficar na raiz).
3. No repositório, abra **Settings** > **Pages**. Em **Source** escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e clique em **Save**.
4. Em 1 a 2 minutos o CRM fica no ar em `https://marcelodomingos-dev.github.io/nextstep-crm/`.

## Passo 5. Primeiro acesso

1. Abra o CRM e clique em **Criar conta**. Use seu nome, e-mail e uma senha.
2. Confirme o e-mail pelo link que o Supabase enviar e entre.
3. **Donos**: o e-mail `stepnext.soluctions@gmail.com` está cadastrado como dono no `schema.sql`. Conta de dono entra sempre como admin, com acesso liberado, e ninguém consegue bloquear ou rebaixar. Para incluir outro sócio, acrescente o e-mail dele na lista `insert into public.donos` do `schema.sql` e rode o arquivo de novo no SQL Editor.
4. Enquanto não houver nenhum admin, a primeira conta criada também vira admin.

## Passo 6. Colocar a equipe

1. No CRM, abra a aba **Equipe**, cadastre o e-mail da pessoa e escolha o papel:
   - **Admin**: vê e edita tudo, exclui leads e gerencia a equipe.
   - **Vendedor**: vê e edita todos os leads, mas não exclui nem mexe na equipe.
2. Mande o link do CRM para a pessoa e peça para ela clicar em **Criar conta** com aquele mesmo e-mail.

Se alguém criar conta sem convite, a conta fica "aguardando liberação" e não vê nenhum lead. Você libera ou bloqueia na aba Equipe.

## Passo 7. Leads do site entrando sozinhos

O arquivo `site/trecho-quiz-site.js` tem o código e as instruções para o quiz do site mandar cada lead direto para o funil, como "Novo lead", com as respostas do diagnóstico na primeira anotação. Ele continua mandando para a planilha também, se ela estiver configurada.

O público só consegue **criar** leads por essa porta. Ninguém de fora consegue ler, editar ou apagar dados. Envios repetidos do mesmo contato em 10 minutos são ignorados, e há um limite de 60 leads do site por hora contra spam.

---

## Como usar no dia a dia

- **Funil**: arraste os cards entre as etapas (no celular, use a seta →). Ao mover para **Perdido**, o CRM pede o motivo. Ao mover para **Fechado**, grava a data do fechamento.
- **Follow-ups**: quem você precisa chamar hoje e quem está atrasado. **Feito** registra o contato no histórico e pede a próxima data.
- **Contatos e empresas**: busca, filtros, e visão agrupada por empresa. Importar e exportar CSV ficam aqui.
- **Relatórios**: valor fechado por mês, leads por origem, por etapa, faturamento por serviço e motivos de perda.
- **Só os meus leads**: mostra apenas os leads em que você é o responsável.
- Tudo é salvo na hora e aparece para a equipe em tempo real (a bolinha ao lado do seu nome fica verde quando o tempo real está conectado).

## Bom saber

- **E-mails de confirmação**: o Supabase grátis envia poucos e-mails por hora. Para uma equipe pequena isso basta. Se precisar de mais, configure um SMTP próprio em Authentication > Emails.
- **Backup**: use **Exportar CSV** de vez em quando. O Supabase grátis também pausa projetos sem nenhum acesso por 7 dias seguidos; basta abrir o CRM (ou o painel do Supabase) para ele voltar.
- **Importar CSV**: a primeira linha precisa ter os nomes das colunas (nome, empresa, email, whatsapp ou telefone, serviço, cidade, origem). Aceita vírgula ou ponto e vírgula.
- **Rodar o schema de novo** não apaga dados. Ele só recria as regras e funções.
