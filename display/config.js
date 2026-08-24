/**
 * Configuração do painel de recepção.
 *
 * Este arquivo é público (vai para o GitHub Pages) e NÃO contém credenciais.
 * O acesso à API é resolvido em tempo de execução, nesta ordem:
 *
 *   1. window.DISPLAY_SECRETS, definido em `config.local.js` — arquivo fora do
 *      Git, usado quando o painel roda numa máquina local/rede interna;
 *   2. o que já estiver guardado no localStorage do próprio dispositivo;
 *   3. parâmetros na URL, usados UMA vez para configurar a TV:
 *        https://lp.souplenus.com.br/display/?token=SEU_TOKEN
 *        https://lp.souplenus.com.br/display/?email=painel@…&password=…
 *      Depois de lidos, são gravados no localStorage e apagados da barra de
 *      endereço, para não ficarem visíveis na tela nem no histórico.
 */
(function () {
  const AUTH_KEY = 'souplenus.display.auth';
  const qs = new URLSearchParams(location.search);

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
  } catch (err) {
    saved = {};
  }

  // credenciais vindas da URL sobrescrevem o que estiver guardado
  const fromUrl = {};
  if (qs.get('token')) fromUrl.apiToken = qs.get('token');
  if (qs.get('email')) fromUrl.email = qs.get('email');
  if (qs.get('password')) fromUrl.password = qs.get('password');

  if (Object.keys(fromUrl).length) {
    saved = Object.assign(saved, fromUrl);
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(saved));
    } catch (err) { /* modo anônimo: segue só com o valor em memória */ }

    ['token', 'email', 'password'].forEach((k) => qs.delete(k));
    const limpa = location.pathname + (qs.toString() ? `?${qs}` : '');
    history.replaceState(null, '', limpa);
  }

  const local = window.DISPLAY_SECRETS || {};

  window.DISPLAY_CONFIG = {
    // true = usa os dados de exemplo em mock.js, sem nenhuma chamada de rede.
    // Também dá para ligar pontualmente com ?mock=1 na URL.
    useMock: false,

    apiBaseUrl: 'https://prod-api.souplenus.com.br/api',

    // Token fixo (preferido) ou e-mail/senha de um usuário só-leitura.
    apiToken: local.apiToken || saved.apiToken || '',
    email: local.email || saved.email || '',
    password: local.password || saved.password || '',

    // Intervalo de atualização dos dados (ms).
    refreshMs: 60000,

    // Faixa de horas exibida na coluna "Salas agora" e na timeline.
    // (a API devolve slots de 07:00 às 20:00)
    dayStartHour: 7,
    dayEndHour: 21,

    // Rolagem automática da lista quando não couber na tela.
    autoScroll: true,
  };
})();
