/* ============================================================
   RECIBO — app de gastos local-first
   Todo vive en localStorage. Sin cuentas, sin backend.
   ============================================================ */

const STORAGE_KEY = 'recibo_data_v1';

const DEFAULT_CATEGORIES = [
  { id:'comida',     name:'Comer afuera', emoji:'🍔', keywords:['tacos','comida','restaurante','antojitos','torta','pizza','comer','cafe','café','desayuno','comida afuera','almuerzo','cena'] },
  { id:'super',       name:'Súper',        emoji:'🥑', keywords:['super','súper','walmart','costco','soriana','chedraui','mercado','despensa','oxxo','7eleven'] },
  { id:'transporte',  name:'Transporte',   emoji:'🚗', keywords:['uber','didi','gasolina','taxi','metro','camion','camión','estacionamiento','tag','peaje'] },
  { id:'casa',        name:'Hogar',        emoji:'🏠', keywords:['renta','luz','agua','gas','internet','mantenimiento','hogar'] },
  { id:'suscripcion', name:'Suscripciones',emoji:'🌐', keywords:['netflix','spotify','suscripcion','suscripción','disney','hbo','amazon prime','icloud'] },
  { id:'ropa',        name:'Ropa',         emoji:'👖', keywords:['ropa','playera','pantalon','pantalón','zapatos','tenis'] },
  { id:'salud',       name:'Salud',        emoji:'💊', keywords:['farmacia','doctor','medicina','consulta','dentista','gimnasio','gym'] },
  { id:'diversion',   name:'Diversión',    emoji:'🎮', keywords:['cine','boletos','discoteca','bar','fiesta','antro','juego'] },
  { id:'otro',        name:'Otro',         emoji:'💎', keywords:[] },
];

const DEFAULT_LISTS = [
  { id:'personal', name:'Personal', emoji:'🤫' },
];

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error('Error cargando datos', e); }
  return {
    lists: DEFAULT_LISTS,
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    activeListId: 'personal',
    period: 'month',
  };
}

function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();
if(!state.period) state.period = 'month';

/* ---------------- utils ---------------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function fmtMoney(n){
  const v = Math.round(n*100)/100;
  return v.toLocaleString('es-MX', { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

function todayISO(){ return new Date().toISOString().slice(0,10); }

function dayLabel(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate()-1);
  const dCompare = new Date(d); dCompare.setHours(0,0,0,0);
  if(dCompare.getTime() === today.getTime()) return 'Hoy';
  if(dCompare.getTime() === yest.getTime()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function getCategory(id){
  return state.categories.find(c=>c.id===id) || state.categories.find(c=>c.id==='otro');
}
function getList(id){
  return state.lists.find(l=>l.id===id) || state.lists[0];
}

/* ---------------- period filtering ---------------- */
function periodRange(period){
  const now = new Date();
  let start, end;
  if(period === 'week'){
    const day = now.getDay() === 0 ? 7 : now.getDay();
    start = new Date(now); start.setDate(now.getDate() - day + 1); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  } else if(period === 'month'){
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
  } else if(period === 'year'){
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23,59,59,999);
  } else {
    start = new Date(2000,0,1);
    end = new Date(2100,0,1);
  }
  return { start, end };
}

function txInRange(tx, start, end){
  const d = new Date(tx.date + 'T12:00:00');
  return d >= start && d <= end;
}

function currentListTx(){
  return state.transactions.filter(t => t.listId === state.activeListId);
}

function periodTx(){
  const { start, end } = periodRange(state.period);
  return currentListTx().filter(t => txInRange(t, start, end));
}

/* ============================================================
   RENDER
   ============================================================ */

function renderAll(){
  renderTopbar();
  renderHero();
  renderBars();
  renderLedger();
  renderCategoryChips();
  renderEntryListChips();
}

function renderTopbar(){
  document.getElementById('currentListName').textContent = getList(state.activeListId).name;
}

