/* Dados de exemplo para desenvolvimento sem chamar a API.
 *
 * Ative com `useMock: true` em config.js, ou com `?mock=1` na URL.
 *
 * As funções abaixo devolvem exatamente o mesmo formato da API real, para que
 * o app.js exercite o mesmo caminho de parsing (professionalName, mergeSlots…).
 */

window.MOCK = (function () {
  const ROOMS = [
    { id: 1, title: 'Sala 1' },
    { id: 2, title: 'Sala 2' },
    { id: 3, title: 'Sala 3' },
    { id: 4, title: 'Sala 4' },
    { id: 5, title: 'Sala 5' },
    { id: 6, title: 'Sala 6' },
    { id: 7, title: 'Sala Plenus' },
    { id: 8, title: 'Sala InCompany' },
  ];

  /* Agenda fictícia cobrindo 07:00–20:00, para que em qualquer hora útil
   * exista algo "em andamento" na tela.
   *
   * room  = id da sala
   * from  = primeira hora ocupada
   * hours = quantos slots de 1h (viram um card único)
   * pro   = profissional
   * kind  = 'coworking' (reserva de sala) | 'consulta' (atendimento)
   * fixo  = reserva recorrente
   */
  const BOOKINGS = [
    { room: 3, from: '07:00', hours: 2, pro: 'Ana Paula Pereira Brayer',    kind: 'coworking', fixo: true },
    { room: 1, from: '08:00', hours: 1, pro: 'Cristina Sandrini Prestes',   kind: 'consulta' },
    { room: 5, from: '08:00', hours: 3, pro: 'Josiane Espanton',            kind: 'coworking', fixo: true },
    { room: 2, from: '09:00', hours: 1, pro: 'Gicelma Fossati Kaster',      kind: 'consulta' },
    { room: 7, from: '09:00', hours: 2, pro: 'Fabiana Lemos Goularte Dutra', kind: 'coworking' },
    { room: 1, from: '10:00', hours: 2, pro: 'Paloma Pirez Valério',        kind: 'consulta' },
    { room: 3, from: '10:00', hours: 1, pro: 'Júlia Madeira Soares',        kind: 'consulta' },
    { room: 6, from: '11:00', hours: 2, pro: 'Débora Ell Pereira',          kind: 'coworking', fixo: true },
    { room: 2, from: '11:00', hours: 1, pro: 'Larissa Tavares',             kind: 'consulta' },
    { room: 4, from: '13:00', hours: 7, pro: 'Daniele Behling de Mello',    kind: 'coworking', fixo: true },
    { room: 1, from: '13:00', hours: 2, pro: 'Marcelo Freda',               kind: 'coworking', fixo: true },
    { room: 3, from: '14:00', hours: 1, pro: 'Renata Muenzer',              kind: 'coworking', fixo: true },
    { room: 5, from: '14:00', hours: 1, pro: 'Thaís Garcia Sampaio',        kind: 'consulta' },
    { room: 1, from: '15:00', hours: 1, pro: 'Paloma Pirez Valério',        kind: 'consulta' },
    { room: 2, from: '16:00', hours: 2, pro: 'Laura Borba Vilanova Castelo', kind: 'consulta' },
    { room: 7, from: '16:00', hours: 3, pro: 'Pâmela Caldeira Moreira',     kind: 'coworking' },
    { room: 3, from: '17:00', hours: 1, pro: 'Cristina Sandrini Prestes',   kind: 'consulta' },
    { room: 6, from: '18:00', hours: 2, pro: 'Eduarda dos Santos Lopes',    kind: 'coworking', fixo: true },
    { room: 5, from: '19:00', hours: 1, pro: 'Marcelo Freda',               kind: 'consulta' },
  ];

  const pad = (n) => String(n).padStart(2, '0');

  /** Monta um item de agendamento no formato da API. */
  function item(b, roomTitle, dayISO, hour) {
    const consulta = b.kind === 'consulta';
    return {
      // como na API real, cada slot de 1h é uma reserva própria
      id: `mock-${b.room}-${hour.slice(0, 5)}`,
      uid: `mock-${b.room}-${hour.slice(0, 5)}`,
      type: consulta ? 'souplenus' : 'coworking',
      source: consulta ? 'consultation' : 'coworking',
      source_label: consulta ? 'Consulta + Coworking' : 'Coworking Recorrente',
      date: dayISO,
      time: hour.slice(0, 5),
      // em consultas o profissional vem em `professional`; em coworking o
      // próprio `booked_for_name` é o profissional que reservou a sala
      professional: consulta ? { id: 0, name: b.pro } : null,
      booked_for_name: consulta ? 'Paciente Exemplo' : b.pro,
      patient: consulta ? { id: 0, name: 'Paciente Exemplo' } : null,
      patient_name: null,
      contract_type: 'with_contract',
      room: { id: b.room, title: roomTitle },
      is_recurring: !!b.fixo,
    };
  }

  /** Mesma resposta de GET /admin/schedule?room_id=…&date_start=…&date_end=… */
  function schedule(roomId, dayISO) {
    const room = ROOMS.find((r) => r.id === roomId);
    const mine = BOOKINGS.filter((b) => b.room === roomId);

    const hours = [];
    for (let h = 7; h <= 20; h++) {
      const hour = `${pad(h)}:00:00`;
      const list = mine
        .filter((b) => {
          const start = Number(b.from.slice(0, 2));
          return h >= start && h < start + b.hours;
        })
        .map((b) => item(b, room.title, dayISO, hour));

      hours.push({ hour, available: list.length === 0, schedule: list });
    }

    return {
      status: 'ok',
      message: '',
      data: {
        rooms: ROOMS.map((r) => ({ ...r, type: null })),
        schedule: [{ day: dayISO, weekday: '3', is_today: true, is_weekend: false, hours }],
      },
      http_status: 200,
    };
  }

  /** Mesma resposta de GET /room/all */
  function rooms() {
    return {
      status: 'ok',
      message: '',
      data: ROOMS.map((r) => ({ ...r, is_available: 'Disponivel' })),
      http_status: 200,
    };
  }

  return { rooms, schedule };
})();
