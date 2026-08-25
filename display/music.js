/* Música de fundo tocando junto com o painel.
   O player fica numa faixa logo abaixo da tela: role para baixo para dar o
   play/ajustar o volume e para cima para sumir com ele — o som continua.
   Navegador nenhum libera áudio automático, então ele entra mudo e tira o
   mudo no primeiro clique/toque/tecla da página. */
(function () {
  var VIDEO_ID = 'obJbLSDsBAY';   // Billboard Hot 100 · Trending Songs 2026
  // se o vídeo principal sair do ar, o player tenta estes, na ordem
  var RESERVAS = ['56llPN9tS88', 'jfKfPfyJRdk'];
  var VOLUME   = 35;              // fundo, não trilha principal

  if (!document.getElementById('music')) return;

  var player = null;

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('music', {
      videoId: VIDEO_ID,
      // sem isto o YouTube recusa o embed ("Este vídeo não está disponível")
      // quando a API JS está ligada
      host: 'https://www.youtube.com',
      playerVars: {
        enablejsapi: 1,
        origin: window.location.origin,
        autoplay: 1,
        mute: 1,
        controls: 1,        // o player é visível: deixa o play e o volume à mão
        playsinline: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: function (e) {
          e.target.setVolume(VOLUME);
          e.target.playVideo();
          tentaSom();
        },
        // playlist longa, mas não infinita: no fim, começa de novo
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(0); e.target.playVideo(); }
        },
        // 2/5 = falha de player, 100/101/150 = vídeo fora do ar ou sem embed
        onError: function (e) {
          if (e.data === 101 || e.data === 150 || e.data === 100) {
            var proxima = RESERVAS.shift();
            if (proxima) { player.loadVideoById(proxima); return; }
          }
          setTimeout(function () {
            if (player) player.loadVideoById(VIDEO_ID);
          }, 15000);
        }
      }
    });
  };

  function tentaSom() {
    if (!player || !player.unMute) return;
    player.unMute();
    player.setVolume(VOLUME);
    player.playVideo();
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, tentaSom, { passive: true });
  });

  // a página fica ligada o dia inteiro: garante que o som não pare
  setInterval(function () {
    if (!player || !player.getPlayerState) return;
    // pausa feita à mão é respeitada; só volta se o vídeo parou sozinho
    var s = player.getPlayerState();
    if (s === YT.PlayerState.ENDED || s === -1) player.playVideo();
  }, 30000);

  /* A TV não tem toque nem rolagem fácil no controle: dois botões levam a
     página do painel ao player e de volta. O de descer some quando já
     estamos lá embaixo. */
  var strip = document.getElementById('music-strip');
  var jump  = document.getElementById('music-jump');
  var back  = document.getElementById('music-back');

  function rolaPara(y) {
    if (window.scrollTo) window.scrollTo(0, y);
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
  }

  if (jump && strip) jump.addEventListener('click', function () { rolaPara(strip.offsetTop); });
  if (back) back.addEventListener('click', function () { rolaPara(0); });

  window.addEventListener('scroll', function () {
    if (!jump) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    jump.style.opacity = y > 40 ? '0' : '1';
  });

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();
