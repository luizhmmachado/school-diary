(function () {
  const weekContainer = document.getElementById('week-days');
  const monthContainer = document.getElementById('month-calendar');
  const monthLabel = document.getElementById('month-label');
  const pillsContainer = document.getElementById('month-pills');
  const eventsBody = document.querySelector('.events-body');
  if (!weekContainer || !monthContainer || !monthLabel) return;

  const locale = 'pt-BR';
  const today = stripTime(new Date());
  const state = {
    today,
    selected: today,
    monthCursor: new Date(today.getFullYear(), today.getMonth(), 1),
    monthStripIndex: today.getMonth() < 6 ? 0 : 1, // 0: Jan-Jun, 1: Jul-Dec
  };

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fmtISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function startOfWeek(d) {
    // Sunday as first day of week
    const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
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
    // Render all days for the selected month (scrollable list)
    weekContainer.innerHTML = '';
    const y = state.monthCursor.getFullYear();
    const m = state.monthCursor.getMonth();
    const last = new Date(y, m + 1, 0);
    for (let d = 1; d <= last.getDate(); d++) {
      const day = new Date(y, m, d);
      const iso = fmtISO(day);
      const card = document.createElement('section');
      card.className = 'day-card' + (iso === fmtISO(state.selected) ? ' is-selected' : '');
      card.id = `day-${iso}`;
      card.setAttribute('role', 'listitem');
      card.innerHTML = `
        <div class="day-header">
          <span class="dow">${day.toLocaleDateString(locale, { weekday: 'short' })}</span>
          <span class="date">${day.toLocaleDateString(locale, { day: '2-digit', month: 'short' })}</span>
        </div>
        <div class="day-body" aria-label="sem eventos"></div>
      `;
      weekContainer.appendChild(card);
    }
  }

  function renderMonth() {
    const y = state.monthCursor.getFullYear();
    const m = state.monthCursor.getMonth();
    const monthName = state.monthCursor.toLocaleDateString(locale, { month: 'long' });
    monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const frags = [];
    headers.forEach(h => frags.push(`<div class="weekday">${h}</div>`));

    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const offset = first.getDay(); // 0 for Sunday start
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

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function renderMonthPills() {
    if (!pillsContainer) return;
    const y = state.monthCursor.getFullYear();
    const active = state.monthCursor.getMonth();
    const start = state.monthStripIndex === 0 ? 0 : 6;
    const end = start + 6; // non-inclusive
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
    eventsBody.innerHTML = '<span>Nenhum evento</span>';
  }

  function hookNav() {
    const byAction = (sel) => document.querySelector(`[data-action="${sel}"]`);
    const safe = (el, fn) => el && el.addEventListener('click', fn);
    safe(byAction('prev-month'), () => { state.monthCursor.setMonth(state.monthCursor.getMonth() - 1); state.monthStripIndex = state.monthCursor.getMonth() < 6 ? 0 : 1; renderMonth(); renderMonthPills(); });
    safe(byAction('next-month'), () => { state.monthCursor.setMonth(state.monthCursor.getMonth() + 1); state.monthStripIndex = state.monthCursor.getMonth() < 6 ? 0 : 1; renderMonth(); renderMonthPills(); });
    // Toggle month pills half-year view
    safe(byAction('months-prev'), () => { state.monthStripIndex = 0; renderMonthPills(); });
    safe(byAction('months-next'), () => { state.monthStripIndex = 1; renderMonthPills(); });

    safe(byAction('prev-week'), () => { state.selected = addDays(state.selected, -7); state.monthCursor = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
    safe(byAction('next-week'), () => { state.selected = addDays(state.selected, 7); state.monthCursor = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
    safe(byAction('today-week'), () => { state.selected = state.today; state.monthCursor = new Date(state.today.getFullYear(), state.today.getMonth(), 1); renderWeek(); renderMonth(); renderEvents(); });
  }

  hookNav();
  renderWeek();
  renderMonth();
  renderMonthPills();
  renderEvents();
})();
