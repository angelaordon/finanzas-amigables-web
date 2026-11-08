/* ============================================================
   auth.js · Registro, login, bloqueo, sesión, export/import
   ============================================================ */
(function (global) {
  'use strict';

  const LS = {
    USERS: 'fa_users',
    SESSION: 'fa_session',
    PROFILES: 'fa_profiles',
    DEBTS: 'fa_debts',
    LOCKOUT: 'fa_lockout',
    ATTEMPTS: 'fa_attempts',
  };
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_SECONDS = 60;

  // --- Helpers de storage ---
  function get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function uuid() { return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8); return v.toString(16); }); }

  // Hash simple (no criptográficamente fuerte, sólo para disuadir en local)
  async function hash(str) {
    if (global.crypto?.subtle) {
      const data = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }
    // fallback
    let h = 0; for (let i = 0; i < str.length; i++) { h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
    return String(h);
  }

  // --- Seed: usuarios demo y admin ---
  async function seedIfEmpty() {
    const users = get(LS.USERS, []);
    if (users.length) return;
    const now = new Date().toISOString();
    const admin = { id: uuid(), name: 'Administrador', email: 'admin', phone: '0000000000', passwordHash: await hash('admin'), isAdmin: 1, habeasDataAccepted: 1, createdAt: now, updatedAt: now };
    const demo  = { id: uuid(), name: 'María Demo',    email: 'maria@ejemplo.com', phone: '3001234567', passwordHash: await hash('demo123'), isAdmin: 0, habeasDataAccepted: 1, createdAt: now, updatedAt: now };
    set(LS.USERS, [admin, demo]);
    // Perfil + deudas demo
    const profile = { id: uuid(), userId: demo.id, mainIncome: 4500000, otherIncome: 500000, fixedExpenses: 1800000, createdAt: now, updatedAt: now };
    set(LS.PROFILES, [profile]);
    const mkDebt = (t, amt, rate, n, day) => {
      const meta = Finance.debtMeta(t);
      const mRate = Finance.computeMonthlyRate(rate, 'EA');
      return { id: uuid(), userId: demo.id, profileId: profile.id, debtType: t, debtTypeLabel: meta.label, initialAmount: amt, interestRate: rate, rateType: 'EA', numberOfInstallments: n, paymentDay: day, monthlyRate: mRate, monthlyPayment: Finance.frenchAmortization(amt, mRate, n), createdAt: now, updatedAt: now };
    };
    set(LS.DEBTS, [mkDebt('tarjeta_credito', 5000000, 28, 36, 15), mkDebt('consumo', 8000000, 18, 48, 5), mkDebt('vehiculo', 25000000, 14, 60, 20)]);
  }

  // --- Sesión ---
  function currentUser() {
    const sid = get(LS.SESSION, null);
    if (!sid) return null;
    return (get(LS.USERS, []).find(u => u.id === sid) || null);
  }
  function logout() { localStorage.removeItem(LS.SESSION); }

  // --- Lockout ---
  function lockoutRemaining() {
    const until = parseInt(localStorage.getItem(LS.LOCKOUT) || '0', 10);
    if (!until) return 0;
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) { localStorage.removeItem(LS.LOCKOUT); localStorage.removeItem(LS.ATTEMPTS); return 0; }
    return left;
  }

  // --- Login ---
  async function login(email, password) {
    const left = lockoutRemaining();
    if (left > 0) return { success: false, code: 'locked', error: 'Cuenta bloqueada por ' + left + 's' };
    const user = get(LS.USERS, []).find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
    if (!user) return registerAttempt({ success: false, code: 'user_not_found', error: 'El correo no está registrado' });
    const h = await hash(password);
    if (h !== user.passwordHash) return registerAttempt({ success: false, code: 'wrong_password', error: 'Contraseña incorrecta' });
    localStorage.removeItem(LS.ATTEMPTS);
    localStorage.removeItem(LS.LOCKOUT);
    set(LS.SESSION, user.id);
    return { success: true, user };
  }
  function registerAttempt(result) {
    const n = parseInt(localStorage.getItem(LS.ATTEMPTS) || '0', 10) + 1;
    localStorage.setItem(LS.ATTEMPTS, String(n));
    if (n >= MAX_ATTEMPTS) {
      localStorage.setItem(LS.LOCKOUT, String(Date.now() + LOCKOUT_SECONDS * 1000));
      result.locked = true;
      result.lockoutSeconds = LOCKOUT_SECONDS;
    } else {
      result.attemptsUsed = n;
      result.attemptsMax = MAX_ATTEMPTS;
    }
    return result;
  }

  // --- Registro ---
  async function register(data) {
    const users = get(LS.USERS, []);
    if (users.some(u => (u.email || '').toLowerCase() === (data.email || '').toLowerCase())) return { success: false, error: 'Este correo ya está registrado' };
    if ((data.password || '').length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    const now = new Date().toISOString();
    const user = { id: uuid(), name: data.name, email: data.email, phone: data.phone, passwordHash: await hash(data.password), isAdmin: 0, habeasDataAccepted: data.habeasDataAccepted ? 1 : 0, createdAt: now, updatedAt: now };
    users.push(user); set(LS.USERS, users);
    set(LS.SESSION, user.id);
    return { success: true, user };
  }

  // --- Recuperar contraseña ---
  async function recover(email, phone, newPassword) {
    const users = get(LS.USERS, []);
    const idx = users.findIndex(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
    if (idx === -1) return { success: false, error: 'Usuario no encontrado' };
    if (users[idx].phone !== phone) return { success: false, error: 'El teléfono no coincide' };
    users[idx].passwordHash = await hash(newPassword); users[idx].updatedAt = new Date().toISOString();
    set(LS.USERS, users);
    return { success: true };
  }

  // --- CRUD financiero ---
  function getProfile(userId) { return get(LS.PROFILES, []).find(p => p.userId === userId) || null; }
  function upsertProfile(data) {
    const now = new Date().toISOString();
    const profiles = get(LS.PROFILES, []);
    const idx = profiles.findIndex(p => p.userId === data.userId);
    if (idx >= 0) { profiles[idx] = { ...profiles[idx], ...data, updatedAt: now }; }
    else { profiles.push({ id: uuid(), ...data, createdAt: now, updatedAt: now }); }
    set(LS.PROFILES, profiles);
    return profiles.find(p => p.userId === data.userId);
  }
  function getDebts(userId) { return get(LS.DEBTS, []).filter(d => d.userId === userId); }
  function saveDebts(userId, profileId, list) {
    const now = new Date().toISOString();
    const all = get(LS.DEBTS, []).filter(d => d.userId !== userId);
    (list || []).forEach(d => all.push({ id: uuid(), userId, profileId, ...d, createdAt: now, updatedAt: now }));
    set(LS.DEBTS, all);
  }
  function deleteProfile(userId) {
    set(LS.PROFILES, get(LS.PROFILES, []).filter(p => p.userId !== userId));
    set(LS.DEBTS, get(LS.DEBTS, []).filter(d => d.userId !== userId));
  }
  function deleteUser(userId) {
    deleteProfile(userId);
    set(LS.USERS, get(LS.USERS, []).filter(u => u.id !== userId));
    if (get(LS.SESSION, null) === userId) logout();
  }
  async function changePassword(userId, current, next) {
    const users = get(LS.USERS, []);
    const u = users.find(x => x.id === userId);
    if (!u) return { success: false, error: 'Usuario no encontrado' };
    const curH = await hash(current);
    if (curH !== u.passwordHash) return { success: false, error: 'Contraseña actual incorrecta' };
    if ((next || '').length < 6) return { success: false, error: 'Mínimo 6 caracteres' };
    u.passwordHash = await hash(next); u.updatedAt = new Date().toISOString();
    set(LS.USERS, users);
    return { success: true };
  }

  // --- Export / Import JSON ---
  function exportDB(onlyUserId) {
    const users = onlyUserId ? get(LS.USERS, []).filter(u => u.id === onlyUserId) : get(LS.USERS, []);
    const profiles = onlyUserId ? get(LS.PROFILES, []).filter(p => p.userId === onlyUserId) : get(LS.PROFILES, []);
    const debts = onlyUserId ? get(LS.DEBTS, []).filter(d => d.userId === onlyUserId) : get(LS.DEBTS, []);
    const payload = {
      _guia_de_uso: {
        descripcion: 'Backup completo de Finanzas Amigables (versión web).',
        version: '1.0-web', fecha: new Date().toISOString(),
        estructura: 'usuarios, perfiles_financieros, deudas',
        _diccionario_campos: {
          usuarios: 'id, name, email, phone, passwordHash (SHA-256), habeasDataAccepted, isAdmin, createdAt, updatedAt',
          perfiles_financieros: 'id, userId, mainIncome (ingreso principal mensual), otherIncome, fixedExpenses, createdAt, updatedAt',
          deudas: 'id, userId, profileId, debtType, debtTypeLabel, initialAmount, interestRate (%), rateType (EA|MONTHLY), numberOfInstallments, paymentDay (1-31), monthlyRate, monthlyPayment, createdAt, updatedAt',
        },
      },
      _descripcion_tabla_usuarios: 'Lista de usuarios registrados.',
      usuarios: users,
      _descripcion_tabla_perfiles: 'Perfil financiero por usuario.',
      perfiles_financieros: profiles,
      _descripcion_tabla_deudas: 'Deudas por usuario.',
      deudas: debts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finanzas_amigables_backup_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importDB(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    const users = data.usuarios || data.users || [];
    const profiles = data.perfiles_financieros || data.financial_profiles || [];
    const debts = data.deudas || data.debts || [];
    if (!Array.isArray(users) || !Array.isArray(profiles) || !Array.isArray(debts)) throw new Error('Formato inválido');
    set(LS.USERS, users); set(LS.PROFILES, profiles); set(LS.DEBTS, debts);
    return { users: users.length, profiles: profiles.length, debts: debts.length };
  }

  global.Auth = {
    LS, MAX_ATTEMPTS, LOCKOUT_SECONDS,
    seedIfEmpty, currentUser, logout, lockoutRemaining,
    login, register, recover,
    getProfile, upsertProfile, getDebts, saveDebts,
    deleteProfile, deleteUser, changePassword,
    exportDB, importDB,
    _get: get, _set: set, _uuid: uuid,
  };
})(window);
