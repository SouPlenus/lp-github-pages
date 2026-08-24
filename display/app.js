/* Painel de agendamentos de salas — SouPlenus
 * Consome a API admin da plataforma e exibe os agendamentos do dia atual.
 *
 * Endpoints usados:
 *   POST /login                 -> { data: { api_token } }
 *   GET  /room/all              -> lista de salas
 *   GET  /admin/schedule?room_id=&date_start=&date_end=
 *        -> { data: { rooms, schedule: [ { day, hours: [ { hour, schedule: [...] } ] } ] } }
 */

const CFG = window.DISPLAY_CONFIG;

/** Modo mock: sem chamadas de rede, usando os dados de mock.js. */
const USE_MOCK = CFG.useMock || new URLSearchParams(location.search).get('mock') === '1';

const state = {
  token: null,
  rooms: [],
  roomStep: 0,      // largura de um tile de sala, com margens (0 = não roda)
  roomCount: 0,     // quantas salas formam uma volta do rodízio
  roomIndex: 0,     // tile que está na primeira posição
  blocks: [],       // agendamentos já agrupados
  groups: [],       // { top, start, end, sep } de cada bloco de horário
  sepHeight: 40,    // altura da divisória presa no topo da lista
  lastUpdate: null,
  error: null,
};

/* ---------------------------------------------------------------- helpers */

const pad = (n) => String(n).padStart(2, '0');

