/* ============================================================
   app.js · SPA router, bindings y controladores de vista
   ============================================================ */
(function () {
  'use strict';

  const VIEWS = ['login','register','recover','home','wizard','dashboard','settings','admin'];
  let lockoutTimer = null;

  // ---------- Router SPA ----------
  function go(view) {
    VIEWS.forEach(v => document.getElementById('view-' + v)?.classList.add('hidden'));
    const el = document.getElementById('view-' + view);
    if (el) el.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
    onEnterView(view);
  }

  function onEnterView(view) {
    switch (view) {
      case 'login': renderLockout(); break;
      case 'home': renderHome(); break;
      case 'wizard': renderWizard(); break;
      case 'dashboard': renderDashboard(); break;
      case 'settings': renderSettings(); break;
      case 'admin': renderAdmin(); break;
    }
  }

  // ---------- Toast / alert ----------
  const T = (icon, title, text) => Swal.fire({ icon, title, text, toast: true, position: 'top-end', timer: 3200, showConfirmButton: false });

  // ---------- LOGIN ----------
  function renderLockout() {
    clearInterval(lockoutTimer);
    const banner = document.getElementById('lockout-banner');
    const txt = document.getElementById('lockout-text');
    const btn = document.getElementById('btn-login');
    const update = () => {
      const left = Auth.lockoutRemaining();
      if (left > 0) {
        banner.classList.remove('hidden'); txt.textContent = 'Acceso bloqueado. Espera ' + left + 's para reintentar.';
        btn.textContent = 'Bloqueado (' + left + 's)'; btn.disabled = true;
      } else {
        banner.classList.add('hidden'); btn.textContent = 'Iniciar Sesión'; btn.disabled = false;
        clearInterval(lockoutTimer);
      }
    };
    update();
    lockoutTimer = setInterval(update, 1000);
  }

  async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;
    if (!email || !pwd) { T('warning', 'Completa todos los campos'); return; }
    const res = await Auth.login(email, pwd);
    if (res.success) { go('home'); return; }
    let msg = res.error;
    if (res.code === 'user_not_found') msg = 'Usuario no registrado: verifica tu correo';
    if (res.code === 'wrong_password') msg = 'Contraseña incorrecta';
    if (res.locked) {
      Swal.fire({ icon: 'error', title: 'Cuenta bloqueada', text: 'Demasiados intentos. Espera ' + res.lockoutSeconds + 's.' });
      renderLockout();
    } else if (res.attemptsUsed) {
      T('error', msg, 'Intento ' + res.attemptsUsed + '/' + res.attemptsMax);
    } else {
      T('error', msg);
    }
  }

  async function handleRegister() {
    const data = {
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      password: document.getElementById('reg-password').value,
      habeasDataAccepted: document.getElementById('reg-habeas').checked,
    };
    if (!data.name || !data.email || !data.phone || !data.password) { T('warning', 'Completa todos los campos'); return; }
    if (!data.habeasDataAccepted) { T('warning', 'Debes aceptar el tratamiento de datos'); return; }
    const res = await Auth.register(data);
    if (res.success) { T('success', 'Cuenta creada'); go('home'); }
    else T('error', res.error);
  }

  async function handleRecover() {
    const email = document.getElementById('rec-email').value.trim();
    const phone = document.getElementById('rec-phone').value.trim();
    const pwd = document.getElementById('rec-newpass').value;
    if (!email || !phone || !pwd) { T('warning', 'Completa todos los campos'); return; }
    const res = await Auth.recover(email, phone, pwd);
    if (res.success) { T('success', 'Contraseña actualizada'); go('login'); }
    else T('error', res.error);
  }

  // ---------- HOME ----------
  function renderHome() {
    const u = Auth.currentUser();
    if (!u) { go('login'); return; }
    const first = (u.name || 'Usuario').split(' ')[0];
    document.getElementById('hello').textContent = '¡Hola, ' + first + '!';
    document.getElementById('today').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', u.isAdmin !== 1));
    const summary = Finance.computeSummary(Auth.getProfile(u.id), Auth.getDebts(u.id));
    Dashboard.renderSummary(document.getElementById('summary-card'), summary);
  }

  // ---------- WIZARD ----------
  let wizardDebts = [];

  function renderWizard() {
    const u = Auth.currentUser(); if (!u) { go('login'); return; }
    const prof = Auth.getProfile(u.id);
    if (prof) {
      document.getElementById('w-main-income').value = Finance.maskCurrency(String(prof.mainIncome));
      document.getElementById('w-other-income').value = Finance.maskCurrency(String(prof.otherIncome));
      document.getElementById('w-fixed-expenses').value = Finance.maskCurrency(String(prof.fixedExpenses));
    } else {
      document.getElementById('w-main-income').value = '';
      document.getElementById('w-other-income').value = '';
      document.getElementById('w-fixed-expenses').value = '';
    }
    const existing = Auth.getDebts(u.id);
    wizardDebts = existing.length ? existing.map(d => ({ localId: Auth._uuid(), debtType: d.debtType, debtTypeLabel: d.debtTypeLabel, initialAmount: Finance.maskCurrency(String(d.initialAmount)), interestRate: String(d.interestRate), rateType: d.rateType, numberOfInstallments: String(d.numberOfInstallments), paymentDay: String(d.paymentDay) })) : [];
    paintDebts();
  }

  function paintDebts() {
    const container = document.getElementById('debts-container');
    container.innerHTML = '';
    wizardDebts.forEach((d, idx) => {
      const meta = Finance.debtMeta(d.debtType);
      const node = document.createElement('div');
      node.className = 'debt-item';
      node.innerHTML = `
        <div class="debt-head">
          <div class="debt-icon" style="background:${meta.color}"><i class="fa-solid ${meta.icon}"></i></div>
          <b>${meta.label}</b>
          <button class="btn-del" data-del="${d.localId}" title="Eliminar"><i class="fa-solid fa-circle-xmark"></i></button>
        </div>
        <label>Tipo de deuda</label>
        <div class="chip-row">
          ${Finance.debtTypes().map(t => { const m = Finance.debtMeta(t.value); const active = d.debtType === t.value; return `<span class="chip ${active ? 'active' : ''}" ${active ? `style="background:${m.color}"` : ''} data-settype="${d.localId}|${t.value}"><i class="fa-solid ${m.icon}" style="color:${active ? '#FFF' : m.color}"></i>${t.label}</span>`; }).join('')}
        </div>
        <button class="edu-toggle" data-edu="${d.localId}"><i class="fa-solid fa-graduation-cap"></i> ¿Qué debo saber de esta deuda? <i class="fa-solid fa-chevron-down" style="margin-left:auto"></i></button>
        <div class="edu-box collapsed" id="edu-${d.localId}" style="border-left-color:${meta.color}">${meta.education}</div>
        <label>Monto inicial</label>
        <input type="text" class="money" data-field="initialAmount" data-id="${d.localId}" value="${d.initialAmount}" placeholder="$ 0" />
        <label>Tasa de interés (%)</label>
        <input type="text" inputmode="decimal" data-field="interestRate" data-id="${d.localId}" value="${d.interestRate}" />
        <div class="segmented">
          <button type="button" data-rate="${d.localId}|EA" class="${d.rateType === 'EA' ? 'active' : ''}">E.A.</button>
          <button type="button" data-rate="${d.localId}|MONTHLY" class="${d.rateType === 'MONTHLY' ? 'active' : ''}">Mensual</button>
        </div>
        <label>Número de cuotas</label>
        <input type="number" data-field="numberOfInstallments" data-id="${d.localId}" value="${d.numberOfInstallments}" />
        <label>Día de pago (1-31)</label>
        <input type="number" min="1" max="31" data-field="paymentDay" data-id="${d.localId}" value="${d.paymentDay}" />
      `;
      container.appendChild(node);
    });
    bindMoneyInputs(container);
  }

  function bindMoneyInputs(scope) {
    scope.querySelectorAll('input.money').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const el = e.target;
        const pos = el.selectionStart;
        el.value = Finance.maskCurrency(el.value);
        try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
      });
    });
    scope.querySelectorAll('input[data-field]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = e.target.dataset.id, f = e.target.dataset.field;
        const d = wizardDebts.find(x => x.localId === id); if (d) d[f] = e.target.value;
      });
    });
  }

  function handleCalculate() {
    const u = Auth.currentUser(); if (!u) { go('login'); return; }
    const mi = Finance.unmaskCurrency(document.getElementById('w-main-income').value);
    const oi = Finance.unmaskCurrency(document.getElementById('w-other-income').value);
    const fe = Finance.unmaskCurrency(document.getElementById('w-fixed-expenses').value);
    if (mi <= 0) { T('warning', 'Ingresa tu ingreso mensual principal'); return; }
    if (fe <= 0) { T('warning', 'Ingresa tus gastos fijos'); return; }
    const profile = Auth.upsertProfile({ userId: u.id, mainIncome: mi, otherIncome: oi, fixedExpenses: fe });
    const computed = wizardDebts.map(d => {
      const amt = Finance.unmaskCurrency(d.initialAmount);
      const rate = parseFloat((d.interestRate || '').replace(',', '.')) || 0;
      const n = parseInt(d.numberOfInstallments) || 1;
      const day = parseInt(d.paymentDay) || 1;
      const mRate = Finance.computeMonthlyRate(rate, d.rateType);
      return { debtType: d.debtType, debtTypeLabel: Finance.debtMeta(d.debtType).label, initialAmount: amt, interestRate: rate, rateType: d.rateType, numberOfInstallments: n, paymentDay: day, monthlyRate: mRate, monthlyPayment: Finance.frenchAmortization(amt, mRate, n) };
    });
    Auth.saveDebts(u.id, profile.id, computed);
    T('success', 'Datos guardados'); go('dashboard');
  }

  function handleSample() {
    wizardDebts = [
      { localId: Auth._uuid(), debtType: 'tarjeta_credito', debtTypeLabel: 'Tarjeta de Crédito', initialAmount: Finance.maskCurrency('5000000'), interestRate: '28', rateType: 'EA', numberOfInstallments: '36', paymentDay: '15' },
      { localId: Auth._uuid(), debtType: 'consumo', debtTypeLabel: 'Consumo', initialAmount: Finance.maskCurrency('8000000'), interestRate: '18', rateType: 'EA', numberOfInstallments: '48', paymentDay: '5' },
      { localId: Auth._uuid(), debtType: 'vehiculo', debtTypeLabel: 'Vehículo', initialAmount: Finance.maskCurrency('25000000'), interestRate: '14', rateType: 'EA', numberOfInstallments: '60', paymentDay: '20' },
    ];
    document.getElementById('w-main-income').value = Finance.maskCurrency('4500000');
    document.getElementById('w-other-income').value = Finance.maskCurrency('500000');
    document.getElementById('w-fixed-expenses').value = Finance.maskCurrency('1800000');
    paintDebts();
  }

  // ---------- DASHBOARD ----------
  function renderDashboard() {
    const u = Auth.currentUser(); if (!u) { go('login'); return; }
    const prof = Auth.getProfile(u.id); const debts = Auth.getDebts(u.id);
    const sum = Finance.computeSummary(prof, debts);
    if (!sum) {
      document.getElementById('dashboard-empty').classList.remove('hidden');
      document.getElementById('dashboard-content').classList.add('hidden');
      return;
    }
    document.getElementById('dashboard-empty').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');
    Dashboard.renderDiagnosis(document.getElementById('diagnosis-card'), sum);
    setTimeout(() => Dashboard.renderCharts(prof, debts, sum), 30);
    Dashboard.renderStrategies(document.getElementById('strategies-card'), debts, sum);
  }

  async function handlePDF() {
    const u = Auth.currentUser(); if (!u) return;
    const prof = Auth.getProfile(u.id); const debts = Auth.getDebts(u.id);
    const sum = Finance.computeSummary(prof, debts);
    if (!sum) { T('warning', 'No hay datos'); return; }
    try { await Dashboard.downloadPDF(u, prof, debts, sum); T('success', 'PDF generado'); }
    catch (e) { T('error', 'Error al generar PDF', e.message); }
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    const u = Auth.currentUser(); if (!u) { go('login'); return; }
    document.getElementById('profile-info').innerHTML = `<h3>Perfil</h3><p><b>Nombre:</b> ${u.name}</p><p><b>Correo:</b> ${u.email}</p><p><b>Teléfono:</b> ${u.phone}</p>`;
  }

  async function handleChangePass() {
    const u = Auth.currentUser(); if (!u) return;
    const c = document.getElementById('cfg-current').value;
    const n = document.getElementById('cfg-new').value;
    const cf = document.getElementById('cfg-confirm').value;
    if (n !== cf) { T('error', 'Las contraseñas no coinciden'); return; }
    const r = await Auth.changePassword(u.id, c, n);
    if (r.success) { T('success', 'Contraseña actualizada'); ['cfg-current','cfg-new','cfg-confirm'].forEach(id => document.getElementById(id).value=''); }
    else T('error', r.error);
  }

  // ---------- ADMIN ----------
  function renderAdmin() {
    const u = Auth.currentUser(); if (!u || u.isAdmin !== 1) { go('home'); return; }
    const users = Auth._get(Auth.LS.USERS, []);
    document.getElementById('admin-users').innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#F1F5F9;"><th style="text-align:left;padding:6px;">Nombre</th><th style="text-align:left;padding:6px;">Correo</th><th style="text-align:left;padding:6px;">Rol</th></tr></thead>
        <tbody>${users.map(x => `<tr><td style="padding:6px;border-bottom:1px solid #E2E8F0;">${x.name}</td><td style="padding:6px;border-bottom:1px solid #E2E8F0;">${x.email}</td><td style="padding:6px;border-bottom:1px solid #E2E8F0;">${x.isAdmin ? 'Admin' : 'Usuario'}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  // ---------- BOOT ----------
  async function boot() {
    await Auth.seedIfEmpty();
    // Ir a home si hay sesión, si no a login
    go(Auth.currentUser() ? 'home' : 'login');

    // Navegación genérica
    document.body.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]'); if (nav) { e.preventDefault(); go(nav.dataset.nav); }
      const del = e.target.closest('[data-del]'); if (del) { const id = del.dataset.del; wizardDebts = wizardDebts.filter(x => x.localId !== id); paintDebts(); }
      const st = e.target.closest('[data-settype]'); if (st) { const [id, t] = st.dataset.settype.split('|'); const d = wizardDebts.find(x => x.localId === id); if (d) { d.debtType = t; d.debtTypeLabel = Finance.debtMeta(t).label; paintDebts(); } }
      const rt = e.target.closest('[data-rate]'); if (rt) { const [id, rate] = rt.dataset.rate.split('|'); const d = wizardDebts.find(x => x.localId === id); if (d) { d.rateType = rate; paintDebts(); } }
      const edu = e.target.closest('[data-edu]'); if (edu) { document.getElementById('edu-' + edu.dataset.edu)?.classList.toggle('collapsed'); }
    });

    // Login
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('toggle-login-password').addEventListener('click', () => {
      const i = document.getElementById('login-password');
      i.type = i.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('link-register').addEventListener('click', e => { e.preventDefault(); go('register'); });
    document.getElementById('link-recover').addEventListener('click', e => { e.preventDefault(); go('recover'); });

    // Register / Recover
    document.getElementById('btn-register').addEventListener('click', handleRegister);
    document.getElementById('btn-recover').addEventListener('click', handleRecover);

    // Home logout
    document.getElementById('btn-logout').addEventListener('click', () => { Auth.logout(); go('login'); });

    // Wizard
    document.getElementById('btn-add-debt').addEventListener('click', () => { wizardDebts.push({ localId: Auth._uuid(), debtType: 'tarjeta_credito', debtTypeLabel: 'Tarjeta de Crédito', initialAmount: '', interestRate: '', rateType: 'EA', numberOfInstallments: '', paymentDay: '' }); paintDebts(); });
    document.getElementById('btn-calculate').addEventListener('click', handleCalculate);
    document.getElementById('btn-sample').addEventListener('click', handleSample);
    bindMoneyInputs(document.getElementById('view-wizard'));

    // Dashboard
    document.getElementById('btn-pdf').addEventListener('click', handlePDF);

    // Settings
    document.getElementById('btn-change-pass').addEventListener('click', handleChangePass);
    document.getElementById('btn-export').addEventListener('click', () => { Auth.exportDB(Auth.currentUser()?.id); T('success', 'Backup descargado'); });
    document.getElementById('file-import').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const r = await Auth.importDB(f); T('success', 'Importado', r.users + ' usuarios'); go('home'); } catch(err) { T('error', 'JSON inválido', err.message); } });
    document.getElementById('btn-delete-profile').addEventListener('click', async () => {
      const u = Auth.currentUser(); if (!u) return;
      const r = await Swal.fire({ icon: 'warning', title: '¿Eliminar tu perfil?', showCancelButton: true, confirmButtonColor: '#F43F5E' });
      if (r.isConfirmed) { Auth.deleteProfile(u.id); T('success', 'Perfil eliminado'); go('home'); }
    });
    document.getElementById('btn-delete-account').addEventListener('click', async () => {
      const u = Auth.currentUser(); if (!u) return;
      const r = await Swal.fire({ icon: 'warning', title: '¿Eliminar tu cuenta?', text: 'Esta acción no se puede deshacer.', showCancelButton: true, confirmButtonColor: '#F43F5E' });
      if (r.isConfirmed) { Auth.deleteUser(u.id); T('success', 'Cuenta eliminada'); go('login'); }
    });

    // Admin
    document.getElementById('btn-admin-export').addEventListener('click', () => { Auth.exportDB(); T('success', 'Backup descargado'); });
    document.getElementById('file-admin-import').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const r = await Auth.importDB(f); T('success', 'Importado', r.users + ' usuarios'); go('login'); } catch(err) { T('error', 'JSON inválido', err.message); } });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
