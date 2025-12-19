(function () {
  const weekContainer = document.getElementById('week-days');
  const monthContainer = document.getElementById('month-calendar');
  const monthLabel = document.getElementById('month-label');
  const monthNav = document.querySelector('.month-nav');
  const pillsContainer = document.getElementById('month-pills');
  const eventsBody = document.querySelector('.events-body');
  const pageTitle = document.querySelector('.page-title');
  if (!weekContainer || !monthContainer || !monthLabel) return;

  const API_BASE = typeof API_URL !== 'undefined' ? API_URL : '/api';
  const API_EVENTS = `${API_BASE}/events`;
  const API_CLASSES = `${API_BASE}/classes`;
  const USER_ID_KEY = 'sd-user-id';

  function getUserId() {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = `user-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
  }

  const userId = (window.SessionManager && window.SessionManager.getOrCreateUserId())
    || getUserId();

  const locale = 'pt-BR';
  const today = stripTime(new Date());
  const state = {
    today,
    selected: today,
    monthCursor: new Date(today.getFullYear(), today.getMonth(), 1),
    monthStripIndex: today.getMonth() < 6 ? 0 : 1,
    events: [],
    classes: new Map(),
  };

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fmtISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  async function apiCall(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadEvents() {
    try {
      state.events = await apiCall(`${API_EVENTS}`, { method: 'GET' }) || [];
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
      state.events = [];
    }
  }

  async function loadClasses() {
    try {
      const classes = await apiCall(`${API_CLASSES}`, { method: 'GET' }) || [];
      state.classes = new Map(classes.map(c => [c.classId, c]));
    } catch (err) {
      console.error('Erro ao carregar aulas', err);
      state.classes = new Map();
    }
  }

  function startOfWeek(d) {
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return stripTime(start);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return stripTime(x);
  }

  function renderWeek() {
    weekContainer.innerHTML = '';
    const y = state.monthCursor.getFullYear();
    const m = state.monthCursor.getMonth();
    const last = new Date(y, m + 1, 0);
    for (let d = 1; d <= last.getDate(); d++) {
      const day = new Date(y, m, d);
      const iso = fmtISO(day);
      const dayEvents = state.events.filter(e => e.date === iso).sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });

      const card = document.createElement('section');
      card.className = 'day-card' + (iso === fmtISO(state.selected) ? ' is-selected' : '');
      card.id = `day-${iso}`;
      card.setAttribute('role', 'listitem');
      
      let eventsHtml = '';
      if (dayEvents.length > 0) {
        eventsHtml = dayEvents.map(event => {
          const cls = state.classes.get(event.classId);
          const className = cls?.name || 'Aula';
          const color = event.color || 'red-alert';
          const colorClass = `event-${color}`;
          
          let gradeDisplay = '';
          if (event.grade) {
            const gradeNum = parseFloat(event.grade);
            gradeDisplay = isNaN(gradeNum) ? event.grade : gradeNum.toFixed(1);
          }
          const gradeHtml = gradeDisplay ? `<div class="event-pill"><img src="../../images/check.svg" alt="nota" class="pill-icon">${gradeDisplay}</div>` : '';
          const stopWords = ['e', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os'];
          const words = String(className).split(' ').filter(w => w && !stopWords.includes(w.toLowerCase()));
          const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
          
          return `
            <div class="event-item ${colorClass}">
              <div class="event-row-1">
                <div class="event-bag-icon">${initials || 'A'}</div>
                <div class="event-title-time">
                  <div class="event-name">${event.name}</div>
                  ${event.time ? `<div class="event-time">${event.time}</div>` : ''}
                </div>
              </div>
              
              <div class="event-row-2">
                <div class="event-chart-box">
                  <img src="../../images/chart.svg" alt="grade">
                </div>
                <div class="event-class">${className}</div>
              </div>
              
              <div class="event-row-3">
                <div class="event-pills">
                  ${gradeHtml}
                </div>
                <button type="button" class="event-more" data-event-id="${event.eventId}" title="Opções">
                  <img src="../../images/more.svg" alt="Menu">
                </button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        eventsHtml = '<div class="no-events">Sem eventos</div>';
      }

      card.innerHTML = `
        <div class="day-card-header">
          <span class="day-number">${day.getDate()}</span>
          <div class="day-events-container">${eventsHtml}</div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        state.selected = stripTime(day);
        renderMonth();
        renderWeek();
        renderEvents();
      });

      card.querySelectorAll('.event-more').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const eventId = btn.dataset.eventId;
          const event = state.events.find(ev => ev.eventId === eventId);
          if (event) openEventOptionsModal(event);
        });
      });

      weekContainer.appendChild(card);
    }
  }

  function renderMonth() {
    const y = state.monthCursor.getFullYear();
    const m = state.monthCursor.getMonth();
    const monthName = capFirst(state.monthCursor.toLocaleDateString(locale, { month: 'long' }));
    const showYear = y !== state.today.getFullYear();
    monthLabel.textContent = showYear ? `${monthName} - ${y}` : monthName;
    if (monthNav) {
      monthNav.classList.toggle('show-year', showYear);
    }
    if (pageTitle) {
      pageTitle.textContent = showYear ? `Calendário - ${y}` : 'Calendário';
    }

    const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const frags = [];
    headers.forEach(h => frags.push(`<div class="weekday">${h}</div>`));

    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const offset = first.getDay();
    for (let i = 0; i < offset; i++) frags.push('<div class="day-cell is-out"></div>');

    for (let d = 1; d <= last.getDate(); d++) {
      const cur = new Date(y, m, d);
      const iso = fmtISO(cur);
      const isToday = iso === fmtISO(state.today);
      const isSelected = iso === fmtISO(state.selected);
      const dow = cur.getDay();
      const isWeekend = dow === 0 || dow === 6;
      frags.push(`<button class="day-cell${isWeekend ? ' is-weekend' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" data-date="${iso}" aria-label="${cur.toLocaleDateString(locale)}">${d}</button>`);
    }

    const totalCells = headers.length + offset + last.getDate();
    const remainder = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainder; i++) frags.push('<div class="day-cell is-out"></div>');

    monthContainer.innerHTML = frags.join('');

    monthContainer.querySelectorAll('button.day-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const [yy, mm, dd] = btn.dataset.date.split('-').map(Number);
        state.selected = new Date(yy, mm - 1, dd);
        state.monthCursor = new Date(yy, mm - 1, 1);
        renderMonth();
        renderWeek();
        renderMonthPills();
        renderEvents();
        const target = document.getElementById(`day-${btn.dataset.date}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  function renderMonthPills() {
    if (!pillsContainer) return;
    const y = state.monthCursor.getFullYear();
    const active = state.monthCursor.getMonth();
    const start = state.monthStripIndex === 0 ? 0 : 6;
    const end = start + 6;
    const frags = [];
    for (let i = start; i < end; i++) {
      const lab = capFirst(new Date(y, i, 1).toLocaleString(locale, { month: 'long' }));
      frags.push(`<button class="month-pill${i === active ? ' is-active' : ''}" data-month="${i}">${lab}</button>`);
    }
    pillsContainer.innerHTML = frags.join('');
    pillsContainer.querySelectorAll('.month-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const mIdx = Number(btn.dataset.month);
        state.monthCursor = new Date(y, mIdx, 1);
        state.selected = new Date(y, mIdx, 1);
        state.monthStripIndex = mIdx < 6 ? 0 : 1;
        renderMonth();
        renderWeek();
        renderMonthPills();
        renderEvents();
      });
    });
  }

  function renderEvents() {
    if (!eventsBody) return;
    
    const now = new Date();
    const today = stripTime(now);
    const currentMonth = state.monthCursor.getMonth();
    const currentYear = state.monthCursor.getFullYear();
    
    const futureEvents = state.events.filter(e => {
      if (!e.date) return false;
      const eventDate = new Date(e.date + 'T00:00:00');
      return eventDate >= today && eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    }).sort((a, b) => {
      const dateA = new Date(a.date + 'T' + (a.time || '00:00'));
      const dateB = new Date(b.date + 'T' + (b.time || '00:00'));
      return dateA - dateB;
    });

    if (futureEvents.length === 0) {
      eventsBody.innerHTML = '<span class="no-events-text">Nenhum evento futuro</span>';
      return;
    }

    eventsBody.innerHTML = '';
    futureEvents.forEach(event => {
      const cls = state.classes.get(event.classId);
      const className = cls?.name || 'Aula';
      const color = event.color || 'red-alert';
      
      const stopWords = ['e', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os'];
      const words = className.split(' ').filter(w => w.length > 0 && !stopWords.includes(w.toLowerCase()));
      const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
      
      const eventDateTime = new Date(event.date + 'T' + (event.time || '00:00'));
      const diffMs = eventDateTime - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      let timeLeftText = '';
      if (diffDays > 0) {
        timeLeftText = `Em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
      } else if (diffHours > 0) {
        timeLeftText = `Em ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
      } else {
        timeLeftText = 'Hoje';
      }
      
      const eventDateObj = new Date(event.date + 'T00:00:00');
      const day = String(eventDateObj.getDate()).padStart(2, '0');
      const monthShort = eventDateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const monthCapitalized = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
      const eventDateFormatted = `${day} ${monthCapitalized}`;
      const eventTimeFormatted = event.time || '';
      
      const eventCard = document.createElement('div');
      eventCard.className = `future-event-card event-${color}`;
      eventCard.innerHTML = `
        <div class="future-event-row-1">
          <div class="future-event-icon">${initials}</div>
          <div class="future-event-info">
            <div class="future-event-name-row">
              <span class="future-event-name">${event.name}</span>
              <span class="future-event-time-left">${timeLeftText}</span>
            </div>
            <span class="future-event-date">${eventDateFormatted}${eventTimeFormatted ? ' • ' + eventTimeFormatted : ''}</span>
          </div>
        </div>
        <div class="future-event-row-2">
          <button type="button" class="future-event-more" data-event-id="${event.eventId}" title="Editar evento">
            <img src="../../images/more.svg" alt="Mais">
          </button>
        </div>
      `;
      
      const moreBtn = eventCard.querySelector('.future-event-more');
      moreBtn.addEventListener('click', () => {
        openEventOptionsModal(event);
      });
      
      eventsBody.appendChild(eventCard);
    });
  }

  function hookNav() {
    const byAction = (sel) => document.querySelector(`[data-action="${sel}"]`);
    const safe = (el, fn) => el && el.addEventListener('click', fn);
    safe(byAction('prev-month'), () => {
      state.monthCursor.setMonth(state.monthCursor.getMonth() - 1);
      state.selected = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth(), 1);
      state.monthStripIndex = state.monthCursor.getMonth() < 6 ? 0 : 1;
      renderMonth();
      renderWeek();
      renderMonthPills();
      renderEvents();
    });
    safe(byAction('next-month'), () => {
      state.monthCursor.setMonth(state.monthCursor.getMonth() + 1);
      state.selected = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth(), 1);
      state.monthStripIndex = state.monthCursor.getMonth() < 6 ? 0 : 1;
      renderMonth();
      renderWeek();
      renderMonthPills();
      renderEvents();
    });
    safe(byAction('months-prev'), () => { state.monthStripIndex = 0; renderMonthPills(); });
    safe(byAction('months-next'), () => { state.monthStripIndex = 1; renderMonthPills(); });

    safe(byAction('prev-week'), () => { state.selected = addDays(state.selected, -7); state.monthCursor = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
    safe(byAction('next-week'), () => { state.selected = addDays(state.selected, 7); state.monthCursor = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
    safe(byAction('today-week'), () => { state.selected = state.today; state.monthCursor = new Date(state.today.getFullYear(), state.today.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
  }

  function openEventOptionsModal(event) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal event-options-modal';
    const cls = state.classes.get(event.classId);
    const className = cls?.name || 'Aula';
    const gradeDisplay = event.grade != null && event.grade !== '' ? Number(String(event.grade).replace(',', '.')) : null;
    const weightDisplay = event.weight != null && event.weight !== '' ? Number(String(event.weight).replace(',', '.')) : null;
    const gradeText = gradeDisplay != null && !Number.isNaN(gradeDisplay) ? gradeDisplay.toFixed(1) : '';
    const weightText = weightDisplay != null && !Number.isNaN(weightDisplay) ? weightDisplay.toFixed(1) : '';
    
    modal.innerHTML = `
      <h3>${event.name}</h3>
      <div class="modal-body">
        <p><strong>Aula:</strong> ${className}</p>
        <p><strong>Data:</strong> ${event.date ? new Date(event.date).toLocaleDateString('pt-BR') : '-'}</p>
        <p><strong>Horário:</strong> ${event.time || '-'}</p>
        ${gradeText ? `<p><strong>Nota:</strong> ${gradeText}</p>` : ''}
        ${weightText ? `<p><strong>Peso:</strong> ${weightText}</p>` : ''}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="cancel">Fechar</button>
        <button type="button" class="btn primary" data-action="edit">Editar</button>
        <button type="button" class="btn danger" data-action="delete">Deletar</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const editBtn = modal.querySelector('[data-action="edit"]');
    const deleteBtn = modal.querySelector('[data-action="delete"]');

    cancelBtn.addEventListener('click', () => backdrop.remove());
    editBtn.addEventListener('click', () => {
      backdrop.remove();
      openEditEventModal(event);
    });
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Deseja deletar o evento "${event.name}"?`)) {
        try {
          await apiCall(`${API_EVENTS}/${event.eventId}`, { method: 'DELETE' });
          await loadEvents();
          renderWeek();
          backdrop.remove();
        } catch (err) {
          console.error('Erro ao deletar evento', err);
          alert('Erro ao deletar evento');
        }
      }
    });
  }

  function openEditEventModal(event) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal event-modal';
  
      const weightDisplay = event.weight ? parseFloat(event.weight).toFixed(1) : '';
      const gradeDisplay = event.grade ? parseFloat(event.grade).toFixed(1) : '';
    const cls = state.classes.get(event.classId);
    const className = cls?.name || 'Aula';
    
    modal.innerHTML = `
      <h3>Editar evento: ${event.name}</h3>
      <div class="modal-body">
        <form id="edit-event-form">
          <div class="form-grid">
            <div class="field">
              <label>Nome *</label>
              <input name="name" required value="${event.name}">
            </div>
            <div class="field">
              <label>Peso da nota</label>
              <input name="weight" type="number" step="0.1" min="0" value="${weightDisplay}">
            </div>
            <div class="field">
              <label>Nota obtida</label>
              <input name="grade" type="number" step="0.1" min="0" value="${gradeDisplay}">
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
            <button type="submit" class="btn primary">Salvar</button>
          </div>
        </form>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    const form = modal.querySelector('#edit-event-form');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const colorInput = modal.querySelector('input[name="color"]');
    const colorOptions = modal.querySelectorAll('[data-action="pick-color"]');

    colorOptions.forEach(btn => {
      if (btn.dataset.color === (event.color || 'red-alert')) {
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

    cancelBtn.addEventListener('click', () => backdrop.remove());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      
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
        classId: event.classId,
        name: fd.get('name'),
        weight: weightValue,
        grade: gradeValue,
        date: fd.get('date'),
        time: fd.get('time'),
        color: fd.get('color'),
      };
      try {
        await apiCall(`${API_EVENTS}/${event.eventId}`, { 
          method: 'PUT', 
          body: JSON.stringify(payload),
        });
        await loadEvents();
        renderWeek();
        backdrop.remove();
      } catch (err) {
        console.error('Erro ao atualizar evento', err);
        alert('Erro ao atualizar evento');
      }
    });
  }

  hookNav();
  (async () => {
    await loadEvents();
    await loadClasses();
    renderWeek();
    renderMonth();
    renderMonthPills();
    renderEvents();
    
    const todayIso = fmtISO(state.today);
    const todayCard = document.getElementById(`day-${todayIso}`);
    if (todayCard) {
      setTimeout(() => {
        todayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  })();
})();
