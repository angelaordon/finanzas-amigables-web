/* ============================================================
   dashboard.js · Render de resumen, gráficas (Chart.js) y PDF (jsPDF)
   ============================================================ */
(function (global) {
  'use strict';

  let pieChart = null, barChart = null;

  function renderSummary(container, summary) {
    if (!container) return;
    if (!summary) { container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-wallet fa-2x muted"></i><p>Aún no has configurado tu perfil financiero.</p><button class="btn-primary" data-nav="wizard">Comenzar</button></div>'; return; }
    const semColor = summary.semaphore === 'critical' ? 'var(--danger)' : summary.semaphore === 'warning' ? 'var(--warning)' : 'var(--success)';
    container.innerHTML = `
      <span class="semaphore-badge" style="background:${semColor}">${Finance.formatPercent(summary.debtPercentage)} endeudamiento</span>
      <div class="metrics-row">
        <div class="metric"><div class="v">${Finance.formatCurrency(summary.totalIncome)}</div><div class="l">Ingreso Total</div></div>
        <div class="metric"><div class="v">${Finance.formatCurrency(summary.totalDebtPayments)}</div><div class="l">Cuotas</div></div>
        <div class="metric"><div class="v">${Finance.formatCurrency(summary.availableAmount)}</div><div class="l">Disponible</div></div>
      </div>`;
  }

  function renderDiagnosis(container, summary) {
    const semColor = summary.semaphore === 'critical' ? 'var(--danger)' : summary.semaphore === 'warning' ? 'var(--warning)' : 'var(--success)';
    const msg = summary.semaphore === 'critical' ? 'Alerta: tu endeudamiento es crítico'
              : summary.semaphore === 'warning'  ? 'Precaución: tu endeudamiento requiere atención'
              : 'Tu nivel de endeudamiento es saludable';
    container.innerHTML = `
      <h3>Diagnóstico de Endeudamiento</h3>
      <span class="semaphore-badge" style="background:${semColor}">${msg}</span>
      <div class="metrics-row" style="flex-wrap:wrap;gap:10px;">
        <div class="metric"><i class="fa-solid fa-sack-dollar" style="color:var(--success)"></i><div class="v">${Finance.formatCurrency(summary.netIncome)}</div><div class="l">Ingreso Neto</div></div>
        <div class="metric"><i class="fa-solid fa-receipt" style="color:var(--warning)"></i><div class="v">${Finance.formatCurrency(summary.totalDebtPayments)}</div><div class="l">Total Cuotas</div></div>
        <div class="metric"><i class="fa-solid fa-percent" style="color:var(--primary)"></i><div class="v">${Finance.formatPercent(summary.debtPercentage)}</div><div class="l">% Endeudamiento</div></div>
        <div class="metric"><i class="fa-solid fa-wallet" style="color:var(--primary)"></i><div class="v">${Finance.formatCurrency(summary.availableAmount)}</div><div class="l">Disponible</div></div>
      </div>`;
  }

  function renderCharts(profile, debts, summary) {
    const total = summary.totalIncome || 1;
    const fixed = profile.fixedExpenses || 0;
    const cuotas = summary.totalDebtPayments || 0;
    const avail = Math.max(0, summary.availableAmount);

    // Pie
    const pieCtx = document.getElementById('chart-pie');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels: ['Gastos Fijos', 'Cuotas Deudas', 'Disponible'], datasets: [{ data: [fixed, cuotas, avail], backgroundColor: ['#F59E0B', '#EF4444', '#10B981'], borderWidth: 2, borderColor: '#FFF' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });

    // Bars
    const barCtx = document.getElementById('chart-bars');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: debts.map(d => d.debtTypeLabel),
        datasets: [{ label: 'Cuota mensual', data: debts.map(d => d.monthlyPayment), backgroundColor: debts.map(d => Finance.debtMeta(d.debtType).color) }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => Finance.formatCurrency(v) } } } },
    });
  }

  function renderStrategies(container, debts, summary) {
    if (!debts.length) { container.innerHTML = ''; return; }
    const surplus = Math.max(0, summary.availableAmount);
    const av = Finance.avalanche(debts, surplus);
    const sn = Finance.snowball(debts, surplus);
    const hasSurplus = surplus > 0;
    if (!hasSurplus) {
      container.innerHTML = `<h3>Medidas de Emergencia</h3>
        <p><i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i> <b>Consolidación</b>: unifica tus deudas en un solo crédito con menor tasa.</p>
        <p><i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i> <b>Refinanciación</b>: negocia plazos más largos para reducir la cuota.</p>
        <p><i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i> <b>Negociación</b>: contacta a tus acreedores para acuerdos de pago.</p>`;
      return;
    }
    container.innerHTML = `<h3>Estrategias de Optimización</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;border:1.5px solid var(--primary);border-radius:8px;padding:12px;">
          <b style="color:var(--primary)">Avalancha</b>
          <p class="small muted">Mayor tasa primero</p>
          ${av.orderedDebts.map((d,i)=>`<div>${i+1}. ${d.debtTypeLabel}</div>`).join('')}
          <p class="small">Interés total: ${Finance.formatCurrency(av.totalInterestPaid)}</p>
          <p class="small">${av.monthsToDebtFree} meses</p>
        </div>
        <div style="flex:1;min-width:220px;border:1.5px solid #10B981;border-radius:8px;padding:12px;">
          <b style="color:#10B981">Bola de Nieve</b>
          <p class="small muted">Menor saldo primero</p>
          ${sn.orderedDebts.map((d,i)=>`<div>${i+1}. ${d.debtTypeLabel}</div>`).join('')}
          <p class="small">Primera libre: ${sn.firstDebtFreeMonths} meses</p>
          <p class="small">${sn.monthsToDebtFree} meses total</p>
        </div>
      </div>`;
  }

  async function downloadPDF(user, profile, debts, summary) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    // Portada azul
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, W, 110, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text('Informe Financiero', 32, 50);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Usuario: ' + (user?.name || 'Usuario'), 32, 72);
    doc.text('Correo: ' + (user?.email || ''), 32, 88);
    doc.text('Fecha: ' + new Date().toLocaleDateString('es-CO'), 32, 104);

    doc.setTextColor(15, 23, 42);
    let y = 140;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Resumen Ejecutivo', 32, y); y += 10;

    const semMsg = summary.semaphore === 'critical' ? 'Endeudamiento crítico' : summary.semaphore === 'warning' ? 'Endeudamiento en alerta' : 'Endeudamiento saludable';
    doc.autoTable({
      startY: y + 5,
      head: [['Métrica', 'Valor']],
      body: [
        ['Ingreso total', Finance.formatCurrency(summary.totalIncome)],
        ['Gastos fijos', Finance.formatCurrency(profile.fixedExpenses)],
        ['Total cuotas de deuda', Finance.formatCurrency(summary.totalDebtPayments)],
        ['% Endeudamiento', Finance.formatPercent(summary.debtPercentage)],
        ['Disponible', Finance.formatCurrency(summary.availableAmount)],
        ['Diagnóstico', semMsg],
      ],
      headStyles: { fillColor: [29, 78, 216] },
    });
    y = doc.lastAutoTable.finalY + 20;

    // Gráficas Chart.js como imágenes base64
    try {
      const pieImg = pieChart?.toBase64Image();
      const barImg = barChart?.toBase64Image();
      if (pieImg) { doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Radiografía Financiera', 32, y); y += 10; doc.addImage(pieImg, 'PNG', 32, y, 240, 180); }
      if (barImg) { doc.addImage(barImg, 'PNG', 290, y, 260, 180); }
      y += 200;
    } catch (e) {}

    // Deudas: ficha + plan
    for (const d of debts) {
      if (y > 680) { doc.addPage(); y = 40; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(d.debtTypeLabel, 32, y); y += 4;
      doc.autoTable({
        startY: y + 4,
        body: [
          ['Monto inicial', Finance.formatCurrency(d.initialAmount)],
          ['Tasa', d.interestRate + '% ' + (d.rateType === 'EA' ? 'E.A.' : 'Mensual')],
          ['Tasa mensual', (d.monthlyRate * 100).toFixed(4) + '%'],
          ['Número de cuotas', String(d.numberOfInstallments)],
          ['Día de pago', 'Día ' + d.paymentDay],
          ['Cuota mensual', Finance.formatCurrency(d.monthlyPayment)],
        ],
        theme: 'grid', styles: { fontSize: 9 },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Plan de pagos (primeras 12)
      const table = Finance.amortTable(d.initialAmount, d.monthlyRate, d.numberOfInstallments);
      const shown = table.rows.slice(0, 12).map(r => [r.i, Finance.formatCurrency(r.cuota), Finance.formatCurrency(r.interest), Finance.formatCurrency(r.capital), Finance.formatCurrency(r.balance)]);
      doc.autoTable({
        startY: y,
        head: [['#', 'Cuota', 'Interés', 'Capital', 'Saldo']],
        body: shown,
        foot: [['Total', Finance.formatCurrency(table.cuota * d.numberOfInstallments), Finance.formatCurrency(table.totalInt), Finance.formatCurrency(table.totalCap), '—']],
        headStyles: { fillColor: [29, 78, 216] }, styles: { fontSize: 8 },
      });
      y = doc.lastAutoTable.finalY + 16;
    }

    // Pie
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(9); doc.setTextColor(100);
      doc.text('Finanzas Amigables · Universidad de Caldas · Fines académicos · Datos 100% locales', 32, 820);
      doc.text('Pág. ' + i + ' / ' + pages, W - 80, 820);
    }

    doc.save('informe_financiero_' + Date.now() + '.pdf');
  }

  global.Dashboard = { renderSummary, renderDiagnosis, renderCharts, renderStrategies, downloadPDF };
})(window);
