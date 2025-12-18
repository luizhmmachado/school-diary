class AppLayout extends HTMLElement {
  connectedCallback() {
    // Wrap any existing content in layout structure
    const content = this.innerHTML;
    
    this.innerHTML = `
      <div class="layout">
        <app-sidebar></app-sidebar>
        <main class="content">
          ${content}
        </main>
      </div>
    `;
  }
}
customElements.define('app-layout', AppLayout);
