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
    btn.textContent = 'Adicionar Aula';
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
      meta.innerHTML = `
        <div><div class="label">Dias</div><div>${days || '-'}</div></div>
        <div><div class="label">Horários</div><div>${formatSchedule(cls) || '-'}</div></div>
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
      sorted.forEach(s => {
        const d = new Date(s.date);
        const dow = d.getDay();
        state.weekdays.add(dow);
          state.weekdaySlots.set(dow, s.slots && Array.isArray(s.slots) && s.slots.length ? s.slots : [{ start: s.start, end: s.end }]);
      });
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
                <p class="hint">Cadastre eventos no botão abaixo.</p>
                <button type="button" class="btn" data-action="add-event" ${cls ? '' : 'disabled'}>Adicionar evento</button>
                ${cls ? '' : '<p class="hint">Salve a aula antes de adicionar eventos.</p>'}
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
        .map(s => `${s.date}${s.start || s.end ? ` (${s.start || '--:--'}-${s.end || '--:--'})` : ''}`)
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
        const iso = date.toISOString().slice(0, 10);
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
    const start = new Date(state.startDate);
    const end = new Date(state.endDate);
    if (isNaN(start) || isNaN(end) || end < start) return [];
    const res = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (state.weekdays.has(dow)) {
        const raw = state.weekdaySlots.get(dow);
        const slots = Array.isArray(raw) ? raw : raw ? [raw] : [{ start: '', end: '' }];
        const iso = d.toISOString().slice(0, 10);
        res.push({ date: iso, start: slots[0]?.start || '', end: slots[0]?.end || '', slots: slots.map(s => ({ start: s.start || '', end: s.end || '' })) });
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
    modal.className = 'modal';
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
      };
      try {
        await apiEvents('', { method: 'POST', body: JSON.stringify(payload) });
        backdrop.remove();
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
