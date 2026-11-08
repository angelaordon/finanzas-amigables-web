# Finanzas Amigables · Versión Web (HTML5 + CSS3 + Vanilla JS)

Migración **100% estática** de la app móvil Finanzas Amigables. Sin frameworks, sin backend: todo corre en el navegador y toda la data vive en `localStorage`.

## 📁 Archivos
```
finanzas_amigables_web/
├── index.html      ← Estructura semantica (todas las vistas)
├── styles.css      ← Design system responsive (mobile-first)
├── finance.js      ← Motor matemático (amortización, tasas, máscaras)
├── auth.js         ← Login, registro, bloqueo, CRUD en localStorage, export/import JSON
├── dashboard.js    ← Render resumen + Chart.js + jsPDF
├── app.js          ← Router SPA y bindings de UI
├── server.py       ← Servidor estático Python (opcional)
└── README.md
```

## 🚀 Ejecutar en local

### Opción A — Abrir directamente (`file://`)
Doble clic en `index.html`. **Funciona** en Chrome/Firefox/Edge modernos, pero algunos navegadores restringen `localStorage` bajo `file://`; si lo notas vacío, usa la Opción B.

### Opción B — Servidor Python (recomendado)
```bash
cd finanzas_amigables_web
python3 server.py            # http://localhost:8000
# o con puerto distinto:
python3 server.py 8080
```

### Opción C — Google Colab / Jupyter
```python
!git clone https://github.com/<tu-usuario>/finanzas-amigables-web.git
%cd finanzas-amigables-web
!python3 server.py 8080 &
from google.colab.output import eval_js
print(eval_js('google.colab.kernel.proxyPort(8080)'))
```

## 🌐 Desplegar en GitHub Pages
1. Crea un repositorio nuevo, p.ej. `finanzas-amigables-web`.
2. Sube los archivos:
   ```bash
   cd finanzas_amigables_web
   git init
   git add .
   git commit -m "Finanzas Amigables - versión web"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/finanzas-amigables-web.git
   git push -u origin main
   ```
3. En GitHub → **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main` / carpeta `/root`
   - Guarda. A los 30-60 segundos la app estará en `https://<tu-usuario>.github.io/finanzas-amigables-web/`

## 👥 Usuarios de prueba (creados automáticamente)
- **Admin:** `admin` / `admin`
- **Demo:** `maria@ejemplo.com` / `demo123` (con perfil financiero + 3 deudas precargadas)

## ✨ Funcionalidades replicadas desde la app móvil
- Registro, login con **bloqueo tras 3 intentos fallidos (60 s)** y mensajes diferenciados.
- Vistas: **Tu información financiera** (wizard), **Indicador Financiero** (dashboard), Configuración, Admin.
- **Máscara numérica** en tiempo real (`$ 1.500.000,00`).
- Motor de amortización: francesa (cuota fija), alemana (decreciente), conversión E.A. → mensual.
- Estrategias **Avalancha** y **Bola de Nieve** con simulación mes a mes.
- Semáforo de endeudamiento (Ideal <30%, Alerta 30-40%, Crítico >40%).
- Gráficos interactivos con **Chart.js** (doughnut + bar).
- **PDF profesional** con `jsPDF` + `jspdf-autotable` que incluye portada, resumen, gráficas en base64 y tabla de amortización por deuda.
- **Export/Import JSON** documentado en español (compatible con la app móvil).
- Sección de privacidad + autoría.

## 🔒 Privacidad
Todos los datos se guardan en `localStorage` del navegador del usuario. Nada se envía a servidores externos. Fines estrictamente académicos — Universidad de Caldas.

## 📋 Dependencias (todas vía CDN, sin build)
- [Chart.js 4](https://www.chartjs.org/)
- [jsPDF 2](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- [SweetAlert2 11](https://sweetalert2.github.io/)
- [FontAwesome 6](https://fontawesome.com/)