function renderHero(){
  const txs = periodTx();
  const total = txs.reduce((sum,t)=> sum + (t.type==='expense' ? t.amount : -t.amount), 0);
  document.getElementById('heroTotal').textContent = fmtMoney(total);

  const labels = { week:'Esta semana', month:'Este mes', year:'Este año', all:'Todo' };
  document.getElementById('periodLabel').textContent = labels[state.period];

  const { start, end } = periodRange(state.period);
  const opts = { day:'numeric', month:'short' };
  if(state.period === 'all'){
    document.getElementById('periodDates').textContent = `${getList(state.activeListId).name}`;
  } else {
    document.getElementById('periodDates').textContent =
      `${start.toLocaleDateString('es-MX',opts)} – ${end.toLocaleDateString('es-MX',opts)}`;
  }
}

function renderBars(){
  const txs = periodTx().filter(t=>t.type==='expense');
  const byCategory = {};
  txs.forEach(t=>{
    byCategory[t.categoryId] = (byCategory[t.categoryId]||0) + t.amount;
  });
  const entries = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const max = entries.length ? entries[0][1] : 1;

  const row = document.getElementById('barsRow');
  if(!entries.length){
    row.innerHTML = '';
    return;
  }
  row.innerHTML = entries.map(([catId, amt])=>{
    const cat = getCategory(catId);
    const pct = Math.max(8, Math.round((amt/max)*100));
    return `
      <div class="bar-chip">
        <div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div>
        <div class="emoji">${cat.emoji}</div>
        <div class="amt">${fmtMoneyShort(amt)}</div>
      </div>`;
  }).join('');
}

function fmtMoneyShort(n){
  if(n >= 1000) return (n/1000).toFixed(n>=10000?0:1).replace('.0','') + 'k';
  return Math.round(n).toString();
}

