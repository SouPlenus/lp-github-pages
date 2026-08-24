# Painel de Salas — SouPlenus (TV da recepção)

Tela para exibir em uma TV na recepção com os agendamentos de salas **do dia atual**:
nome do profissional, horário e sala.

## Como rodar

Precisa ser servido por HTTP (não abra com `file://`, o navegador bloqueia o `fetch`):

```bash
cd display
python3 -m http.server 8080
```

Depois abra na TV: `http://<ip-da-maquina>:8080/` — de preferência em modo quiosque:

```bash
google-chrome --kiosk --incognito http://localhost:8080/
```

> Em quiosque **anônimo** o `localStorage` é descartado ao fechar; nesse caso use
> `config.local.js` ou mantenha o `?token=` na URL de inicialização.

Em produção o painel está em `https://lp.souplenus.com.br/display/`.

## Configuração

Ajustes não sensíveis ficam em [config.js](config.js) (`refreshMs`, `autoScroll`,
`apiBaseUrl`, `useMock`). **Credenciais não ficam no repositório** — o arquivo é
público no GitHub Pages.

O acesso é resolvido em tempo de execução, nesta ordem:

1. `config.local.js` (fora do Git) — para rodar em rede interna. Copie de
   [config.local.example.js](config.local.example.js) e preencha.
2. `localStorage` do próprio dispositivo.
3. Parâmetros na URL, usados **uma única vez** para configurar a TV:

```
https://lp.souplenus.com.br/display/?token=SEU_TOKEN
```

O token é gravado no `localStorage` daquele navegador e removido da barra de
endereço (`history.replaceState`), para não ficar visível na tela nem no
histórico. Da segunda vez em diante basta abrir a URL limpa.

Para obter um token:

```bash
curl -s -X POST https://prod-api.souplenus.com.br/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"painel@souplenus.com.br","password":"…"}' | jq -r .data.api_token
```

> **Importante:** por ser uma página estática, qualquer credencial que o painel
> use fica acessível a quem tiver acesso ao navegador da TV (DevTools) e trafega
> do próprio dispositivo. Use um usuário **dedicado e só de leitura**, nunca o
> admin. Se precisar de garantia real, o caminho é um proxy no backend que
> devolva só a agenda do dia, sem expor token nenhum ao cliente.

## API consumida

Base: `https://prod-api.souplenus.com.br/api`

- `POST /login` → `data.api_token`
- `GET /room/all` → lista de salas
- `GET /admin/schedule?room_id=<id>&date_start=<YYYY-MM-DD>&date_end=<+1 dia>`
  → `data.schedule[].hours[].schedule[]` (uma requisição por sala)

Cada item de agendamento tem duas formas:

- `source: "consultation"` → o profissional está em `professional.name`
  (`booked_for_name` é o **paciente**)
- `source: "coworking"` → o profissional é o próprio `booked_for_name`

O painel exibe apenas o nome do profissional. Nomes de pacientes **não** são
mostrados, por serem dado sensível numa tela pública.

Slots consecutivos do mesmo profissional na mesma sala são unidos em um único
card (ex.: 13:00–20:00 em vez de sete cards de 1h).

A API responde com `Access-Control-Allow-Origin: *`, por isso a página funciona
como HTML estático, sem backend intermediário.

## Visual

Tema institucional herdado do hero em `mockups/static`: fundo verde `#2b695b`,
destaques em peach `#ffbbaa`, tipografia **Visby CF** (arquivos em
`assets/fonts/`), logo branco e marca d'água do símbolo ao fundo.

O card do agendamento em curso fica branco, com selo "Em andamento".

## Desenvolvimento sem API

[mock.js](mock.js) traz uma agenda fictícia no **mesmo formato de resposta da API**,
cobrindo 07:00–20:00 nas 8 salas — em qualquer hora útil há algo "em andamento".
Nenhuma chamada de rede é feita (nem o login).

Ligue de duas formas:

- `useMock: true` em [config.js](config.js), ou
- `?mock=1` na URL, sem mexer no config

Nesse modo o rodapé do relógio mostra "Dados de exemplo". Para mudar a agenda,
edite a tabela `BOOKINGS` no topo do `mock.js`:

```js
{ room: 4, from: '13:00', hours: 7, pro: 'Daniele Behling de Mello', kind: 'coworking', fixo: true }
```

## Pré-visualizar

Parâmetros de query úteis para conferir o layout (domingos costumam estar vazios):

```
http://localhost:8080/?mock=1                     # dados de exemplo, sem API
http://localhost:8080/?date=2026-08-26            # força outro dia
http://localhost:8080/?mock=1&now=14:20           # força a hora corrente
```
