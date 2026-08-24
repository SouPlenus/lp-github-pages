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
  blocks: [],       // agendamentos já agrupados
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
  'sala incompany': 'Sala Extra',
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
  el('#date').textContent = d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

function renderRooms(now) {
  const wrap = el('#rooms');
  wrap.innerHTML = '';

  for (const room of state.rooms) {
    // só interessa quem está na sala AGORA; sem ninguém, a sala está livre
    const blocks = state.blocks.filter((b) => b.room.id === room.id);
    const current = blocks.find((b) => now >= b.start && now < b.end);

    const card = document.createElement('div');
    card.className = 'room' + (current ? ' room--busy' : '');

    // o nome fica numa faixa de uma linha só; se não couber, desliza (marquee)
    const nome = current
      ? `<div class="room__name"><span>${escapeHtml(current.name)}</span></div>`
      : '<div class="room__name room__free"><span>Sala livre</span></div>';

    // em cima: sala; embaixo: profissional (ou "Sala livre")
    card.innerHTML = `
      <div class="room__top">
        <div class="room__title">${escapeHtml(room.title)}</div>
      </div>
      ${nome}`;
    wrap.appendChild(card);
  }

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

  // o dia inteiro: os já encerrados ficam esmaecidos (.card--past)
  const doDia = state.blocks;

  if (!doDia.length) {
    list.innerHTML = `<div class="empty">
        <div class="empty__title">Nenhum agendamento para hoje</div>
        <div class="empty__sub">As salas estão livres o dia todo.</div>
      </div>`;
    return;
  }

  // uma faixa com todo o dia; o auto-scroll duplica esta faixa para o loop
  const track = document.createElement('div');
  track.className = 'loop';

  // agrupa por horário de início: cada grupo é uma coluna de cards
  let lastStart = null;
  let grid = null;

  for (const b of doDia) {
    const status = statusOf(b, now);

    if (b.start !== lastStart) {
      const sep = document.createElement('div');
      sep.className = 'slot' + (status === 'past' ? ' slot--past' : '');
      sep.textContent = fmtHour(b.start);
      track.appendChild(sep);

      grid = document.createElement('div');
      grid.className = 'grid';
      track.appendChild(grid);

      lastStart = b.start;
    }

    const row = document.createElement('article');
    row.className = `card card--${status} card--${b.kind}`;
    row.innerHTML = `
      <div class="card__hours">${fmtHour(b.start)}<span>–</span>${fmtHour(b.end)}</div>
      <div class="card__name">${escapeHtml(b.name)}</div>
      <div class="card__room">${escapeHtml(b.room.title)}</div>`;
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
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderStatus() {
  const s = el('#status');
  if (state.error) {
    s.className = 'status status--error';
    s.textContent = state.error;
  } else if (state.lastUpdate) {
    s.className = 'status';
    const when = `${pad(state.lastUpdate.getHours())}:${pad(state.lastUpdate.getMinutes())}`;
    s.textContent = USE_MOCK ? `Dados de exemplo · ${when}` : `Atualizado às ${when}`;
  }
}

function render() {
  const now = nowMinutes();
  renderClock();
  renderRooms(now);
  renderList(now);
  renderStatus();
}

/* -------------------------------------------------------- auto-scroll TV */

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

async function main() {
  render();
  await refresh();
  setInterval(refresh, CFG.refreshMs);
  setInterval(render, 30000);   // reavalia "em andamento" e o relógio
  startAutoScroll();

  // vira o dia à meia-noite
  let currentDay = todayISO();
  setInterval(() => {
    if (todayISO() !== currentDay) {
      currentDay = todayISO();
      refresh();
    }
  }, 60000);
}

main();
