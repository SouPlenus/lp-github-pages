/**
 * Copie para `config.local.js` (ignorado pelo Git) quando for rodar o painel
 * numa máquina local. Em produção (GitHub Pages) este arquivo não existe: a TV
 * é configurada uma única vez pela URL, veja o README.
 */
window.DISPLAY_SECRETS = {
  // Opção 1 (preferida): token fixo de um usuário só-leitura.
  apiToken: '',

  // Opção 2: credenciais usadas em POST /login.
  email: '',
  password: '',
};