function renderLedger(){
  const txs = periodTx().slice().sort((a,b)=> (b.date+b.id).localeCompare(a.date+a.id));
  const ledger = document.getElementById('ledger');

  if(!txs.length){
    ledger.innerHTML = `
      <div class="empty-state">
        <div class="glyph">🧾</div>
        <div class="title">Sin movimientos</div>
        <div class="sub">Mantén presionado el micrófono y di algo como "tacos afuera por 230 pesos", o usa el botón ＋ para agregar a mano.</div>
      </div>`;
    return;
  }

  const groups = {};
  txs.forEach(t=>{
    if(!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  const dayTotalsHtml = Object.entries(groups).map(([date, items])=>{
    const dayTotal = items.reduce((s,t)=> s + (t.type==='expense'? t.amount : -t.amount), 0);
    const rows = items.map(t=> txRowHtml(t)).join('');
    return `
      <div class="day-group">
        <div class="day-label">
          <span>${dayLabel(date)}</span>
          <span>$${fmtMoney(dayTotal)}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');

  ledger.innerHTML = dayTotalsHtml;

  ledger.querySelectorAll('.tx-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const id = row.dataset.id;
      openEntrySheetForEdit(id);
    });
  });
}

function txRowHtml(t){
  const cat = getCategory(t.categoryId);
  const isIncome = t.type === 'income';
  return `
    <div class="tx-row" data-id="${t.id}">
      <div class="tx-emoji">${cat.emoji}</div>
      <div class="tx-mid">
        <div class="tx-desc">${escapeHtml(t.description)}</div>
        <div class="tx-meta">
          <span class="tx-tag">${cat.name}</span>
          ${t.recurring ? `<span class="tx-tag">🔁 ${recurLabel(t.recurFreq)}</span>` : ''}
        </div>
      </div>
      <div class="tx-amt ${isIncome?'income':''}">${isIncome?'+':'−'}$${fmtMoney(t.amount)}</div>
    </div>`;
}

function recurLabel(freq){
  return { monthly:'mensual', weekly:'semanal', yearly:'anual' }[freq] || '';
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderCategoryChips(){
  const scroll = document.getElementById('catScroll');
  scroll.innerHTML = state.categories.map(c=>`
    <div class="cat-chip" data-cat="${c.id}">${c.emoji} ${c.name}</div>
  `).join('') + `<div class="cat-chip add-new" id="addCatChip">＋ Nueva</div>`;

  scroll.querySelectorAll('.cat-chip[data-cat]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      scroll.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedCategoryId = chip.dataset.cat;
    });
  });
  document.getElementById('addCatChip').addEventListener('click', addNewCategoryFlow);
}

function addNewCategoryFlow(){
  const name = prompt('Nombre de la categoría:');
  if(!name || !name.trim()) return;
  const emoji = prompt('Un emoji para representarla (ej. 🎯):', '🏷️') || '🏷️';
  const id = 'cat_' + uid();
  state.categories.push({ id, name: name.trim(), emoji: emoji.trim(), keywords:[] });
  saveData();
  renderCategoryChips();
  selectedCategoryId = id;
  const scroll = document.getElementById('catScroll');
  const chip = scroll.querySelector(`[data-cat="${id}"]`);
  if(chip){ scroll.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected')); chip.classList.add('selected'); }
}

function renderEntryListChips(){
  const scroll = document.getElementById('entryListScroll');
  scroll.innerHTML = state.lists.map(l=>`
    <div class="list-chip" data-list="${l.id}">${l.emoji} ${l.name}</div>
  `).join('');
  scroll.querySelectorAll('.list-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      scroll.querySelectorAll('.list-chip').forEach(c=>c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedListId = chip.dataset.list;
    });
  });
  // default select active list
  const activeChip = scroll.querySelector(`[data-list="${selectedListId || state.activeListId}"]`);
  if(activeChip){ activeChip.classList.add('selected'); }
}

function renderListManager(){
  const wrap = document.getElementById('listManageRows');
  wrap.innerHTML = state.lists.map(l=>{
    const count = state.transactions.filter(t=>t.listId===l.id).length;
    return `
    <div class="manage-row" data-list="${l.id}">
      <div class="emoji">${l.emoji}</div>
      <div class="name">${escapeHtml(l.name)}</div>
      ${l.id === state.activeListId ? '<div class="check">✓</div>' : ''}
      ${state.lists.length > 1 ? `<div class="del" data-del="${l.id}">eliminar</div>` : ''}
    </div>`;
  }).join('');

  wrap.querySelectorAll('.manage-row').forEach(row=>{
    row.addEventListener('click', (e)=>{
      if(e.target.dataset.del) return;
      state.activeListId = row.dataset.list;
      saveData();
      renderAll();
      renderListManager();
      closeSheet('listSheet');
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = btn.dataset.del;
      const list = getList(id);
      const count = state.transactions.filter(t=>t.listId===id).length;
      const msg = count > 0
        ? `"${list.name}" tiene ${count} movimiento(s). ¿Eliminar la lista y todos sus movimientos?`
        : `¿Eliminar la lista "${list.name}"?`;
      if(!confirm(msg)) return;
      state.transactions = state.transactions.filter(t=>t.listId !== id);
      state.lists = state.lists.filter(l=>l.id !== id);
      if(state.activeListId === id) state.activeListId = state.lists[0].id;
      saveData();
      renderAll();
      renderListManager();
    });
  });
}

/* ============================================================
   VOICE PARSER (Español)
   Frase típica: "tacos afuera por 230" / "230 pesos en uber"
   / "gasté 89.50 en super" / "netflix 199 mensual"
   ============================================================ */

function parseVoiceInput(raw){
  let text = raw.trim().toLowerCase();
  let isIncome = false;

  // detectar ingreso vs gasto
  const incomeWords = ['ingreso','recibí','recibi','me pagaron','deposito','depósito','cobré','cobre','gané','gane'];
  if(incomeWords.some(w => text.includes(w))) isIncome = true;

  // extraer monto: prioriza números con separador de miles (1,200.50 / 1.200),
  // si no hay, cae a un entero/decimal simple (1200 / 89.50)
  const AMOUNT_RE = /(\d{1,3}(?:[,.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(pesos|peso|mxn|\$)?/;
  const amountMatch = text.match(AMOUNT_RE);
  let amount = null;
  if(amountMatch){
    let numStr = amountMatch[1];
    // si tiene múltiples separadores o uno seguido de 3 dígitos, son miles -> quitar
    // si solo tiene un separador seguido de 1-2 dígitos, es decimal -> normalizar a punto
    const parts = numStr.split(/[,.]/);
    if(parts.length > 1 && parts[parts.length-1].length <= 2 && !(parts.length===2 && parts[1].length===3)){
      numStr = parts.slice(0,-1).join('') + '.' + parts[parts.length-1];
    } else {
      numStr = parts.join('');
    }
    amount = parseFloat(numStr);
  }

  // quitar la parte numérica + palabras de conexión para quedarnos con la descripción
  let desc = text
    .replace(AMOUNT_RE, '')
    .replace(/\b(por|de|en|con|gasté|gaste|pagué|pague|compré|compre|ingreso|recibí|recibi|me pagaron|deposito|depósito|cobré|cobre|gané|gane)\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if(!desc) desc = isIncome ? 'Ingreso' : 'Gasto';
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  // detectar recurrencia hablada
  let recurring = false, recurFreq = 'monthly';
  if(/\bmensual\b|\bcada mes\b/.test(text)){ recurring = true; recurFreq = 'monthly'; }
  if(/\bsemanal\b|\bcada semana\b/.test(text)){ recurring = true; recurFreq = 'weekly'; }
  if(/\banual\b|\bcada año\b/.test(text)){ recurring = true; recurFreq = 'yearly'; }
  if(recurring){
    desc = desc.replace(/\b(mensual|cada mes|semanal|cada semana|anual|cada año)\b/g,'').trim();
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  // detectar categoría por keywords
  let categoryId = 'otro';
  let bestScore = 0;
  state.categories.forEach(cat=>{
    (cat.keywords||[]).forEach(kw=>{
      if(text.includes(kw) && kw.length > bestScore){
        bestScore = kw.length;
        categoryId = cat.id;
      }
    });
  });

  return {
    description: desc || (isIncome ? 'Ingreso' : 'Gasto'),
    amount: amount || 0,
    categoryId,
    type: isIncome ? 'income' : 'expense',
    recurring,
    recurFreq,
  };
}

/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

let recognition = null;
let isListening = false;

function initSpeechRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    return null;
  }
  const r = new SR();
  r.lang = 'es-MX';
  r.continuous = false;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

function startListening(){
  recognition = initSpeechRecognition();
  const micBtn = document.getElementById('micBtn');

  if(!recognition){
    showToast('Tu navegador no soporta voz — usa el formulario manual');
    openEntrySheetManual();
    return;
  }

  isListening = true;
  micBtn.classList.add('listening');
  openEntrySheetVoice();

  let finalTranscript = '';

  recognition.onresult = (event)=>{
    let interim = '';
    for(let i = event.resultIndex; i < event.results.length; i++){
      const transcript = event.results[i][0].transcript;
      if(event.results[i].isFinal){
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    document.getElementById('voiceTranscript').textContent = finalTranscript + interim || 'Escuchando…';
  };

  recognition.onerror = (e)=>{
    console.error('speech error', e);
    stopListeningUI();
    if(e.error === 'not-allowed' || e.error === 'permission-denied'){
      showToast('Necesitas permitir el micrófono');
      closeSheet('entrySheet');
    } else if(e.error === 'no-speech'){
      showToast('No escuché nada, intenta de nuevo');
      closeSheet('entrySheet');
    } else {
      showToast('No se pudo usar el micrófono');
      closeSheet('entrySheet');
    }
  };

  recognition.onend = ()=>{
    stopListeningUI();
    if(finalTranscript.trim()){
      handleVoiceResult(finalTranscript.trim());
    } else {
      closeSheet('entrySheet');
    }
  };

  try{
    recognition.start();
  }catch(e){
    console.error(e);
    stopListeningUI();
  }
}

function stopListening(){
  if(recognition && isListening){
    recognition.stop();
  }
}

function stopListeningUI(){
  isListening = false;
  document.getElementById('micBtn').classList.remove('listening');
}

function handleVoiceResult(transcript){
  const parsed = parseVoiceInput(transcript);
  document.getElementById('voiceHint').textContent = 'Listo, revisa y guarda';

  // populate manual form with parsed data, switch view to manual form for confirmation
  document.getElementById('voiceStage').style.display = 'none';
  document.getElementById('manualForm').style.display = 'block';

  populateFormFromParsed(parsed);
  showToast('Entendido ✓');
}

function populateFormFromParsed(parsed){
  editingTxId = null;
  document.getElementById('entrySheetTitle').textContent = 'Confirma el movimiento';
  document.getElementById('descInput').value = parsed.description;
  document.getElementById('amountInput').value = parsed.amount || '';

  setTxType(parsed.type);

  selectedCategoryId = parsed.categoryId;
  const scroll = document.getElementById('catScroll');
  scroll.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected'));
  const chip = scroll.querySelector(`[data-cat="${parsed.categoryId}"]`);
  if(chip) chip.classList.add('selected');

  const recurToggle = document.getElementById('recurToggle');
  const recurFreqSelect = document.getElementById('recurFreq');
  if(parsed.recurring){
    recurToggle.classList.add('on');
    recurFreqSelect.disabled = false;
    recurFreqSelect.value = parsed.recurFreq;
  } else {
    recurToggle.classList.remove('on');
    recurFreqSelect.disabled = true;
  }

  document.getElementById('deleteTxBtn').style.display = 'none';
  document.getElementById('descInput').focus();
}

/* ============================================================
   ENTRY SHEET (manual + voice shared)
   ============================================================ */

let selectedCategoryId = null;
let selectedListId = null;
let selectedType = 'expense';
let editingTxId = null;

function setTxType(type){
  selectedType = type;
  document.getElementById('typeExpenseBtn').classList.toggle('active', type==='expense');
  document.getElementById('typeIncomeBtn').classList.toggle('active', type==='income');
}

function openEntrySheetManual(){
  editingTxId = null;
  document.getElementById('entrySheetTitle').textContent = 'Nuevo movimiento';
  document.getElementById('voiceStage').style.display = 'none';
  document.getElementById('manualForm').style.display = 'block';
  document.getElementById('descInput').value = '';
  document.getElementById('amountInput').value = '';
  setTxType('expense');
  selectedCategoryId = null;
  selectedListId = state.activeListId;
  document.getElementById('catScroll').querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected'));
  renderEntryListChips();
  document.getElementById('recurToggle').classList.remove('on');
  document.getElementById('recurFreq').disabled = true;
  document.getElementById('deleteTxBtn').style.display = 'none';
  openSheet('entrySheet');
}

function openEntrySheetVoice(){
  editingTxId = null;
  document.getElementById('entrySheetTitle').textContent = 'Escuchando';
  document.getElementById('voiceStage').style.display = 'flex';
  document.getElementById('manualForm').style.display = 'none';
  document.getElementById('voiceTranscript').textContent = 'Escuchando…';
  document.getElementById('voiceHint').textContent = 'di algo como "tacos afuera por 230 pesos"';
  openSheet('entrySheet');
}

function openEntrySheetForEdit(txId){
  const tx = state.transactions.find(t=>t.id===txId);
  if(!tx) return;
  editingTxId = txId;
  document.getElementById('entrySheetTitle').textContent = 'Editar movimiento';
  document.getElementById('voiceStage').style.display = 'none';
  document.getElementById('manualForm').style.display = 'block';
  document.getElementById('descInput').value = tx.description;
  document.getElementById('amountInput').value = tx.amount;
  setTxType(tx.type);
  selectedCategoryId = tx.categoryId;
  selectedListId = tx.listId;
  renderEntryListChips();
  const scroll = document.getElementById('catScroll');
  scroll.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected'));
  const chip = scroll.querySelector(`[data-cat="${tx.categoryId}"]`);
  if(chip) chip.classList.add('selected');

  const recurToggle = document.getElementById('recurToggle');
  const recurFreqSelect = document.getElementById('recurFreq');
  if(tx.recurring){
    recurToggle.classList.add('on');
    recurFreqSelect.disabled = false;
    recurFreqSelect.value = tx.recurFreq;
  } else {
    recurToggle.classList.remove('on');
    recurFreqSelect.disabled = true;
  }

  document.getElementById('deleteTxBtn').style.display = 'block';
  openSheet('entrySheet');
}

function saveEntry(){
  const desc = document.getElementById('descInput').value.trim();
  const amountRaw = document.getElementById('amountInput').value.trim().replace(',', '.');
  const amount = parseFloat(amountRaw);

  if(!desc){ showToast('Falta la descripción'); return; }
  if(!amount || amount <= 0){ showToast('Falta un monto válido'); return; }
  if(!selectedCategoryId){ showToast('Elige una categoría'); return; }

  const recurring = document.getElementById('recurToggle').classList.contains('on');
  const recurFreq = document.getElementById('recurFreq').value;
  const listId = selectedListId || state.activeListId;

  if(editingTxId){
    const tx = state.transactions.find(t=>t.id===editingTxId);
    Object.assign(tx, {
      description: desc, amount, categoryId: selectedCategoryId,
      type: selectedType, recurring, recurFreq, listId,
    });
    showToast('Actualizado');
  } else {
    state.transactions.push({
      id: uid(),
      description: desc,
      amount,
      categoryId: selectedCategoryId,
      type: selectedType,
      date: todayISO(),
      listId,
      recurring,
      recurFreq,
    });
    showToast(recurring ? 'Guardado · se repetirá' : 'Guardado');
  }

  saveData();
  state.activeListId = listId;
  renderAll();
  closeSheet('entrySheet');
}

function deleteEntry(){
  if(!editingTxId) return;
  if(!confirm('¿Eliminar este movimiento?')) return;
  state.transactions = state.transactions.filter(t=>t.id !== editingTxId);
  saveData();
  renderAll();
  closeSheet('entrySheet');
}

/* ============================================================
   RECURRING — al abrir la app, aplica las recurrentes pendientes
   ============================================================ */

function applyRecurringIfDue(){
  const today = new Date(); today.setHours(0,0,0,0);
  const templates = state.transactions.filter(t=>t.recurring && t.isTemplate !== false);
  // Simplificado: cada transacción recurrente regenera una copia "viva" si ha pasado
  // el periodo desde la última instancia con el mismo "seriesId".
  let createdAny = false;

  const series = {};
  state.transactions.forEach(t=>{
    if(!t.recurring) return;
    const key = t.seriesId || t.id;
    if(!series[key]) series[key] = [];
    series[key].push(t);
  });

  Object.values(series).forEach(group=>{
    group.sort((a,b)=> a.date.localeCompare(b.date));
    const last = group[group.length-1];
    const lastDate = new Date(last.date + 'T00:00:00');
    let nextDate = new Date(lastDate);
    if(last.recurFreq === 'monthly') nextDate.setMonth(nextDate.getMonth()+1);
    else if(last.recurFreq === 'weekly') nextDate.setDate(nextDate.getDate()+7);
    else if(last.recurFreq === 'yearly') nextDate.setFullYear(nextDate.getFullYear()+1);
    else return;

    if(nextDate <= today){
      const seriesId = last.seriesId || last.id;
      state.transactions.push({
        id: uid(),
        seriesId,
        description: last.description,
        amount: last.amount,
        categoryId: last.categoryId,
        type: last.type,
        date: nextDate.toISOString().slice(0,10),
        listId: last.listId,
        recurring: true,
        recurFreq: last.recurFreq,
      });
      createdAny = true;
    }
  });

  if(createdAny) saveData();
}

/* ============================================================
   SHEETS open/close
   ============================================================ */

function openSheet(id){
  document.getElementById(id).classList.add('open');
}
function closeSheet(id){
  document.getElementById(id).classList.remove('open');
}

/* ============================================================
   SEARCH
   ============================================================ */

function runSearch(query){
  const q = query.trim().toLowerCase();
  const resultsEl = document.getElementById('searchResults');
  if(!q){ resultsEl.innerHTML = ''; return; }

  const results = currentListTx().filter(t=>{
    const cat = getCategory(t.categoryId);
    return t.description.toLowerCase().includes(q)
      || cat.name.toLowerCase().includes(q)
      || String(t.amount).includes(q);
  }).sort((a,b)=> (b.date+b.id).localeCompare(a.date+a.id)).slice(0, 40);

  if(!results.length){
    resultsEl.innerHTML = `<div style="color:var(--ink-faint); font-size:13px; padding:20px 0; text-align:center;">Sin resultados</div>`;
    return;
  }

  resultsEl.innerHTML = results.map(t=> txRowHtml(t)).join('');
  resultsEl.querySelectorAll('.tx-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      closeSheet('searchSheet');
      openEntrySheetForEdit(row.dataset.id);
    });
  });
}

/* ============================================================
   EXPORT / WIPE
   ============================================================ */

function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recibo-respaldo-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Respaldo descargado');
}

function wipeAllData(){
  if(!confirm('Esto borrará TODOS tus movimientos y listas permanentemente. ¿Seguro?')) return;
  if(!confirm('De verdad, no se puede deshacer. ¿Continuar?')) return;
  state = {
    lists: DEFAULT_LISTS,
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    activeListId: 'personal',
    period: 'month',
  };
  saveData();
  renderAll();
  closeSheet('settingsSheet');
  showToast('Todo borrado');
}

/* ============================================================
   EVENT WIRING
   ============================================================ */

document.addEventListener('DOMContentLoaded', ()=>{
  applyRecurringIfDue();
  renderAll();

  // mic button — tap to start/stop
  const micBtn = document.getElementById('micBtn');
  micBtn.addEventListener('click', ()=>{
    if(isListening){
      stopListening();
    } else {
      startListening();
    }
  });

  // add button -> manual entry
  document.getElementById('addBtn').addEventListener('click', openEntrySheetManual);

  // entry sheet close
  document.getElementById('entryCloseBtn').addEventListener('click', ()=>{
    if(isListening) stopListening();
    closeSheet('entrySheet');
  });
  document.getElementById('entrySheet').addEventListener('click', (e)=>{
    if(e.target.id === 'entrySheet'){
      if(isListening) stopListening();
      closeSheet('entrySheet');
    }
  });

  // type toggle
  document.getElementById('typeExpenseBtn').addEventListener('click', ()=> setTxType('expense'));
  document.getElementById('typeIncomeBtn').addEventListener('click', ()=> setTxType('income'));

  // recurring toggle
  document.getElementById('recurToggle').addEventListener('click', ()=>{
    const t = document.getElementById('recurToggle');
    t.classList.toggle('on');
    document.getElementById('recurFreq').disabled = !t.classList.contains('on');
  });

  // save / delete
  document.getElementById('saveBtn').addEventListener('click', saveEntry);
  document.getElementById('deleteTxBtn').addEventListener('click', deleteEntry);

  // list switcher
  document.getElementById('listSwitcherBtn').addEventListener('click', ()=>{
    renderListManager();
    openSheet('listSheet');
  });
  document.getElementById('listCloseBtn').addEventListener('click', ()=> closeSheet('listSheet'));
  document.getElementById('listSheet').addEventListener('click', (e)=>{
    if(e.target.id === 'listSheet') closeSheet('listSheet');
  });
  document.getElementById('addListBtn').addEventListener('click', ()=>{
    const input = document.getElementById('newListInput');
    const name = input.value.trim();
    if(!name) return;
    const emojiPool = ['🗂️','📁','💼','🎯','🌙','🔖','🧾','📌'];
    const emoji = emojiPool[state.lists.length % emojiPool.length];
    const id = 'list_' + uid();
    state.lists.push({ id, name, emoji });
    state.activeListId = id;
    saveData();
    input.value = '';
    renderAll();
    renderListManager();
  });

  // search
  document.getElementById('searchBtn').addEventListener('click', ()=>{
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    openSheet('searchSheet');
    setTimeout(()=> document.getElementById('searchInput').focus(), 300);
  });
  document.getElementById('searchCloseBtn').addEventListener('click', ()=> closeSheet('searchSheet'));
  document.getElementById('searchSheet').addEventListener('click', (e)=>{
    if(e.target.id === 'searchSheet') closeSheet('searchSheet');
  });
  document.getElementById('searchInput').addEventListener('input', (e)=> runSearch(e.target.value));

  // settings
  document.getElementById('settingsBtn').addEventListener('click', ()=> openSheet('settingsSheet'));
  document.getElementById('settingsCloseBtn').addEventListener('click', ()=> closeSheet('settingsSheet'));
  document.getElementById('settingsSheet').addEventListener('click', (e)=>{
    if(e.target.id === 'settingsSheet') closeSheet('settingsSheet');
  });
  document.getElementById('periodScroll').querySelectorAll('.cat-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('#periodScroll .cat-chip').forEach(c=>c.classList.remove('selected'));
      chip.classList.add('selected');
      state.period = chip.dataset.period;
      saveData();
      renderHero();
      renderBars();
      renderLedger();
    });
  });
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('wipeBtn').addEventListener('click', wipeAllData);
});

// register service worker for offline/installable support
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
