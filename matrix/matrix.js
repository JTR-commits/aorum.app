'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const labels = { yes: 'Tak', partial: 'Częściowo', no: 'Brak', conditional: 'Warunkowo', off: 'Wyłączone', debug: 'Deweloperskie', unverified: 'Nie sprawdzono', passed: 'Potwierdzone', failed: 'Nie działa' };
  let session;
  try { session = JSON.parse(sessionStorage.getItem('aorum-matrix-session') || 'null'); } catch { session = null; }
  let data = null, category = '', view = 'all', selected = null, saving = false;
  const dialog = $('#detail'), edit = $('#edit-form');
  function node(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function normalize(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase(); }
  function readableDate(value) { return value ? new Date(value).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  function signedOut() {
    session = null; sessionStorage.removeItem('aorum-matrix-session');
    data = null; selected = null; $('#rows').replaceChildren();
    if (dialog.open) dialog.close();
    if ($('#releases').open) $('#releases').close();
    $('#compare-results').replaceChildren();
    $('#compare-code').replaceChildren(); $('#compare-code').hidden = true;
    $('#app-view').hidden = true; $('#login-view').hidden = false;
    $('#password').value = '';
  }
  async function api(path, options = {}) {
    const response = await fetch(window.MATRIX_API + path, { ...options, credentials: 'omit', cache: 'no-store', headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path !== '/v1/login') signedOut();
      throw new Error(body.error || `Nie udało się wykonać operacji (${response.status}).`);
    }
    return body;
  }
  function setError(message) { $('#load-error').textContent = message; $('#load-error').hidden = !message; }
  function setView(next) {
    view = next; $('#view-filter').value = view;
    document.querySelectorAll('.stat').forEach(card => card.classList.toggle('active', card.dataset.view === view));
    renderRows();
  }
  function categoryButtons() {
    const categories = ['', ...new Set(data.features.map(f => f.category))];
    $('#categories').replaceChildren(...categories.map(name => {
      const button = node('button', name === category ? 'active' : '');
      button.type = 'button'; button.setAttribute('aria-pressed', String(name === category));
      button.append(node('span', '', name || 'Wszystkie obszary'), node('small', '', String(data.features.filter(f => !name || f.category === name).length)));
      button.onclick = () => { category = name; categoryButtons(); renderRows(); };
      return button;
    }));
  }
  function updateStats() {
    const all = data.features;
    $('#count-all').textContent = all.length;
    $('#count-code').textContent = all.filter(f => f.code === 'yes').length;
    $('#count-release').textContent = all.filter(f => ['yes', 'conditional'].includes(f.release)).length;
    $('#release-foot').textContent = `w tym ${all.filter(f => f.release === 'conditional').length} warunkowo`;
    $('#count-passed').textContent = all.filter(f => f.device === 'passed').length;
    $('#device-foot').textContent = `${all.filter(f => f.device === 'unverified').length} bez wyniku próby`;
  }
  function matchesView(f) {
    return view === 'all' || (view === 'gaps' && (f.code !== 'yes' || !['yes','conditional'].includes(f.release))) ||
      (view === 'priority' && f.priority === 'high') || (view === 'unverified' && f.device === 'unverified') ||
      (view === 'passed' && f.device === 'passed') || (view === 'failed' && ['failed','partial'].includes(f.device)) ||
      (view === 'code' && f.code === 'yes') || (view === 'release' && ['yes','conditional'].includes(f.release));
  }
  function renderRows() {
    if (!data) return;
    const query = normalize($('#search').value.trim());
    const features = data.features.filter(f => (!category || f.category === category) && matchesView(f) &&
      (!query || normalize([f.name,f.description,f.category,f.source,f.note,...f.competitors.map(c=>c.name)].join(' ')).includes(query)));
    $('#rows').replaceChildren(...features.map(f => {
      const row = node('tr'); row.dataset.id = f.id;
      const nameCell = node('td');
      const nameButton = node('a','feature-name',f.name); nameButton.href = `#${f.id}`;
      nameButton.onclick = e => { e.preventDefault(); openDetail(f); };
      if (f.priority === 'high') { const dot = node('span','priority-dot'); dot.title = 'Wysoki priorytet'; nameButton.append(dot); }
      nameCell.append(nameButton,node('span','feature-meta',f.category + (f.note ? ' · ma uwagę' : '')));
      row.append(nameCell);
      for (const field of ['code','release','device']) { const cell=node('td');cell.append(node('span',`badge ${f[field]}`,labels[f[field]]));row.append(cell); }
      const actionCell=node('td'), button=node('button','open-row','›');
      button.setAttribute('aria-label',`Szczegóły: ${f.name}`); actionCell.append(button); row.append(actionCell);
      row.onclick = e => { if (!e.target.closest('a')) openDetail(f); };
      return row;
    }));
    $('#result-count').textContent = `Widoczne: ${features.length} z ${data.features.length}`;
    $('#empty').hidden = features.length !== 0;
  }
  async function load() {
    $('#refresh').disabled = true; setError('');
    try {
      data = await api('/v1/matrix');
      $('#login-view').hidden = true; $('#app-view').hidden = false;
      $('#snapshot').textContent = `Aorum Mail · iPhone · Odczyt kodu i konfiguracji: ${data.snapshotDate.split('-').reverse().join('.')}`;
      updateStats(); categoryButtons(); renderRows();
      $('#save-status').textContent = `Dane pobrane z serwera · ${new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}`;
    } catch (error) {
      if (session) { $('#login-view').hidden = true; $('#app-view').hidden = false; setError(error.message); }
      else $('#login-error').textContent = error.message;
    } finally { $('#refresh').disabled = false; }
  }
  function openDetail(feature) {
    selected = feature; $('#edit-error').textContent = '';
    $('#detail-title').textContent = feature.name; $('#detail-category').textContent = feature.category;
    $('#detail-description').textContent = feature.description;
    $('#priority-note').hidden = feature.priority !== 'high';
    for (const field of ['code','release','device','note','deviceName','build','testedAt','evidence']) edit.elements[field].value = feature[field] || '';
    $('#detail-date').textContent = feature.checkedAt;
    $('#detail-source').textContent = feature.source;
    $('#detail-competitors').replaceChildren(...feature.competitors.map(c => {
      const a=node('a','',c.name); a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';return a;
    }));
    $('#history').replaceChildren(...(feature.history?.length ? [...feature.history].reverse().map(item =>
      node('p','',`${readableDate(item.at)} · ${item.user}\nKod: ${labels[item.after.code]} · wydanie: ${labels[item.after.release]} · odbiór: ${labels[item.after.device]}${item.after.note ? '\n'+item.after.note : ''}`)
    ) : [node('p','','Nie zapisano jeszcze zmian dla tej funkcji.')]));
    syncEvidenceRequired();
    dialog.showModal();
  }
  function syncEvidenceRequired() {
    const required = edit.elements.device.value !== 'unverified';
    for (const key of ['deviceName','build','testedAt','evidence']) edit.elements[key].required = required;
  }
  function closeDetail() { if (!saving) dialog.close(); }
  edit.elements.device.onchange = syncEvidenceRequired;
  $('#close-detail').onclick = closeDetail; $('#cancel-edit').onclick = closeDetail;
  dialog.addEventListener('cancel', e => { if (saving) e.preventDefault(); });
  edit.onsubmit = async event => {
    event.preventDefault(); if (!selected || saving) return;
    saving = true; $('#save-edit').disabled = true; $('#edit-error').textContent = '';
    const body = Object.fromEntries(new FormData(edit)); body.version = selected.version;
    try {
      const result = await api(`/v1/features/${selected.id}`, { method:'PUT',body:JSON.stringify(body) });
      data.features = data.features.map(f => f.id === result.id ? result : f);
      updateStats(); renderRows();
      $('#save-status').textContent = `Zapisano na serwerze · ${readableDate(result.updatedAt)}`;
      dialog.close();
    } catch(error) { $('#edit-error').textContent = error.message; }
    finally { saving=false;$('#save-edit').disabled=false; }
  };
  $('#login-form').onsubmit = async event => {
    event.preventDefault(); $('#login-submit').disabled = true; $('#login-error').textContent = '';
    try {
      session = await api('/v1/login', {method:'POST',body:JSON.stringify({username:$('#username').value.trim(),password:$('#password').value})});
      sessionStorage.setItem('aorum-matrix-session',JSON.stringify(session)); $('#password').value=''; await load();
    } catch(error) { $('#login-error').textContent = error.message; }
    finally { $('#login-submit').disabled = false; }
  };
  $('#logout').onclick = signedOut; $('#refresh').onclick = load;
  $('#search').oninput = renderRows; $('#view-filter').onchange = event => setView(event.target.value);
  document.querySelectorAll('.stat').forEach(card=>card.onclick=()=>setView(card.dataset.view));
  $('#clear-filters').onclick = () => { category='';$('#search').value='';categoryButtons();setView('all'); };
  $('#export').onclick = () => {
    if (!data) return;
    const escape = value => { let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'; };
    const records=[['Funkcja','Obszar','Kod','Wydanie','Urządzenie — wynik','Urządzenie','Build','Data próby','Dowód','Uwagi','Źródło','Data audytu'],
      ...data.features.map(f=>[f.name,f.category,labels[f.code],labels[f.release],labels[f.device],f.deviceName,f.build,f.testedAt,f.evidence,f.note,f.source,f.checkedAt])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+records.map(row=>row.map(escape).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=node('a');a.href=url;a.download=`aorum-mail-matrix-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const releasesDialog = $('#releases'), capture = $('#capture-form');
  const kindLabels = {new:'Nowa / udostępniona',regression:'Regresja / ograniczenie',removed:'Usunięta pozycja',improved:'Poprawa',verification:'Zmiana odbioru',changed:'Opis / inna zmiana'};
  const fieldLabels = {code:'Kod',release:'Wydanie',device:'Odbiór',name:'Nazwa',category:'Obszar',description:'Opis',source:'Źródło',checkedAt:'Data audytu',note:'Uwaga',deviceName:'Urządzenie',build:'Build próby',testedAt:'Data próby',evidence:'Dowód',entry:'Pozycja'};
  let comparison = null, compareRequest = 0, captureId = null, capturing = false;
  function renderCodeReferences(from, to) {
    $('#compare-code').replaceChildren(...[from, to].map((state, index) => {
      const item = node('div');
      item.append(node('strong','small',index ? 'Kod stanu późniejszego' : 'Kod stanu wcześniejszego'));
      const match = /^https:\/\/github\.com\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\/([a-z0-9_.-]+)\/commit\/([a-f0-9]{40})$/i.exec(state.sourceCommitUrl || '');
      if (match && !['.', '..'].includes(match[2])) {
        const link = node('a','',`${match[1]}/${match[2]} · ${match[3].slice(0,8)}`);
        link.href = state.sourceCommitUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.title = state.sourceCommitUrl;
        item.append(link);
      } else item.append(node('span','muted small',state.id === 'current' ? 'Nie przypisano — wybierz zapisany stan.' : 'Nie podano.'));
      return item;
    }));
    $('#compare-code').hidden = false;
  }
  function renderComparison() {
    if (!comparison) return;
    const filter = $('#compare-filter').value;
    const rows = comparison.changes.filter(row => filter === 'all' || row.kinds.includes(filter));
    $('#compare-status').textContent = `Zmienione funkcje: ${comparison.changes.length} · nowe / udostępnione: ${comparison.counts.new} · regresje / ograniczenia: ${comparison.counts.regression} · usunięte: ${comparison.counts.removed}`;
    $('#compare-results').replaceChildren(...(rows.length ? rows.map(row => {
      const card = node('article','comparison-card');
      card.append(node('h3','',row.name),node('p','small muted',row.category));
      const badges = node('div','comparison-badges');
      row.kinds.forEach(kind => badges.append(node('span',`badge ${kind === 'regression' || kind === 'removed' ? 'failed' : kind === 'new' || kind === 'improved' ? 'passed' : ''}`,kindLabels[kind])));
      card.append(badges);
      row.details.forEach(change => {
        const line = node('div','comparison-line');
        const format = value => {
          if (change.field === 'entry') return value === 'added' ? 'Dodano' : value === 'present' ? 'Obecna' : 'Brak';
          return ['code','release','device'].includes(change.field) ? labels[value] || value || '—' : value || '—';
        };
        line.append(node('strong','',fieldLabels[change.field] || change.field),node('span','',format(change.before)),node('span','comparison-arrow','→'),node('span','',format(change.after)));
        card.append(line);
      });
      return card;
    }) : [node('p','empty',comparison.changes.length ? 'Brak zmian dla wybranego filtra.' : 'Brak różnic między wybranymi stanami.')]));
  }
  async function compare() {
    const request = ++compareRequest; comparison = null;
    $('#compare-code').replaceChildren(); $('#compare-code').hidden = true; $('#compare-context').textContent = '';
    $('#compare-results').replaceChildren(); $('#compare-error').textContent = ''; $('#compare-status').textContent = 'Porównywanie…';
    try {
      const result = await api(`/v1/compare?from=${encodeURIComponent($('#compare-from').value)}&to=${encodeURIComponent($('#compare-to').value)}`);
      if (request !== compareRequest || !session) return;
      comparison = result;
      $('#compare-context').textContent = `${result.from.label} · ${result.from.build} → ${result.to.label} · ${result.to.build}`;
      renderCodeReferences(result.from, result.to);
      renderComparison();
    } catch(error) {
      if (request !== compareRequest) return;
      $('#compare-status').textContent = ''; $('#compare-context').textContent = ''; $('#compare-error').textContent = error.message;
    }
  }
  async function loadReleases(selectedTo) {
    const result = await api('/v1/releases');
    if (!session) return;
    const states = [...result.releases, {id:'current',label:'Bieżąca macierz',build:'Aktualny stan'}];
    for (const id of ['compare-from','compare-to']) {
      const previous = $('#'+id).value;
      $('#'+id).replaceChildren(...states.map(state => {
        const option = node('option','',`${state.label} · ${state.build}`); option.value = state.id; return option;
      }));
      $('#'+id).value = states.some(state => state.id === previous) ? previous : (id === 'compare-from' ? 'baseline' : 'current');
    }
    if (selectedTo) $('#compare-to').value = selectedTo;
    await compare();
  }
  $('#open-releases').onclick = async () => {
    releasesDialog.showModal(); $('#compare-error').textContent = ''; $('#compare-status').textContent = 'Wczytywanie stanów…';
    try { await loadReleases(); } catch(error) { $('#compare-status').textContent=''; $('#compare-error').textContent=error.message; }
  };
  $('#close-releases').onclick = () => { if (!capturing) releasesDialog.close(); };
  releasesDialog.addEventListener('cancel', event => { if (capturing) event.preventDefault(); });
  $('#compare-from').onchange = compare; $('#compare-to').onchange = compare; $('#compare-filter').onchange = renderComparison;
  capture.addEventListener('input', () => { if (!capturing) captureId = null; });
  capture.onsubmit = async event => {
    event.preventDefault(); if (capturing) return;
    capturing=true; $('#capture-submit').disabled=true; $('#capture-error').textContent='';
    captureId ||= crypto.randomUUID();
    const body={id:captureId,...Object.fromEntries(new FormData(capture))};
    capture.querySelectorAll('input,textarea').forEach(field=>field.disabled=true);
    try {
      const result = await api('/v1/releases',{method:'POST',body:JSON.stringify(body)});
      $('#capture-error').textContent='';
      capture.reset(); captureId=null; $('#capture-box').open=false;
      try { await loadReleases(result.id); }
      catch(error) { $('#compare-error').textContent=`Stan zapisano. Nie udało się odświeżyć porównania: ${error.message}`; }
    } catch(error) { $('#capture-error').textContent=error.message; }
    finally { capturing=false; $('#capture-submit').disabled=false; capture.querySelectorAll('input,textarea').forEach(field=>field.disabled=false); }
  };
  if (session?.expiresAt > Date.now()) load(); else signedOut();
})();