/** Dia exibido. Aceita ?date=YYYY-MM-DD para testes/pré-visualização. */
function todayISO() {
  const forced = new URLSearchParams(location.search).get('date');
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** minutos desde a meia-noite para "HH:MM" ou "HH:MM:SS" */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fmtHour(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "1 minuto" / "25 minutos" / "2h30" / "2 horas" */
function tempoRestante(falta) {
  if (falta === 1) return '1 minuto';
  if (falta < 60) return `${falta} minutos`;

  const horas = Math.floor(falta / 60);
  const minutos = falta % 60;
  if (minutos) return `${horas}h${pad(minutos)}`;
  return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
}

/**
 * Conteúdo de uma divisória: à esquerda quando o bloco começa; à direita, só a
 * faixa de horário — "Daqui a 2h04 ——— 19:00–20:00".
 */
function slotLabel(start, now, end) {
  const faixa = `${fmtHour(start)}<span>–</span>${fmtHour(end || start + 60)}`;
  const falta = start - now;
  const titulo = falta <= 0
    ? 'Acontecendo agora'
    : `Daqui a ${tempoRestante(falta)}`;

  return `<span class="slot__rel">${titulo}</span>`
    + `<span class="slot__line"></span>`
    + `<span class="slot__hour">${faixa}</span>`;
}

/**
 * Nome que aparece no painel: para consultas o profissional está em
 * `professional.name`; para coworking o próprio `booked_for_name` é o
 * profissional que reservou a sala.
 */
function professionalName(item) {
  return (item.professional && item.professional.name) || item.booked_for_name || 'Agendamento';
}

function kindOf(item) {
  return item.source === 'coworking' ? 'coworking' : 'consulta';
}

/* -------------------------------------------------------------------- api */

async function apiGet(path) {
  const res = await fetch(CFG.apiBaseUrl + path, {
    headers: { Authorization: state.token, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function login() {
  if (USE_MOCK) {
    state.token = 'mock';
    return;
  }
  if (CFG.apiToken) {
    state.token = CFG.apiToken;
    return;
  }
  if (!CFG.email || !CFG.password) {
    throw new Error('Painel sem credenciais — configure com ?token=… na URL');
  }
  const res = await fetch(CFG.apiBaseUrl + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CFG.email, password: CFG.password }),
  });
  if (!res.ok) throw new Error(`Falha no login (${res.status})`);
  const json = await res.json();
  const token = json && json.data && json.data.api_token;
  if (!token) throw new Error('Login sem api_token na resposta');
  state.token = token;
}

/** Nomes exibidos no painel quando diferem do cadastro da plataforma. */
const ROOM_LABELS = {
  'sala incompany': 'Sala Vivência',
  'sala extra': 'Sala Vivência',
};

function roomLabel(title) {
  return ROOM_LABELS[String(title).trim().toLowerCase()] || title;
}

async function fetchRooms() {
  const json = USE_MOCK ? window.MOCK.rooms() : await apiGet('/room/all');
  return (json.data || []).map((r) => ({ id: r.id, title: roomLabel(r.title) }));
}

/** Busca a agenda de uma sala para o dia e devolve os slots ocupados. */
async function fetchRoomDay(room, dayISO) {
  const qs = `room_id=${room.id}&date_start=${dayISO}&date_end=${addDaysISO(dayISO, 1)}`;
  const json = USE_MOCK
    ? window.MOCK.schedule(room.id, dayISO)
    : await apiGet(`/admin/schedule?${qs}`);
  const days = (json.data && json.data.schedule) || [];
  const day = days.find((d) => d.day === dayISO) || days[0];
  if (!day) return [];

  const slots = [];
  for (const hour of day.hours || []) {
    for (const item of hour.schedule || []) {
      slots.push({
        room,
        // identificador da reserva: cada slot de 1h da API é um agendamento
        // próprio (inclusive nas séries de coworking), então dois horários
        // seguidos do mesmo profissional viram dois cards.
        uid: item.uid || (item.id != null ? `${item.source}-${item.id}` : null),
        start: toMinutes(hour.hour),
        end: toMinutes(hour.hour) + 60,
        name: professionalName(item),
        kind: kindOf(item),
        sourceLabel: item.source_label || '',
        recurring: !!item.is_recurring,
      });
    }
  }
  return slots;
}

/**
 * Une slots consecutivos que pertencem à MESMA reserva (mesmo uid) num único
 * bloco. Reservas distintas em horários seguidos — ex.: Josiane 10:00–11:00 e
 * 11:00–12:00, com pacientes diferentes — continuam como cards separados.
 */
function mergeSlots(slots) {
  const byKey = new Map();
  for (const s of slots) {
    const key = s.uid
      ? `${s.room.id}|${s.uid}`
      : `${s.room.id}|${s.name}|${s.kind}|${s.start}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }

  const blocks = [];
  for (const group of byKey.values()) {
    group.sort((a, b) => a.start - b.start);
    let cur = null;
    for (const s of group) {
      if (cur && s.start <= cur.end) {
        cur.end = Math.max(cur.end, s.end);
      } else {
        cur = { ...s };
        blocks.push(cur);
      }
    }
  }

  blocks.sort((a, b) => a.start - b.start || a.room.id - b.room.id);
  return blocks;
}

async function loadData() {
  if (!state.token) await login();

  if (!state.rooms.length) state.rooms = await fetchRooms();

  const day = todayISO();
  const perRoom = await Promise.all(state.rooms.map((r) => fetchRoomDay(r, day)));
  state.blocks = mergeSlots(perRoom.flat());
  state.lastUpdate = new Date();
  state.error = null;
}

/* ------------------------------------------------------------------ views */

const el = (sel) => document.querySelector(sel);

/** Hora corrente. Aceita ?now=HH:MM para pré-visualização. */
function nowMinutes() {
  const forced = new URLSearchParams(location.search).get('now');
  if (forced && /^\d{1,2}:\d{2}$/.test(forced)) return toMinutes(forced);
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function statusOf(block, now) {
  if (now >= block.end) return 'past';
  if (now >= block.start) return 'now';
  return 'next';
}

function renderClock() {
  const d = new Date();
  el('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // duas linhas: o dia da semana menor, em cima; a data embaixo. Juntas têm
  // a mesma altura do relógio ao lado.
  // "segunda-feira" vira "segunda"; sábado e domingo não têm o sufixo
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    .replace('-feira', '');
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  el('#date').innerHTML = `<span class="date__weekday">${semana},</span>`
    + `<span class="date__day">${dia}</span>`;
}

function renderRooms(now) {
  const wrap = el('#rooms');
  wrap.innerHTML = '';

  // todas as salas entram na faixa; as livres ficam apagadas
  for (const room of state.rooms) {
    const atual = state.blocks.find(
      (b) => b.room.id === room.id && now >= b.start && now < b.end);

    const card = document.createElement('div');
    card.className = 'room' + (atual ? '' : ' room--free');

    // em cima a sala e o estado, com o traço puxando até o profissional
    // embaixo; o nome fica numa faixa de uma linha só e, se não couber,
    // desliza (marquee)
    card.innerHTML = `
      <div class="room__top">
        <span class="room__title">${escapeHtml(room.title)}</span>
        <span class="room__dot"></span>
      </div>
      <div class="room__name">
        <span>${atual ? escapeHtml(atual.name) : 'Disponível agora'}</span>
      </div>`;
    wrap.appendChild(card);
  }

  // a faixa é dividida entre as salas, no máximo duas por tela: uma ocupa
  // tudo, duas ficam 50/50, três ou mais entram no rodízio horizontal
  const colunas = Math.min(wrap.children.length, 2) || 1;
  for (const tile of [].slice.call(wrap.children)) {
    tile.style.width = `${(100 / colunas).toFixed(4)}%`;
  }

  // sem ninguém em sala, a faixa sai da tela
  el('.rooms').hidden = !wrap.children.length;

  // cópia da faixa: quando o rodízio chega ao fim da volta, o que está na
  // tela são as cópias — aí a faixa volta ao começo sem ninguém perceber
  const cabe = wrap.scrollWidth <= wrap.clientWidth;
  state.roomCount = cabe ? 0 : wrap.children.length;
  if (!cabe) {
    const copia = [].slice.call(wrap.children).map((n) => n.cloneNode(true));
    for (const n of copia) {
      n.setAttribute('aria-hidden', 'true');
      wrap.appendChild(n);
    }
  }

  // passo do rodízio: distância entre um tile e o seguinte
  state.roomStep = wrap.children.length > 1
    ? wrap.children[1].offsetLeft - wrap.children[0].offsetLeft
    : 0;

  if (state.roomIndex >= state.roomCount) state.roomIndex = 0;
  placeRooms(wrap, false);

  markOverflowingNames(wrap);
}

/**
 * Nomes que não cabem na largura do tile ganham a animação de deslize; os que
 * cabem ficam parados. A distância percorrida vai num custom property.
 */
function markOverflowingNames(wrap) {
  requestAnimationFrame(() => {
    for (const box of wrap.querySelectorAll('.room__name')) {
      const text = box.firstElementChild;
      const over = text.scrollWidth - box.clientWidth;
      if (over > 2) {
        box.style.setProperty('--shift', `${-over}px`);
        box.classList.add('room__name--marquee');
      }
    }
  });
}

function renderList(now) {
  const list = el('#list');
  const keepScroll = list.scrollTop;   // não interrompe a rolagem automática
  list.innerHTML = '';

  // a lista mostra o que está acontecendo agora e o que ainda vai começar;
  // só os atendimentos já encerrados ficam de fora
  const doDia = state.blocks.filter((b) => b.end > now);

  if (!doDia.length) {
    const encerrado = state.blocks.length > 0;
    list.innerHTML = `<div class="empty">
        <div class="empty__title">${encerrado
          ? 'Nenhum agendamento a seguir'
          : 'Nenhum agendamento para hoje'}</div>
        <div class="empty__sub">${encerrado
          ? 'Não há mais horários marcados para hoje.'
          : 'As salas estão livres o dia todo.'}</div>
      </div>`;
    state.groups = [];
    return;
  }

  // uma faixa com todo o dia; o auto-scroll duplica esta faixa para o loop
  const track = document.createElement('div');
  track.className = 'loop';

  // agrupa por horário de início: cada grupo tem o separador (fixo no topo
  // enquanto rola) e os cards daquele horário
  let lastStart = null;
  let grid = null;

  for (const b of doDia) {
    const status = statusOf(b, now);

    if (b.start !== lastStart) {
      const group = document.createElement('div');
      group.className = 'slot-group';
      group.setAttribute('data-start', String(b.start));
      // fim do bloco: o maior fim entre os cards que começam neste horário
      const fim = doDia.reduce(
        (max, o) => (o.start === b.start && o.end > max ? o.end : max), b.end);
      group.setAttribute('data-end', String(fim));
      track.appendChild(group);

      // divisória que rola junto com os cards do bloco
      const sep = document.createElement('div');
      sep.className = 'slot';
      sep.innerHTML = slotLabel(b.start, now, fim);
      group.appendChild(sep);

      grid = document.createElement('div');
      grid.className = 'grid';
      group.appendChild(grid);

      lastStart = b.start;
    }

    const row = document.createElement('article');
    row.className = `card card--${status} card--${b.kind}`;
    row.innerHTML = `
      <div class="card__name">${escapeHtml(b.name)}</div>
      <span class="card__line"></span>
      <span class="card__room">${escapeHtml(b.room.title)}</span>`;
    grid.appendChild(row);
  }

  list.appendChild(track);

  // Loop infinito: se a lista não cabe na tela, uma segunda cópia idêntica é
  // colada logo abaixo. O auto-scroll rola até o fim da primeira cópia e volta
  // ao início — como as duas são iguais, a emenda não aparece.
  if (track.offsetHeight > list.clientHeight) {
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    list.appendChild(clone);
  }

  list.scrollTop = Math.min(keepScroll, Math.max(0, list.scrollHeight - list.clientHeight));

  indexGroups(list);
  pinSlots();
}

/**
 * Posição de cada bloco de horário dentro da rolagem, em coordenadas de
 * conteúdo (o primeiro bloco é o zero), junto com a sua divisória.
 * Recalculado a cada render.
 */
function indexGroups(list) {
  const groups = [].slice.call(list.querySelectorAll('.slot-group'));
  const base = groups.length ? groups[0].offsetTop : 0;
  state.groups = groups.map((g) => ({
    top: g.offsetTop - base,
    start: Number(g.getAttribute('data-start')),
    end: Number(g.getAttribute('data-end')),
    sep: g.querySelector('.slot'),
    desloc: 0,
    presa: false,
  }));

  const sep = list.querySelector('.slot-group .slot');
  state.sepHeight = (sep && sep.offsetHeight) || 40;
}

/**
 * Prende no topo da lista a divisória do bloco que está passando e deixa a
 * divisória do bloco seguinte empurrá-la para fora — o mesmo efeito do
 * `position: sticky`, feito com `top` em elemento `position: relative`, que
 * qualquer Chrome antigo entende.
 */
function pinSlots() {
  const scroll = el('#list').scrollTop;
  const h = state.sepHeight;

  for (let i = 0; i < state.groups.length; i++) {
    const g = state.groups[i];
    const proxima = state.groups[i + 1];

    // enquanto o bloco passa, a divisória acompanha a rolagem (fica no topo);
    // quando a próxima chega, ela para de acompanhar e é empurrada para cima
    const limite = proxima ? proxima.top - h - g.top : Infinity;
    const desloc = Math.max(0, Math.min(scroll - g.top, limite));

    if (desloc !== g.desloc) {
      g.sep.style.top = desloc ? `${desloc}px` : '';
      g.desloc = desloc;

      // a faixa extra embaixo só existe enquanto a divisória está presa
      const presa = desloc > 0;
      if (presa !== g.presa) {
        g.sep.className = presa ? 'slot slot--pinned' : 'slot';
        g.presa = presa;
      }
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * O painel não mostra a hora da última atualização; o status só aparece
 * quando algo falhou, que é a única informação útil para quem está na TV.
 */
function renderStatus() {
  const s = el('#status');
  s.hidden = !state.error;
  if (state.error) s.textContent = state.error;
}

function render() {
  const now = nowMinutes();
  renderClock();
  renderRooms(now);
  renderList(now);
  renderStatus();
}

/* -------------------------------------------------------- auto-scroll TV */

/** Posiciona a faixa de salas no tile atual, com ou sem animação. */
function placeRooms(wrap, animar) {
  const x = state.roomIndex * state.roomStep;
  wrap.style.transition = animar ? 'transform .7s ease' : 'none';
  wrap.style.transform = `translateX(${-x}px)`;
}

/**
 * Rodízio das salas: anda um tile de cada vez e, ao completar a volta, volta
 * ao começo sem animação — como o que está na tela são as cópias dos mesmos
 * tiles, o salto não aparece.
 */
function startRoomsScroll() {
  if (!CFG.autoScroll) return;
  const wrap = el('#rooms');

  setInterval(() => {
    if (!state.roomCount || !state.roomStep) return;

    state.roomIndex += 1;
    placeRooms(wrap, true);

    if (state.roomIndex >= state.roomCount) {
      setTimeout(() => {
        state.roomIndex = 0;
        placeRooms(wrap, false);
      }, 800);
    }
  }, 4000);
}

function startAutoScroll() {
  if (!CFG.autoScroll) return;
  const list = el('#list');
  let pausedUntil = Date.now() + 6000;   // pausa inicial no topo

  setInterval(() => {
    if (Date.now() < pausedUntil) return;

    // só há cópia (list.children[1]) quando a lista não cabe na tela
    const track = list.firstElementChild;
    if (!track || list.children.length < 2) return;

    const loopH = track.offsetHeight;
    if (loopH <= 8) return;

    let next = list.scrollTop + 1.2;
    if (next >= loopH) next -= loopH;   // emenda: o topo da cópia vira o novo topo
    list.scrollTop = next;

    pinSlots();
  }, 40);
}

/* ------------------------------------------------------------------- boot */

async function refresh() {
  try {
    await loadData();
  } catch (err) {
    // token pode ter expirado: tenta um novo login uma vez
    if (state.token && !CFG.apiToken) {
      state.token = null;
      try {
        await loadData();
      } catch (err2) {
        state.error = `Erro ao carregar: ${err2.message}`;
      }
    } else {
      state.error = `Erro ao carregar: ${err.message}`;
    }
  }
  render();
}

/* ------------------------------------------------------------------ login */

function hasCredentials() {
  return !!(CFG.apiToken || (CFG.email && CFG.password));
}

/** Valida e-mail/senha na API e guarda no dispositivo. */
async function signIn(email, password) {
  const res = await fetch(CFG.apiBaseUrl + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401 || res.status === 422) throw new Error('E-mail ou senha inválidos.');
  if (!res.ok) throw new Error(`Falha no login (${res.status}).`);

  const json = await res.json();
  const token = json && json.data && json.data.api_token;
  if (!token) throw new Error('Login sem api_token na resposta.');

  // guarda as credenciais (e não o token): assim o painel renova sozinho a
  // sessão quando o token expirar, sem ninguém precisar voltar na TV
  window.DISPLAY_AUTH.save({ email, password, apiToken: '' });
  state.token = token;
}

function setupLogin() {
  const box = el('#login');
  const form = el('#login-form');
  const erro = el('#login-error');
  const botao = el('#login-submit');

  box.hidden = false;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    erro.hidden = true;
    botao.disabled = true;
    botao.textContent = 'Entrando…';

    try {
      await signIn(el('#login-email').value.trim(), el('#login-password').value);
      box.hidden = true;
      await start();
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
}

/* ------------------------------------------------------------------- boot */

async function start() {
  await refresh();
  setInterval(refresh, CFG.refreshMs);
  setInterval(render, 30000);   // reavalia "em andamento" e o relógio
  startAutoScroll();
  startRoomsScroll();

  // vira o dia à meia-noite
  let currentDay = todayISO();
  setInterval(() => {
    if (todayISO() !== currentDay) {
      currentDay = todayISO();
      refresh();
    }
  }, 60000);
}

async function main() {
  render();
  setInterval(renderClock, 30000);   // relógio anda mesmo na tela de login

  // as fontes chegam depois do primeiro render: com a fonte de fallback os
  // textos têm outra largura, e é dela que saem a posição da linha das
  // divisórias e o deslize dos nomes longos
  if (window.document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => render());
  }

  if (!USE_MOCK && !hasCredentials()) {
    setupLogin();
    return;
  }
  await start();
}

main();
