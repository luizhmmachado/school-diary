class AppSidebar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <img src="/images/school-diary.svg" alt="School Diary" class="brand-logo">
          <button class="sidebar-toggle" data-role="sidebar-toggle" aria-label="Abrir/fechar menu">
            <img src="/images/menu.svg" alt="Menu" class="toggle-icon">
          </button>
        </div>
        <nav class="sidebar-nav">
        <a href="#" class="nav-item" data-tab="dashboard">
            <img src="/images/home.svg" alt="Dashboard" class="nav-icon">
            <span class="nav-label">Dashboard</span>
          </a>
          <a href="#" class="nav-item" data-tab="calendar">
            <img src="/images/calendar.svg" alt="Calendário" class="nav-icon">
            <span class="nav-label">Calendário</span>
          </a>
          <a href="#" class="nav-item" data-tab="classes">
            <img src="/images/book.svg" alt="Aulas" class="nav-icon">
            <span class="nav-label">Aulas</span>
          </a>
        </nav>
      </aside>
    `;
  }
}
customElements.define('app-sidebar', AppSidebar);
