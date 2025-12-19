(function () {
  const root = document.getElementById('classes-root');
  if (!root) return;

  const API_BASE = typeof API_URL !== 'undefined' ? API_URL : '/api';
  const API_EVENTS = `${API_BASE}/events`;
  const USER_ID_KEY = 'sd-user-id';

  function getUserId() {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = `user-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
  }

  const userId = getUserId();

  const state = {
    classes: [],
    editing: null,
    weekdays: new Set(),
    weekdaySlots: new Map(), // Map<weekdayIndex, Array<{start,end}>>
    startDate: '',
    endDate: '',
  };

  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function isoToLocalDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return new Date(NaN);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d);
  }

  function presencePercent(cls) {
    const total = Number(cls.totalClasses) || 0;
    const abs = Number(cls.absences) || 0;
    if (total <= 0) return 100;
    const pct = ((total - abs) / total) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  function renderEmpty() {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    const btn = document.createElement('button');
    btn.className = 'add-class-button';
    btn.innerHTML = `
      <img src="../../images/plus.svg" alt="Adicionar" />
      <span>Adicionar Aula</span>
    `;
    btn.addEventListener('click', () => openModal());
    wrap.appendChild(btn);
    root.appendChild(wrap);
  }

  function renderDaySummary(container) {
    const summary = document.createElement('div');
    summary.className = 'day-summary';
    const days = Array.from(state.weekdays).sort((a, b) => a - b);
    if (!days.length) {
      summary.textContent = 'Nenhum dia selecionado';
      container.innerHTML = '';
      container.appendChild(summary);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'day-summary-list';
    const range = state.startDate && state.endDate ? ` (${state.startDate} → ${state.endDate})` : '';
    days.forEach(d => {
      const raw = state.weekdaySlots.get(d);
      const slots = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const time = slots.length
        ? slots.map(s => `${s.start || '--:--'}-${s.end || '--:--'}`).join('; ')
        : 'Horário não definido';
      const li = document.createElement('li');
      li.textContent = `${WEEKDAYS[d]} ${time}${range}`;
      list.appendChild(li);
    });
    container.innerHTML = '';
    container.appendChild(list);
  }

  function renderList() {
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'classes-grid';

    state.classes.forEach((cls) => {
      const card = document.createElement('article');
      card.className = 'class-card';

      const header = document.createElement('header');
      header.innerHTML = `
        <span>${cls.name || 'Sem título'}</span>
        <button class="btn-delete" data-action="delete" title="Remover aula">
          <img src="../../images/trash.svg" alt="Remover" />
        </button>
      `;
      const deleteBtn = header.querySelector('[data-action="delete"]');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(cls);
      });
      card.appendChild(header);

      const meta = document.createElement('div');
      meta.className = 'class-meta';
      const days = (cls.days || []).join(', ');
      const presence = presencePercent(cls);

      // Compute start/end dates from scheduleByDay (ISO dates)
      let startDate = '';
      let endDate = '';
      if (Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
        startDate = cls.scheduleByDay.reduce((acc, s) => (!acc || s.date < acc ? s.date : acc), '');
        endDate = cls.scheduleByDay.reduce((acc, s) => (!acc || s.date > acc ? s.date : acc), '');
      }

      // Group time ranges by weekday and render lines per day
      let timesHtml = '-';
      if (Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
        const grouped = new Map(); // Map<weekdayIndex, Array<string>>
        cls.scheduleByDay.forEach((s) => {
          const d = isoToLocalDate(s.date);
          if (isNaN(d)) return;
          const dow = d.getDay();
          const slots = Array.isArray(s.slots) && s.slots.length ? s.slots : [{ start: s.start, end: s.end }];
          slots.forEach((sl) => {
            const a = sl?.start || '';
            const b = sl?.end || '';
            if (!(a || b)) return;
            const range = `${a || '--:--'}-${b || '--:--'}`;
            if (!grouped.has(dow)) grouped.set(dow, []);
            const arr = grouped.get(dow);
            if (!arr.includes(range)) arr.push(range); // dedupe per weekday
          });
        });
        const order = [0,1,2,3,4,5,6];
        const rows = [];
        order.forEach((dow) => {
          const list = grouped.get(dow);
          if (!list || !list.length) return;
          list.forEach((t, i) => {
            const dayLabel = i === 0 ? WEEKDAYS[dow] : '';
            rows.push(`<div class="times-row"><div class="wday">${dayLabel}</div><div class="time">${t}</div></div>`);
          });
        });
        timesHtml = rows.length ? `<div class="times-list">${rows.join('')}</div>` : '-';
      }

      meta.innerHTML = `
        <div><div class="label">Dias</div><div>${days || '-'}</div></div>
        <div class="horarios-cell"><div class="label">Horários</div>${timesHtml}</div>
        <div><div class="label">Data início</div><div>${startDate || '-'}</div></div>
        <div><div class="label">Data fim</div><div>${endDate || '-'}</div></div>
        <div><div class="label">Nota média</div><div>${cls.averageGrade ?? '-'}</div></div>
        <div><div class="label">Presença</div><div class="presence">${presence}%</div></div>
      `;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'class-actions';
      const edit = document.createElement('button');
      edit.className = 'btn ghost';
      edit.textContent = 'Configurar';
      edit.addEventListener('click', () => openModal(cls));

      const addAbs = document.createElement('button');
      addAbs.className = 'btn primary';
      addAbs.textContent = 'Adicionar falta';
      addAbs.addEventListener('click', () => incrementAbsence(cls));

      actions.append(edit, addAbs);
      card.appendChild(actions);

      grid.appendChild(card);
    });

    // Add tile: shows after existing cards and follows the grid placement rules
    const addTile = document.createElement('button');
    addTile.className = 'add-class-button';
    addTile.innerHTML = `
      <img src="../../images/plus.svg" alt="Adicionar" />
      <span>Adicionar Aula</span>
    `;
    addTile.addEventListener('click', () => openModal());
    grid.appendChild(addTile);

    root.appendChild(grid);
  }

  function render() {
    if (!state.classes || state.classes.length === 0) {
      renderEmpty();
    } else {
      renderList();
    }
  }

  function closeModal() {
    const m = document.querySelector('.modal-backdrop');
    if (m) m.remove();
  }

  async function loadClassEvents(classId, container) {
    try {
      const events = await apiEvents('', { method: 'GET' });
      let classEvents = events.filter(e => e.classId === classId);
      
      // Ordenar por data (mais recente primeiro)
      classEvents.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date('2099-12-31');
        const dateB = b.date ? new Date(b.date) : new Date('2099-12-31');
        return dateA - dateB;
      });
      
      if (classEvents.length === 0) {
        container.innerHTML = '<p class="hint">Nenhum evento cadastrado</p>';
        return;
      }

      container.innerHTML = '';
      classEvents.forEach(event => {
        const eventEl = document.createElement('div');
        eventEl.className = 'event-card';
        
        const color = event.color || 'red-alert';
        const colorClass = `event-${color}`;
        eventEl.classList.add(colorClass);
        
        const dateStr = event.date ? new Date(event.date).toLocaleDateString('pt-BR') : '';
        const timeStr = event.time || '';
        
        eventEl.innerHTML = `
          <div class="event-header">
            <div class="event-name">${event.name}</div>
            <button type="button" class="btn-delete-event" data-event-id="${event.eventId}" title="Remover evento">×</button>
          </div>
          <div class="event-meta">
            ${dateStr ? `<div class="event-date"><img src="../../images/calendar.svg" alt="data" class="event-icon"> ${dateStr}</div>` : ''}
            ${timeStr ? `<div class="event-time"><img src="../../images/clock.svg" alt="horário" class="event-icon"> ${timeStr}</div>` : ''}
          </div>
        `;
        
        const deleteBtn = eventEl.querySelector('.btn-delete-event');
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Deseja remover o evento "${event.name}"?`)) {
            try {
              await apiEvents(`/${event.eventId}`, { method: 'DELETE' });
              loadClassEvents(classId, container);
            } catch (err) {
              console.error('Erro ao deletar evento', err);
              alert('Erro ao deletar evento');
            }
          }
        });
        
        container.appendChild(eventEl);
      });
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
      container.innerHTML = '<p class="hint error">Erro ao carregar eventos</p>';
    }
  }

  function openModal(cls = null) {
    state.editing = cls;
    state.weekdays = new Set();
    state.weekdaySlots = new Map();
    state.startDate = '';
    state.endDate = '';
    if (cls?.scheduleByDay && Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
      const sorted = [...cls.scheduleByDay].sort((a, b) => a.date.localeCompare(b.date));
      state.startDate = sorted[0].date;
      state.endDate = sorted[sorted.length - 1].date;
      const tmp = new Map(); // Map<dow, Array<{start,end}>>
      sorted.forEach(s => {
        const d = isoToLocalDate(s.date);
        const dow = d.getDay();
        state.weekdays.add(dow);
        const slots = Array.isArray(s.slots) && s.slots.length ? s.slots : [{ start: s.start, end: s.end }];
        const arr = tmp.get(dow) || [];
        slots.forEach(sl => {
          const a = sl?.start || '';
          const b = sl?.end || '';
          const key = `${a}|${b}`;
          if (!arr.some(x => `${x.start||''}|${x.end||''}` === key)) arr.push({ start: a, end: b });
        });
        tmp.set(dow, arr);
      });
      tmp.forEach((arr, dow) => state.weekdaySlots.set(dow, arr));
    } else if (cls?.days) {
      cls.days.forEach(label => {
        const idx = WEEKDAYS.indexOf(label);
        if (idx >= 0) {
          state.weekdays.add(idx);
          state.weekdaySlots.set(idx, [{ start: '', end: '' }]);
        }
      });
    }
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h3>${cls ? 'Editar Aula' : 'Nova Aula'}</h3>
        <div class="modal-body">
          <form id="class-form">
            <div class="form-grid">
              <div class="field">
                <label>Nome da matéria *</label>
                <input name="name" required value="${cls?.name || ''}">
              </div>
              <div class="field">
                <label>Dias da semana</label>
                <div class="weekday-pills" data-role="weekday-pills"></div>
                <div class="day-summary" data-role="day-summary"></div>
              </div>
              <div class="field">
                <label>Data de início</label>
                <input name="startDate" type="text" readonly placeholder="Selecionar" data-action="pick-start" value="${cls?.scheduleByDay?.[0]?.date || ''}">
              </div>
              <div class="field">
                <label>Data de término</label>
                <input name="endDate" type="text" readonly placeholder="Selecionar" data-action="pick-end" value="${cls?.scheduleByDay?.slice(-1)?.[0]?.date || ''}">
              </div>
              <div class="field">
                <label>Imagem (URL)</label>
                <input name="imageUrl" value="${cls?.imageUrl || ''}">
              </div>
              <div class="field">
                <label>Nº de aulas previstas</label>
                <input name="totalClasses" type="number" min="0" value="${cls?.totalClasses ?? ''}">
              </div>
              <div class="field">
                <label>Controle de presença</label>
                <select name="presenceMode" data-role="presence-mode">
                  <option value="maxAbsences" ${!cls || cls.maxAbsences !== null ? 'selected' : ''}>Faltas máximas</option>
                  <option value="minPresence" ${cls?.minPresence !== null && cls?.maxAbsences === null ? 'selected' : ''}>% presença mínima</option>
                </select>
              </div>
              <div class="field" data-role="maxAbsences-field">
                <label>Faltas máximas</label>
                <input name="maxAbsences" type="number" min="0" value="${cls?.maxAbsences ?? ''}">
              </div>
              <div class="field" data-role="minPresence-field" style="display: none;">
                <label>% presença mínima</label>
                <input name="minPresence" type="number" min="0" max="100" value="${cls?.minPresence ?? ''}">
              </div>
            </div>
            <div class="form-grid full">
              <div class="field">
                <label>Eventos / provas</label>
                <div class="events-list" data-role="events-list"></div>
                <p class="hint">Cadastre eventos no botão abaixo.</p>
                <button type="button" class="btn" data-action="add-event" ${cls ? '' : 'disabled'}>Adicionar evento</button>
                ${cls ? '' : '<p class="hint">Salve a aula antes de adicionar eventos.</p'}
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn ghost" data-action="cancel">Cancelar</button>
              <button type="submit" class="btn primary">${cls ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const form = modal.querySelector('#class-form');
    const cancel = modal.querySelector('[data-action="cancel"]');
    const summaryEl = modal.querySelector('[data-role="day-summary"]');
    const pillsEl = modal.querySelector('[data-role="weekday-pills"]');
    const startInput = modal.querySelector('[data-action="pick-start"]');
    const endInput = modal.querySelector('[data-action="pick-end"]');
    const addEventBtn = modal.querySelector('[data-action="add-event"]');
    const presenceModeSelect = modal.querySelector('[data-role="presence-mode"]');
    const eventsListEl = modal.querySelector('[data-role="events-list"]');

    // Load and render events for this class
    if (cls && eventsListEl) {
      loadClassEvents(cls.classId, eventsListEl);
    }
    const maxAbsField = modal.querySelector('[data-role="maxAbsences-field"]');
    const minPresField = modal.querySelector('[data-role="minPresence-field"]');

    function updatePresenceFields() {
      const mode = presenceModeSelect.value;
      if (mode === 'maxAbsences') {
        maxAbsField.style.display = '';
        minPresField.style.display = 'none';
      } else {
        maxAbsField.style.display = 'none';
        minPresField.style.display = '';
      }
    }
    updatePresenceFields();
    presenceModeSelect.addEventListener('change', updatePresenceFields);

    renderWeekdayPills(pillsEl, summaryEl);
    renderDaySummary(summaryEl);
    startInput.addEventListener('click', () => openDatePicker(startInput, 'start'));
    endInput.addEventListener('click', () => openDatePicker(endInput, 'end'));
    if (addEventBtn && cls) {
      addEventBtn.addEventListener('click', () => openEventModal(cls));
    }
    cancel.addEventListener('click', closeModal);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      if (!state.startDate || !state.endDate) {
        alert('Selecione datas de início e término');
        return;
      }
      if (!state.weekdays.size) {
        alert('Selecione pelo menos um dia da semana');
        return;
      }
      const scheduleByDay = buildScheduleRange();
      const mode = formData.get('presenceMode');
      const payload = {
        name: formData.get('name'),
          days: Array.from(state.weekdays).sort((a,b)=>a-b).map(i => WEEKDAYS[i]),
          scheduleByDay,
        imageUrl: formData.get('imageUrl') || '',
        totalClasses: formData.get('totalClasses'),
        maxAbsences: mode === 'maxAbsences' ? formData.get('maxAbsences') : null,
        minPresence: mode === 'minPresence' ? formData.get('minPresence') : null,
        events: (formData.get('events') || '').split(',').map(s => s.trim()).filter(Boolean),
        absences: cls?.absences || 0,
      };

      try {
        if (cls) {
          await updateClass(cls.classId, payload);
        } else {
          await createClass(payload);
        }
        closeModal();
        await loadClasses();
      } catch (err) {
        console.error('Erro ao salvar aula', err);
        alert('Erro ao salvar aula');
      }
    });
  }

  function formatSchedule(cls) {
    if (cls.scheduleByDay && Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
      return cls.scheduleByDay
        .map(s => {
          const slots = Array.isArray(s.slots) && s.slots.length ? s.slots : [{ start: s.start, end: s.end }];
          const hasAnyTime = slots.some(sl => (sl.start && sl.start.length) || (sl.end && sl.end.length));
          const times = slots.map(sl => `${sl.start || '--:--'}-${sl.end || '--:--'}`).join('; ');
          return `${s.date}${hasAnyTime ? ` (${times})` : ''}`;
        })
        .join(', ');
    }
    return cls.schedule || '';
  }

  function renderWeekdayPills(container, summaryEl) {
    container.innerHTML = '';
    WEEKDAYS.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'weekday-pill' + (state.weekdays.has(idx) ? ' is-active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (state.weekdays.has(idx)) {
          state.weekdays.delete(idx);
          state.weekdaySlots.delete(idx);
        } else {
          state.weekdays.add(idx);
          if (!state.weekdaySlots.has(idx)) state.weekdaySlots.set(idx, [{ start: '', end: '' }]);
        }
        renderWeekdayPills(container, summaryEl);
        renderDaySummary(summaryEl);
      });
      container.appendChild(btn);
    });

    // Time inputs per selected weekday
    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'weekday-slots';
    const entries = Array.from(state.weekdays).sort((a, b) => a - b);
    entries.forEach(idx => {
      const stored = state.weekdaySlots.get(idx);
      const daySlots = Array.isArray(stored) ? stored : stored ? [stored] : [{ start: '', end: '' }];
      daySlots.forEach((slot, slotIdx) => {
        const row = document.createElement('div');
        row.className = 'slot-row';
        row.innerHTML = `
          <div class="slot-date">${WEEKDAYS[idx]} ${daySlots.length > 1 ? `#${slotIdx + 1}` : ''}</div>
          <input type="time" value="${slot.start || ''}" data-idx="${idx}" data-slot="${slotIdx}" data-field="start">
          <input type="time" value="${slot.end || ''}" data-idx="${idx}" data-slot="${slotIdx}" data-field="end">
          <button type="button" class="btn ghost remove-slot" data-action="remove-slot" data-idx="${idx}" data-slot="${slotIdx}" title="Remover horário">×</button>
        `;
        slotsWrap.appendChild(row);
      });
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn ghost';
      addBtn.textContent = 'Adicionar horário';
      addBtn.addEventListener('click', () => {
        const arr = state.weekdaySlots.get(idx) || [];
        arr.push({ start: '', end: '' });
        state.weekdaySlots.set(idx, arr);
        renderWeekdayPills(container, summaryEl);
        renderDaySummary(summaryEl);
      });
      slotsWrap.appendChild(addBtn);
    });
    container.appendChild(slotsWrap);

    container.querySelectorAll('input[type="time"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.idx);
        const slotIdx = Number(e.target.dataset.slot);
        const field = e.target.dataset.field;
        const cur = state.weekdaySlots.get(idx) || [];
        const arr = Array.isArray(cur) ? cur : [cur];
        arr[slotIdx] = { ...arr[slotIdx], [field]: e.target.value };
        state.weekdaySlots.set(idx, arr);
        renderDaySummary(summaryEl);
      });
    });

    container.querySelectorAll('[data-action="remove-slot"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        const slotIdx = Number(e.currentTarget.dataset.slot);
        const cur = state.weekdaySlots.get(idx) || [];
        const arr = Array.isArray(cur) ? [...cur] : [cur];
        if (slotIdx >= 0 && slotIdx < arr.length) {
          arr.splice(slotIdx, 1);
        }
        if (arr.length === 0) {
          state.weekdays.delete(idx);
          state.weekdaySlots.delete(idx);
        } else {
          state.weekdaySlots.set(idx, arr);
        }
        renderWeekdayPills(container, summaryEl);
        renderDaySummary(summaryEl);
      });
    });
  }

  function openDatePicker(targetInput, which) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal day-picker-modal';

    const now = new Date();
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);

    function renderCalendar() {
      modal.innerHTML = '';
      const header = document.createElement('div');
      header.className = 'day-picker-header';
      const prev = document.createElement('button');
      prev.className = 'btn ghost';
      prev.textContent = '<';
      const next = document.createElement('button');
      next.className = 'btn ghost';
      next.textContent = '>';
      const title = document.createElement('div');
      title.textContent = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      header.append(prev, title, next);

      const grid = document.createElement('div');
      grid.className = 'calendar-grid';
      const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      headers.forEach(h => {
        const el = document.createElement('div');
        el.className = 'weekday';
        el.textContent = h;
        grid.appendChild(el);
      });

      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const offset = first.getDay();
      for (let i = 0; i < offset; i++) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        grid.appendChild(empty);
      }
      for (let d = 1; d <= last.getDate(); d++) {
        const date = new Date(y, m, d);
        const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const btn = document.createElement('button');
        btn.className = 'day-btn';
        btn.textContent = String(d);
        btn.addEventListener('click', () => {
          if (which === 'start') state.startDate = iso; else state.endDate = iso;
          targetInput.value = iso;
          backdrop.remove();
        });
        grid.appendChild(btn);
      }

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = 'Cancelar';
      actions.append(cancel);

      modal.append(header, grid, actions);

      prev.addEventListener('click', () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        renderCalendar();
      });
      next.addEventListener('click', () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        renderCalendar();
      });
      cancel.addEventListener('click', () => backdrop.remove());
    }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    renderCalendar();
  }

  function buildScheduleRange() {
    const start = isoToLocalDate(state.startDate);
    const end = isoToLocalDate(state.endDate);
    if (isNaN(start) || isNaN(end) || end < start) return [];
    const res = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (state.weekdays.has(dow)) {
        const raw = state.weekdaySlots.get(dow);
        const slots = Array.isArray(raw) ? raw : raw ? [raw] : [{ start: '', end: '' }];
        const iso = d.toISOString().slice(0, 10);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        res.push({ date: dateStr, start: slots[0]?.start || '', end: slots[0]?.end || '', slots: slots.map(s => ({ start: s.start || '', end: s.end || '' })) });
      }
    }
    return res;
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}/classes${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let errorMsg = `Erro API: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg += ` - ${errorData.error}`;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function apiEvents(path, options = {}) {
    const res = await fetch(`${API_EVENTS}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let errorMsg = `Erro API: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg += ` - ${errorData.error}`;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    if (res.status === 204) {
      return null;
    }
    return res.json();
  }

  async function loadClasses() {
    const data = await api('', { method: 'GET' });
    state.classes = data;
    render();
  }

  async function createClass(payload) {
    return api('', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async function updateClass(id, payload) {
    return api(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async function incrementAbsence(cls) {
    const abs = (cls.absences || 0) + 1;
    try {
      await updateClass(cls.classId, { ...cls, absences: abs });
      await loadClasses();
    } catch (err) {
      console.error('Erro ao adicionar falta', err);
      alert('Erro ao adicionar falta');
    }
  }

  function confirmDelete(cls) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';
    modal.innerHTML = `
      <h3>Confirmar exclusão</h3>
      <div class="modal-body">
        <p>Tem certeza que deseja remover a aula <strong>${cls.name || 'Sem título'}</strong>?</p>
        <p class="hint">Esta ação não pode ser desfeita.</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="cancel">Cancelar</button>
        <button type="button" class="btn primary" data-action="confirm">Remover</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    const cancel = modal.querySelector('[data-action="cancel"]');
    const confirm = modal.querySelector('[data-action="confirm"]');

    cancel.addEventListener('click', () => backdrop.remove());
    confirm.addEventListener('click', async () => {
      try {
        await deleteClass(cls.classId);
        backdrop.remove();
        await loadClasses();
      } catch (err) {
        console.error('Erro ao remover aula', err);
        alert('Erro ao remover aula');
      }
    });
  }

  async function deleteClass(classId) {
    return api(`/${classId}`, {
      method: 'DELETE',
    });
  }

  function openEventModal(cls) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
     modal.className = 'modal event-modal';
    modal.innerHTML = `
      <h3>Novo evento para ${cls.name || 'Aula'}</h3>
      <div class="modal-body">
        <form id="event-form">
          <div class="form-grid">
            <div class="field">
              <label>Nome *</label>
              <input name="name" required>
            </div>
            <div class="field">
              <label>Peso da nota</label>
              <input name="weight" type="number" step="0.01" min="0">
            </div>
            <div class="field">
              <label>Nota obtida</label>
              <input name="grade" type="number" step="0.01" min="0">
            </div>
            <div class="field">
              <label>Data</label>
              <input name="date" type="date" required>
            </div>
            <div class="field">
              <label>Horário</label>
              <input name="time" type="time">
            </div>
            <div class="field">
              <label>Cor do evento</label>
              <div class="color-picker">
                <button type="button" class="color-option" data-color="red-alert" style="background: var(--red-alert);" title="Vermelho" data-action="pick-color"></button>
                <button type="button" class="color-option" data-color="blue-alert" style="background: var(--blue-alert);" title="Azul" data-action="pick-color"></button>
                <button type="button" class="color-option" data-color="green-alert" style="background: var(--green-alert);" title="Verde" data-action="pick-color"></button>
              </div>
            </div>
            <input name="color" type="hidden" value="red-alert">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn ghost" data-action="cancel">Cancelar</button>
            <button type="submit" class="btn primary">Salvar evento</button>
          </div>
        </form>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    const form = modal.querySelector('#event-form');
    const cancel = modal.querySelector('[data-action="cancel"]');
    const colorInput = modal.querySelector('input[name="color"]');
    const colorOptions = modal.querySelectorAll('[data-action="pick-color"]');

    colorOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = e.currentTarget.dataset.color;
        colorInput.value = color;
        colorOptions.forEach(b => b.style.border = '');
        e.currentTarget.style.border = '2px solid #111';
      });
    });
    colorOptions[0].style.border = '2px solid #111';

    cancel.addEventListener('click', () => backdrop.remove());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        classId: cls.classId,
        name: fd.get('name'),
        weight: fd.get('weight'),
        grade: fd.get('grade'),
        date: fd.get('date'),
        time: fd.get('time'),
        color: fd.get('color'),
      };
      try {
        await apiEvents('', { method: 'POST', body: JSON.stringify(payload) });
        backdrop.remove();
        const eventsListEl = document.querySelector('[data-role="events-list"]');
        if (eventsListEl) {
          await loadClassEvents(cls.classId, eventsListEl);
        }
      } catch (err) {
        console.error('Erro ao criar evento', err);
        alert('Erro ao criar evento');
      }
    });
  }

  loadClasses().catch((err) => {
    console.error('Erro ao carregar aulas', err);
    renderEmpty();
  });
})();
