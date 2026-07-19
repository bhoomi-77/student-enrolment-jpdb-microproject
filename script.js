(function(){
  /* ======================================================================
     JsonPowerDB (JPDB) CONNECTION SETTINGS — EDIT THESE FOUR VALUES ONLY
     ======================================================================
     TOKEN     : Your connection-token from the JPDB dashboard.
                 Get it at: http://api.login2explore.com:5577/user/index.html
                 -> Tools -> Tokens -> "Generate Connection_Token" -> copy it.
     BASE_URL  : The JPDB server address. Use the public one below unless
                 you were given a private/custom instance URL.
     DB_NAME   : Must match exactly what you (or JPDB) created. Per the
                 project spec this is "SCHOOL-DB".
     REL_NAME  : The relation (table) name. Per the spec: "STUDENT-TABLE".
                 It does NOT need to exist beforehand — the first PUT/SET
                 call auto-creates it with "rollNo" indexed as the key.
     ---------------------------------------------------------------------- */
  const JPDB = {
    TOKEN:    "PASTE_YOUR_CONNECTION_TOKEN_HERE",
    BASE_URL: "http://api.login2explore.com:5577",
    DB_NAME:  "SCHOOL-DB",
    REL_NAME: "STUDENT-TABLE"
  };

  // Low-level helper: POSTs a JPDB command to the given endpoint and
  // returns the parsed JSON response ({ data, message, status }).
  async function jpdb(endpoint, body){
    const res = await fetch(JPDB.BASE_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({
        token: JPDB.TOKEN,
        dbName: JPDB.DB_NAME,
        rel: JPDB.REL_NAME
      }, body))
    });
    return res.json();
  }

  const FIELD_ORDER = ['rollNo','fullName','className','birthDate','address','enrollmentDate'];
  const els = {};
  FIELD_ORDER.forEach(id => els[id] = document.getElementById(id));
  const fieldWrap = id => document.getElementById('f-'+id);
  const hintEl = id => document.getElementById('h-'+id);

  const btnSave = document.getElementById('btnSave');
  const btnUpdate = document.getElementById('btnUpdate');
  const btnReset = document.getElementById('btnReset');
  const stamp = document.getElementById('stamp');
  const toast = document.getElementById('toast');
  const drawer = document.getElementById('drawer');
  const drawerToggle = document.getElementById('drawerToggle');
  const recordsBody = document.getElementById('recordsBody');

  let mode = 'idle'; // idle | new | existing
  let checking = false;

  function clearErrors(){
    FIELD_ORDER.forEach(id => {
      fieldWrap(id).classList.remove('error');
      hintEl(id).textContent = '';
    });
  }

  function showToast(msg, isErr){
    toast.textContent = msg;
    toast.classList.toggle('err', !!isErr);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setStamp(kind){
    stamp.classList.remove('show','new','existing');
    if(kind === 'new'){ stamp.textContent = 'New Entry'; stamp.classList.add('show','new'); }
    else if(kind === 'existing'){ stamp.textContent = 'Record Found'; stamp.classList.add('show','existing'); }
  }

  function resetForm(focusRoll){
    mode = 'idle';
    clearErrors();
    FIELD_ORDER.forEach(id => {
      els[id].value = '';
      if(id !== 'rollNo'){ els[id].disabled = true; }
    });
    els.rollNo.disabled = false;
    btnSave.disabled = true;
    btnUpdate.disabled = true;
    btnReset.disabled = true;
    setStamp(null);
    hintEl('rollNo').textContent = 'Type a roll number, then tab or click away to check.';
    if(focusRoll !== false){ els.rollNo.focus(); }
  }

  function enableOtherFields(enable){
    FIELD_ORDER.slice(1).forEach(id => { els[id].disabled = !enable; });
  }

  function fillFields(data){
    FIELD_ORDER.slice(1).forEach(id => { els[id].value = data[id] || ''; });
  }

  async function checkRollNo(){
    const val = els.rollNo.value.trim();
    if(!val || checking) return;
    checking = true;
    hintEl('rollNo').innerHTML = 'Checking record<span class="loading-dot"></span>';
    try{
      // GET_BY_KEY looks up one record by an indexed column (our primary key).
      const resp = await jpdb('/api/irl', {
        cmd: 'GET_BY_KEY',
        jsonStr: { rollNo: val }
      });

      if(resp.status === 200 && resp.data && resp.data.record){
        // existing record
        mode = 'existing';
        fillFields(resp.data.record);
        els.rollNo.disabled = true;
        enableOtherFields(true);
        btnSave.disabled = true;
        btnUpdate.disabled = false;
        btnReset.disabled = false;
        setStamp('existing');
        hintEl('rollNo').textContent = 'Existing record loaded — edit the other fields.';
        els.fullName.focus();
      } else {
        throw new Error('not found');
      }
    }catch(e){
      // not found -> new entry
      mode = 'new';
      els.rollNo.disabled = false;
      enableOtherFields(true);
      btnSave.disabled = false;
      btnUpdate.disabled = true;
      btnReset.disabled = false;
      setStamp('new');
      hintEl('rollNo').textContent = 'No record with this Roll No. — fill in the rest and Save.';
      els.fullName.focus();
    }finally{
      checking = false;
    }
  }

  function validate(){
    clearErrors();
    let ok = true;
    FIELD_ORDER.forEach(id => {
      if(!els[id].value || !els[id].value.trim()){
        fieldWrap(id).classList.add('error');
        hintEl(id).textContent = 'This field cannot be empty.';
        ok = false;
      }
    });
    return ok;
  }

  async function saveRecord(){
    if(!validate()) return;
    const data = {};
    FIELD_ORDER.forEach(id => data[id] = els[id].value.trim());
    try{
      // SET with type "PUT": inserts a new record, errors if the primary
      // key already exists (auto-creates the relation on first call).
      const resp = await jpdb('/api/iml', {
        cmd: 'SET',
        type: 'PUT',
        primaryKey: 'rollNo',
        jsonStr: data
      });
      if(resp.status !== 200) throw new Error(resp.message || 'Save failed');
      showToast('Saved Roll No. ' + data.rollNo + ' to STUDENT-TABLE.');
      resetForm();
      if(drawer.classList.contains('open')) loadRecords();
    }catch(e){
      showToast('Could not save record: ' + e.message, true);
    }
  }

  async function updateRecord(){
    if(!validate()) return;
    const data = {};
    FIELD_ORDER.forEach(id => data[id] = els[id].value.trim());
    try{
      // SET with type "UPDATE": modifies the record matching the primary
      // key, errors if it does not already exist.
      const resp = await jpdb('/api/iml', {
        cmd: 'SET',
        type: 'UPDATE',
        primaryKey: 'rollNo',
        jsonStr: data
      });
      if(resp.status !== 200) throw new Error(resp.message || 'Update failed');
      showToast('Updated Roll No. ' + data.rollNo + '.');
      resetForm();
      if(drawer.classList.contains('open')) loadRecords();
    }catch(e){
      showToast('Could not update record: ' + e.message, true);
    }
  }

  async function loadRecords(){
    recordsBody.innerHTML = '<tr class="empty-row"><td colspan="3">Loading…</td></tr>';
    try{
      // GET_ALL pulls every record in the relation (paged; 100 per page
      // is plenty for a class list — raise pageSize if you need more).
      const resp = await jpdb('/api/irl', {
        cmd: 'GET_ALL',
        pageNo: 1,
        pageSize: 100
      });
      const rows = (resp.data && resp.data.json_records || []).map(r => r.record);
      if(!rows.length){
        recordsBody.innerHTML = '<tr class="empty-row"><td colspan="3">No students enrolled yet.</td></tr>';
        return;
      }
      rows.sort((a,b) => a.rollNo.localeCompare(b.rollNo));
      recordsBody.innerHTML = '';
      rows.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = 'rowlink';
        tr.innerHTML = '<td>'+escapeHtml(d.rollNo)+'</td><td>'+escapeHtml(d.fullName)+'</td><td>'+escapeHtml(d.className)+'</td>';
        tr.addEventListener('click', () => {
          resetForm(false);
          els.rollNo.value = d.rollNo;
          checkRollNo();
          drawer.classList.remove('open');
        });
        recordsBody.appendChild(tr);
      });
    }catch(e){
      recordsBody.innerHTML = '<tr class="empty-row"><td colspan="3">Could not load records.</td></tr>';
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  els.rollNo.addEventListener('blur', checkRollNo);
  els.rollNo.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); els.rollNo.blur(); } });

  btnSave.addEventListener('click', saveRecord);
  btnUpdate.addEventListener('click', updateRecord);
  btnReset.addEventListener('click', () => resetForm());

  drawerToggle.addEventListener('click', () => {
    drawer.classList.toggle('open');
    drawerToggle.textContent = drawer.classList.contains('open')
      ? 'Hide student list ▴'
      : 'Browse all enrolled students ▾';
    if(drawer.classList.contains('open')) loadRecords();
  });

  // initial state on page load
  resetForm();
})();
