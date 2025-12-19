(function () {
  const root = document.getElementById('classes-root');
  if (!root) return;

  const API_BASE = typeof API_URL !== 'undefined' ? API_URL : '/api';
  const API_EVENTS = `${API_BASE}/events`;
  const userId = (window.SessionManager && window.SessionManager.getOrCreateUserId())
    || (() => {
      const key = 'sd-user-id';
      let uid = localStorage.getItem(key);
      if (!uid) {
        uid = `user-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(key, uid);
      }
      return uid;
    })();

  const state = {
    classes: [],
    editing: null,
    weekdays: new Set(),
    weekdaySlots: new Map(),
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

      let startDate = '';
      let endDate = '';
      if (Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
        startDate = cls.scheduleByDay.reduce((acc, s) => (!acc || s.date < acc ? s.date : acc), '');
        endDate = cls.scheduleByDay.reduce((acc, s) => (!acc || s.date > acc ? s.date : acc), '');
      }

      let timesHtml = '-';
      if (Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
        const grouped = new Map();
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
            if (!arr.includes(range)) arr.push(range);
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
      
      classEvents.sort((a, b) => {
        const dateA = new Date(a.date + 'T' + (a.time || '00:00'));
        const dateB = new Date(b.date + 'T' + (b.time || '00:00'));
        if (!a.date) return 1;
        if (!b.date) return -1;
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
        
        const dateStr = event.date ? isoToLocalDate(event.date).toLocaleDateString('pt-BR') : '';
        const timeStr = event.time || '';
        
        eventEl.innerHTML = `
          <div class="event-header">
            <div class="event-name">${event.name}</div>
            <div class="event-actions">
              <button type="button" class="btn-edit-event" data-event-id="${event.eventId}" title="Editar evento">
                <img src="../../images/edit.svg" alt="Editar" />
              </button>
              <button type="button" class="btn-delete-event" data-event-id="${event.eventId}" title="Remover evento">
                <img src="../../images/trash.svg" alt="Remover" />
              </button>
            </div>
          </div>
          <div class="event-meta">
            ${dateStr ? `<div class="event-date"><img src="../../images/calendar.svg" alt="data" class="event-icon"> ${dateStr}</div>` : ''}
            ${timeStr ? `<div class="event-time"><img src="../../images/clock.svg" alt="horário" class="event-icon"> ${timeStr}</div>` : ''}
          </div>
        `;
        
        const editBtn = eventEl.querySelector('.btn-edit-event');
        editBtn.addEventListener('click', () => {
          openEditClassEventModal(event, classId, container);
        });
        
        const deleteBtn = eventEl.querySelector('.btn-delete-event');
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Deseja remover o evento "${event.name}"?`)) {
            try {
              await apiEvents(`/${event.eventId}`, { method: 'DELETE' });
              loadClassEvents(classId, container);
              try { await computeClassAverages(); } catch {}
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
    if (!cls) {
      state.draftEvents = [];
    }
    if (cls?.scheduleByDay && Array.isArray(cls.scheduleByDay) && cls.scheduleByDay.length) {
      const sorted = [...cls.scheduleByDay].sort((a, b) => a.date.localeCompare(b.date));
      state.startDate = sorted[0].date;
      state.endDate = sorted[sorted.length - 1].date;
      const tmp = new Map();
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
                <input name="startDate" type="date" value="${cls?.scheduleByDay?.[0]?.date || ''}">
              </div>
              <div class="field">
                <label>Data de término</label>
                <input name="endDate" type="date" value="${cls?.scheduleByDay?.slice(-1)?.[0]?.date || ''}">
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
                <button type="button" class="btn" data-action="add-event">Adicionar evento</button>
                ${cls ? '' : '<p class="hint">Os eventos serão vinculados quando a aula for criada.</p>'}
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
    const startInput = modal.querySelector('input[name="startDate"]');
    const endInput = modal.querySelector('input[name="endDate"]');
    const addEventBtn = modal.querySelector('[data-action="add-event"]');
    const presenceModeSelect = modal.querySelector('[data-role="presence-mode"]');
    const eventsListEl = modal.querySelector('[data-role="events-list"]');

    if (eventsListEl) {
      if (cls) {
        loadClassEvents(cls.classId, eventsListEl);
      } else {
        renderDraftEvents(eventsListEl);
      }
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
    startInput.addEventListener('change', (e) => { state.startDate = e.target.value; renderDaySummary(summaryEl); });
    endInput.addEventListener('change', (e) => { state.endDate = e.target.value; renderDaySummary(summaryEl); });
    if (addEventBtn) {
      addEventBtn.addEventListener('click', () => {
        if (cls) openEventModal(cls); else openDraftEventModal();
      });
    }
    cancel.addEventListener('click', closeModal);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      if (!state.startDate || !state.endDate) {
        alert('Selecione datas de início e término');
        return;
      }
      const dStart = isoToLocalDate(state.startDate);
      const dEnd = isoToLocalDate(state.endDate);
      if (isNaN(dStart) || isNaN(dEnd)) {
        alert('Datas inválidas. Selecione novamente.');
        return;
      }
      if (dEnd < dStart) {
        alert('A data de término deve ser posterior à data de início');
        return;
      }
      if (!state.weekdays.size) {
        alert('Selecione pelo menos um dia da semana');
        return;
      }
      const scheduleByDay = buildScheduleRange();
      if (!Array.isArray(scheduleByDay) || scheduleByDay.length === 0) {
        alert('Nenhum dia do período coincide com os dias selecionados. Ajuste as datas e os dias da semana.');
        return;
      }
      const mode = formData.get('presenceMode');
      const payload = {
        name: formData.get('name'),
          days: Array.from(state.weekdays).sort((a,b)=>a-b).map(i => WEEKDAYS[i]),
          scheduleByDay,
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
          const created = await createClass(payload);
          if (Array.isArray(state.draftEvents) && state.draftEvents.length) {
            for (const ev of state.draftEvents) {
              const body = { ...ev, classId: created.classId };
              await apiEvents('', { method: 'POST', body: JSON.stringify(body) });
            }
          }
        }
        closeModal();
        await loadClasses();
      } catch (err) {
        console.error('Erro ao salvar aula', err);
        alert('Erro ao salvar aula');
      }
    });
  }

  function renderDraftEvents(container) {
    const list = Array.isArray(state.draftEvents) ? [...state.draftEvents] : [];
    list.sort((a, b) => {
      const da = new Date(a.date + 'T' + (a.time || '00:00'));
      const db = new Date(b.date + 'T' + (b.time || '00:00'));
      if (!a.date) return 1;
      if (!b.date) return -1;
      return da - db;
    });
    if (!list.length) {
      container.innerHTML = '<p class="hint">Nenhum evento cadastrado</p>';
      return;
    }
    container.innerHTML = '';
    list.forEach((event, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'event-card';
      const color = event.color || 'red-alert';
      wrap.classList.add(`event-${color}`);
      const dateStr = event.date ? isoToLocalDate(event.date).toLocaleDateString('pt-BR') : '';
      const timeStr = event.time || '';
      wrap.innerHTML = `
        <div class="event-header">
          <div class="event-name">${event.name}</div>
          <button type="button" class="btn-delete-event" data-idx="${idx}" title="Remover evento">×</button>
        </div>
        <div class="event-meta">
          ${dateStr ? `<div class="event-date"><img src="../../images/calendar.svg" alt="data" class="event-icon"> ${dateStr}</div>` : ''}
          ${timeStr ? `<div class="event-time"><img src="../../images/clock.svg" alt="horário" class="event-icon"> ${timeStr}</div>` : ''}
        </div>
      `;
      const del = wrap.querySelector('.btn-delete-event');
      del.addEventListener('click', () => {
        if (!Array.isArray(state.draftEvents)) return;
        state.draftEvents.splice(idx, 1);
        renderDraftEvents(container);
      });
      container.appendChild(wrap);
    });
  }

  function openDraftEventModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal event-modal';
    modal.innerHTML = `
      <h3>Novo evento</h3>
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
                <button type="button" class="color-option" data-color="yellow-alert" style="background: var(--yellow-alert);" title="Amarelo" data-action="pick-color"></button>
              </div>
            </div>
            <input name="color" type="hidden" value="red-alert">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn ghost" data-action="cancel">Cancelar</button>
            <button type="submit" class="btn primary">Adicionar</button>
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
    if (colorOptions[0]) colorOptions[0].style.border = '2px solid #111';

    cancel.addEventListener('click', () => backdrop.remove());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      
      // Formatar peso e nota como decimal
      let weightValue = fd.get('weight');
      if (weightValue && weightValue.trim() !== '') {
        weightValue = weightValue.replace(',', '.');
        const weightNumber = parseFloat(weightValue);
        if (!isNaN(weightNumber)) {
          weightValue = weightNumber.toFixed(1);
        }
      } else {
        weightValue = null;
      }
      
      let gradeValue = fd.get('grade');
      if (gradeValue && gradeValue.trim() !== '') {
        gradeValue = gradeValue.replace(',', '.');
        const gradeNumber = parseFloat(gradeValue);
        if (!isNaN(gradeNumber)) {
          gradeValue = gradeNumber.toFixed(1);
        }
      } else {
        gradeValue = null;
      }
      
      const draft = {
        name: fd.get('name'),
        weight: weightValue,
        grade: gradeValue,
        date: fd.get('date'),
        time: fd.get('time'),
        color: fd.get('color') || 'red-alert',
      };
      if (!Array.isArray(state.draftEvents)) state.draftEvents = [];
      state.draftEvents.push(draft);
      backdrop.remove();
      const hostList = document.querySelector('[data-role="events-list"]');
      if (hostList) renderDraftEvents(hostList);
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

  async function computeClassAverages() {
    // Busca todos os eventos e calcula média ponderada por aula
    const events = await apiEvents('', { method: 'GET' });
    const byClass = new Map();
    for (const ev of Array.isArray(events) ? events : []) {
      const gradeRaw = ev?.grade;
      const weightRaw = ev?.weight;
      const grade = gradeRaw !== null && gradeRaw !== undefined ? parseFloat(String(gradeRaw).replace(',', '.')) : NaN;
      const weight = weightRaw !== null && weightRaw !== undefined ? parseFloat(String(weightRaw).replace(',', '.')) : NaN;
      if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
        const acc = byClass.get(ev.classId) || { sum: 0, wsum: 0 };
        acc.sum += grade * weight;
        acc.wsum += weight;
        byClass.set(ev.classId, acc);
      }
    }
    // Atualiza state.classes com averageGrade formatada com 1 decimal
    state.classes = (state.classes || []).map((cls) => {
      const acc = byClass.get(cls.classId);
      const avg = acc && acc.wsum > 0 ? (acc.sum / acc.wsum) : null;
      const averageGrade = avg !== null ? avg.toFixed(1) : '-';
      return { ...cls, averageGrade };
    });
    render();
  }

  async function loadClasses() {
    const data = await api('', { method: 'GET' });
    const sorted = Array.isArray(data)
      ? [...data].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }))
      : [];
    state.classes = sorted;
    try {
      await computeClassAverages();
    } catch (e) {
      render();
    }
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
        <p class="hint">Essa ação não pode ser desfeita.</p>
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
    try {
      const events = await apiEvents('', { method: 'GET' });
      const classEvents = events.filter(e => e.classId === classId);
      for (const event of classEvents) {
        await apiEvents(`/${event.eventId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Erro ao deletar eventos da aula', err);
    }
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
                <button type="button" class="color-option" data-color="yellow-alert" style="background: var(--yellow-alert);" title="Amarelo" data-action="pick-color"></button>
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
      
      // Formatar peso e nota como decimal
      let weightValue = fd.get('weight');
      if (weightValue && weightValue.trim() !== '') {
        weightValue = weightValue.replace(',', '.');
        const weightNumber = parseFloat(weightValue);
        if (!isNaN(weightNumber)) {
          weightValue = weightNumber.toFixed(1);
        }
      } else {
        weightValue = null;
      }
      
      let gradeValue = fd.get('grade');
      if (gradeValue && gradeValue.trim() !== '') {
        gradeValue = gradeValue.replace(',', '.');
        const gradeNumber = parseFloat(gradeValue);
        if (!isNaN(gradeNumber)) {
          gradeValue = gradeNumber.toFixed(1);
        }
      } else {
        gradeValue = null;
      }
      
      const payload = {
        classId: cls.classId,
        name: fd.get('name'),
        weight: weightValue,
        grade: gradeValue,
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
        try { await computeClassAverages(); } catch {}
      } catch (err) {
        console.error('Erro ao criar evento', err);
        alert('Erro ao criar evento');
      }
    });
  }

  function openEditClassEventModal(event, classId, eventsContainer) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal event-modal';
    
    const gradeDisplay = event.grade ? parseFloat(event.grade).toFixed(1) : '';
    const weightDisplay = event.weight ? parseFloat(event.weight).toFixed(1) : '';
    
    modal.innerHTML = `
      <h3>Editar evento</h3>
      <div class="modal-body">
        <form id="event-form">
          <div class="form-grid">
            <div class="field">
              <label>Nome *</label>
              <input name="name" required value="${event.name || ''}">
            </div>
            <div class="field">
              <label>Peso da nota</label>
              <input name="weight" type="number" step="0.01" min="0" value="${weightDisplay}">
            </div>
            <div class="field">
              <label>Nota obtida</label>
              <input name="grade" type="number" step="0.01" min="0" value="${gradeDisplay}">
            </div>
            <div class="field">
              <label>Data</label>
              <input name="date" type="date" required value="${event.date || ''}">
            </div>
            <div class="field">
              <label>Horário</label>
              <input name="time" type="time" value="${event.time || ''}">
            </div>
            <div class="field">
              <label>Cor do evento</label>
              <div class="color-picker">
                <button type="button" class="color-option" data-color="red-alert" style="background: var(--red-alert);" title="Vermelho" data-action="pick-color"></button>
                <button type="button" class="color-option" data-color="blue-alert" style="background: var(--blue-alert);" title="Azul" data-action="pick-color"></button>
                <button type="button" class="color-option" data-color="green-alert" style="background: var(--green-alert);" title="Verde" data-action="pick-color"></button>
                <button type="button" class="color-option" data-color="yellow-alert" style="background: var(--yellow-alert);" title="Amarelo" data-action="pick-color"></button>
              </div>
            </div>
            <input name="color" type="hidden" value="${event.color || 'red-alert'}">
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

    // Set selected color button
    const currentColor = event.color || 'red-alert';
    colorOptions.forEach(btn => {
      if (btn.dataset.color === currentColor) {
        btn.style.border = '2px solid #111';
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = e.currentTarget.dataset.color;
        colorInput.value = color;
        colorOptions.forEach(b => b.style.border = '');
        e.currentTarget.style.border = '2px solid #111';
      });
    });

    cancel.addEventListener('click', () => backdrop.remove());
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      
      // Formatar peso e nota como decimal
      let weightValue = fd.get('weight');
      if (weightValue && weightValue.trim() !== '') {
        weightValue = weightValue.replace(',', '.');
        const weightNumber = parseFloat(weightValue);
        if (!isNaN(weightNumber)) {
          weightValue = weightNumber.toFixed(1);
        }
      } else {
        weightValue = null;
      }
      
      let gradeValue = fd.get('grade');
      if (gradeValue && gradeValue.trim() !== '') {
        gradeValue = gradeValue.replace(',', '.');
        const gradeNumber = parseFloat(gradeValue);
        if (!isNaN(gradeNumber)) {
          gradeValue = gradeNumber.toFixed(1);
        }
      } else {
        gradeValue = null;
      }
      
      const payload = {
        classId,
        name: fd.get('name'),
        weight: weightValue,
        grade: gradeValue,
        date: fd.get('date'),
        time: fd.get('time'),
        color: fd.get('color') || 'red-alert',
      };
      
      try {
        await apiEvents(`/${event.eventId}`, { method: 'PUT', body: JSON.stringify(payload) });
        backdrop.remove();
        loadClassEvents(classId, eventsContainer);
        try { await computeClassAverages(); } catch {}
      } catch (err) {
        console.error('Erro ao editar evento', err);
        alert('Erro ao editar evento');
      }
    });
  }

  loadClasses().catch((err) => {
    console.error('Erro ao carregar aulas', err);
    renderEmpty();
  });
})();
