/* ============================================================
   finance.js · Motor matemático de Finanzas Amigables (Vanilla)
   ============================================================ */
(function (global) {
  'use strict';

  // --- Conversión de tasas ---------------------------------------------
  /** Tasa Efectiva Anual (%) -> tasa mensual decimal. */
  function eaToMonthlyRate(eaPercent) {
    return Math.pow(1 + (eaPercent || 0) / 100, 1 / 12) - 1;
  }
  /** Devuelve tasa mensual según el tipo guardado. */
  function computeMonthlyRate(rate, rateType) {
    if (rateType === 'EA') return eaToMonthlyRate(rate);
    return (rate || 0) / 100; // ya mensual
  }

  // --- Amortización francesa (cuota fija) ------------------------------
  function frenchAmortization(principal, monthlyRate, n) {
    if (!principal || !n || n <= 0) return 0;
    if (!monthlyRate) return principal / n;
    const f = Math.pow(1 + monthlyRate, n);
    return (principal * monthlyRate * f) / (f - 1);
  }

  // --- Amortización alemana (cuota decreciente) ------------------------
  /** Devuelve la primera cuota (la mayor); aplicable a tarjetas si se
   *  modela amortización decreciente. */
  function germanFirstPayment(principal, monthlyRate, n) {
    if (!principal || !n) return 0;
    const capital = principal / n;
    return capital + principal * monthlyRate;
  }

  // --- Tabla de amortización (francesa) --------------------------------
  function amortTable(principal, monthlyRate, n) {
    const cuota = frenchAmortization(principal, monthlyRate, n);
    const rows = [];
    let balance = principal;
    let totalInt = 0, totalCap = 0;
    for (let i = 1; i <= n; i++) {
      const interest = balance * monthlyRate;
      const capital = cuota - interest;
      balance = Math.max(0, balance - capital);
      totalInt += interest;
      totalCap += capital;
      rows.push({ i, cuota, interest, capital, balance });
    }
    return { rows, cuota, totalInt, totalCap };
  }

  // --- Indicadores -----------------------------------------------------
  function computeSummary(profile, debts) {
    if (!profile) return null;
    const totalIncome = (profile.mainIncome || 0) + (profile.otherIncome || 0);
    const totalDebtPayments = (debts || []).reduce((s, d) => s + (d.monthlyPayment || 0), 0);
    const netIncome = totalIncome - (profile.fixedExpenses || 0);
    const debtPercentage = totalIncome > 0 ? (totalDebtPayments / totalIncome) * 100 : 0;
    const availableAmount = totalIncome - (profile.fixedExpenses || 0) - totalDebtPayments;
    const availablePercentage = totalIncome > 0 ? (availableAmount / totalIncome) * 100 : 0;
    let semaphore = 'ideal';
    if (debtPercentage > 40) semaphore = 'critical';
    else if (debtPercentage >= 30) semaphore = 'warning';
    return { totalIncome, totalDebtPayments, netIncome, debtPercentage, availableAmount, availablePercentage, semaphore };
  }

  // --- Estrategias de pago --------------------------------------------
  function simulateStrategy(ordered, surplus) {
    if (!ordered.length) return { orderedDebts: [], totalInterestPaid: 0, monthsToDebtFree: 0, firstDebtFreeMonths: 0 };
    let totalInterest = 0, month = 0, firstFree = 0;
    const balances = ordered.map(d => d.initialAmount || 0);
    const rates = ordered.map(d => d.monthlyRate || 0);
    const mins = ordered.map(d => d.monthlyPayment || 0);
    while (balances.some(b => b > 0.01) && month < 600) {
      month++;
      let extra = Math.max(surplus, 0);
      for (let i = 0; i < balances.length; i++) {
        if (balances[i] <= 0.01) continue;
        const interest = balances[i] * rates[i];
        totalInterest += interest;
        let pay = mins[i];
        if (i === balances.findIndex(b => b > 0.01)) { pay += extra; extra = 0; }
        balances[i] = balances[i] + interest - pay;
        if (balances[i] < 0.01) { balances[i] = 0; if (!firstFree) firstFree = month; }
      }
    }
    return { orderedDebts: ordered, totalInterestPaid: Math.round(totalInterest), monthsToDebtFree: month, firstDebtFreeMonths: firstFree };
  }
  function avalanche(debts, surplus) {
    return simulateStrategy([...debts].sort((a,b)=>(b.monthlyRate||0)-(a.monthlyRate||0)), surplus);
  }
  function snowball(debts, surplus) {
    return simulateStrategy([...debts].sort((a,b)=>(a.initialAmount||0)-(b.initialAmount||0)), surplus);
  }

  // --- Formato ---------------------------------------------------------
  const nf = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function formatCurrency(n) { return '$' + nf.format(Math.round(n || 0)); }
  function formatPercent(n) { return (n || 0).toFixed(1) + '%'; }
  function formatNumber(n) { return nf.format(n || 0); }

  /** Máscara para campos monetarios: muestra "1.500.000,00" en tiempo real. */
  function maskCurrency(raw) {
    if (!raw) return '';
    let cleaned = (raw || '').toString().replace(/[^0-9,]/g, '');
    const firstComma = cleaned.indexOf(',');
    if (firstComma !== -1) cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
    const [intPartRaw, decPartRaw] = cleaned.split(',');
    const intPart = (intPartRaw || '').replace(/^0+(?=\d)/, '');
    const intNum = parseInt(intPart || '0', 10);
    const intFormatted = isNaN(intNum) ? '' : intNum.toLocaleString('es-CO');
    if (decPartRaw === undefined) return intFormatted;
    return intFormatted + ',' + decPartRaw.slice(0, 2);
  }
  function unmaskCurrency(masked) {
    if (!masked) return 0;
    const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // --- Metadatos por tipo de deuda ------------------------------------
  const DEBT_META = {
    tarjeta_credito: { icon: 'fa-credit-card', color: '#EF4444', label: 'Tarjeta de Crédito', education: 'La tarjeta de crédito suele tener la tasa más alta del mercado. Procura pagar siempre el total, nunca el mínimo.' },
    consumo:         { icon: 'fa-cart-shopping', color: '#F59E0B', label: 'Consumo', education: 'Los créditos de consumo son de libre inversión. Compara siempre la Tasa Efectiva Anual (E.A.).' },
    libranza:        { icon: 'fa-file-signature', color: '#3B82F6', label: 'Libranza', education: 'La libranza se descuenta directamente de tu nómina: tasas bajas pero reduce tu liquidez.' },
    hipotecario:     { icon: 'fa-house', color: '#10B981', label: 'Hipotecario', education: 'La deuda "buena" por excelencia: construye patrimonio. Compara tasa fija vs. variable.' },
    leasing:         { icon: 'fa-file-contract', color: '#8B5CF6', label: 'Leasing', education: 'En leasing el bien no es tuyo hasta ejercer la opción de compra.' },
    vehiculo:        { icon: 'fa-car', color: '#06B6D4', label: 'Vehículo', education: 'El vehículo se deprecia desde el día uno. Cuota <= 15% de ingresos.' },
    adelanto_nomina: { icon: 'fa-bolt', color: '#DC2626', label: 'Adelanto Nómina', education: 'Adelantos y "gota a gota" tienen tasas altas. Solo emergencias.' },
    rotativo:        { icon: 'fa-arrows-rotate', color: '#D97706', label: 'Rotativo', education: 'Línea reutilizable: si lo mantienes al tope deja de ser respaldo.' },
  };
  function debtMeta(type) { return DEBT_META[type] || DEBT_META.consumo; }
  function debtTypes() { return Object.keys(DEBT_META).map(k => ({ value: k, label: DEBT_META[k].label })); }

  global.Finance = {
    eaToMonthlyRate, computeMonthlyRate, frenchAmortization, germanFirstPayment, amortTable,
    computeSummary, avalanche, snowball,
    formatCurrency, formatPercent, formatNumber, maskCurrency, unmaskCurrency,
    debtMeta, debtTypes, DEBT_META,
  };
})(window);
