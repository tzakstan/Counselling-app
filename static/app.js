// Saire Ilmi Counselling & Evaluation System - Frontend Logic

let state = {
  currentUser: null, // { id, username, name, role: 'counsellor' | 'management' }
  students: [],
  activeStudentId: null,
  activeTab: 'form', // 'form' | 'report'
  activeFilter: 'all',
  cumulativeData: null
};

let deferredPrompt = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // Check stored user session
  const storedUser = localStorage.getItem('saire_ilmi_user');
  if (storedUser) {
    try {
      state.currentUser = JSON.parse(storedUser);
      applyUserRole(state.currentUser);
    } catch (e) {
      showLoginModal();
    }
  } else {
    showLoginModal();
  }

  // Register Service Worker for Android PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js')
      .then(() => console.log('PWA Service Worker registered'))
      .catch((err) => console.log('Service Worker registration failed:', err));
  }

  // Listen for PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.classList.remove('hidden');
  });

  await fetchStudents();
  await checkApiKeyStatus();
  if (state.students.length > 0) {
    selectStudent(state.students[0].id);
  }
  lucide.createIcons();
});

// ----------------------------------------------------
// Authentication & Access Control
// ----------------------------------------------------
function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('hidden');
}

function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
}

function quickFillLogin(username, password) {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  const errorMsg = document.getElementById('login-error-msg');
  const btn = document.getElementById('btn-login-submit');

  errorMsg.classList.add('hidden');
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const user = await res.json();
    state.currentUser = user;
    localStorage.setItem('saire_ilmi_user', JSON.stringify(user));

    applyUserRole(user);
    hideLoginModal();
    showToast(`Welcome, ${user.name}`);
  } catch (err) {
    errorMsg.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    refreshIcons();
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('saire_ilmi_user');
  showLoginModal();
}

function applyUserRole(user) {
  if (!user) return;
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatar = document.getElementById('user-avatar-icon');

  if (nameEl) nameEl.innerText = user.name;
  if (roleEl) roleEl.innerText = user.role === 'counsellor' ? 'Counsellor Portal' : 'Management Portal';
  if (avatar) avatar.setAttribute('data-lucide', user.role === 'counsellor' ? 'user-pen' : 'building-2');

  const roleBanner = document.getElementById('active-role-text');
  const counsellorView = document.getElementById('view-counsellor');
  const managementView = document.getElementById('view-management');

  if (user.role === 'counsellor') {
    roleBanner.innerText = "Counsellor Workspace: Enter raw notes, conduct 1-on-1 evaluations, and synthesize structured reports.";
    counsellorView.classList.remove('hidden');
    managementView.classList.add('hidden');
    enableCounsellorEditing(true);
  } else {
    roleBanner.innerText = "Management Portal: Review pastoral evaluations, track candidates requiring second sessions, and leave notes.";
    counsellorView.classList.add('hidden');
    managementView.classList.remove('hidden');
    enableCounsellorEditing(false); // Disable editing rights
    renderManagementDashboard();
  }
  refreshIcons();
}

function enableCounsellorEditing(canEdit) {
  // If user is Management, protect intake and report fields from accidental alteration
  const genBtn = document.getElementById('btn-generate-ai');
  if (genBtn) genBtn.style.display = canEdit ? 'flex' : 'none';

  const inputs = document.querySelectorAll('#counsellor-tab-form input, #counsellor-tab-form textarea');
  inputs.forEach(el => el.readOnly = !canEdit);

  const reportInputs = document.querySelectorAll('#counsellor-tab-report textarea');
  reportInputs.forEach(el => el.readOnly = !canEdit);
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  } else {
    alert("To install on Android: Tap the 3 dots menu (⋮) in Chrome, then tap 'Add to Home screen' or 'Install App'.");
  }
}

// Refresh Lucide icons safely
function refreshIcons() {
  setTimeout(() => {
    if (window.lucide) {
      lucide.createIcons();
    }
  }, 50);
}

// ----------------------------------------------------
// Role Switching
// ----------------------------------------------------
function setRole(role) {
  state.currentRole = role;
  const counsellorBtn = document.getElementById('role-counsellor-btn');
  const managementBtn = document.getElementById('role-management-btn');
  const roleBanner = document.getElementById('active-role-text');
  const counsellorView = document.getElementById('view-counsellor');
  const managementView = document.getElementById('view-management');

  if (role === 'counsellor') {
    counsellorBtn.className = "px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 bg-jamea-accent text-slate-900 shadow";
    managementBtn.className = "px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 text-slate-300 hover:text-white";
    roleBanner.innerText = "Counsellor Workspace: Enter raw notes, conduct 1-on-1 evaluations, and synthesize structured reports.";
    counsellorView.classList.remove('hidden');
    managementView.classList.add('hidden');
  } else {
    managementBtn.className = "px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 bg-jamea-accent text-slate-900 shadow";
    counsellorBtn.className = "px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 text-slate-300 hover:text-white";
    roleBanner.innerText = "Management Portal: Review pastoral evaluations, track candidates requiring second sessions, and leave notes.";
    counsellorView.classList.add('hidden');
    managementView.classList.remove('hidden');
    renderManagementDashboard();
  }
  refreshIcons();
}

// ----------------------------------------------------
// API Calls & Data Sync
// ----------------------------------------------------
async function fetchStudents() {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) throw new Error('Failed to load students');
    state.students = await res.json();
    renderStudentList();
    renderManagementDashboard();
  } catch (err) {
    console.error('Error fetching students:', err);
  }
}

async function checkApiKeyStatus() {
  try {
    const res = await fetch('/api/settings/api-key');
    const data = await res.json();
    const ind = document.getElementById('ai-status-indicator');
    if (data.has_key) {
      ind.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3 text-amber-500"></i> Gemini 2.5 Active`;
      ind.className = "text-amber-800 font-semibold flex items-center gap-1";
    } else {
      ind.innerHTML = `<i data-lucide="cpu" class="w-3 h-3 text-emerald-600"></i> Expert Clinical Engine`;
      ind.className = "text-emerald-700 font-medium flex items-center gap-1";
    }
    refreshIcons();
  } catch (e) {
    console.warn(e);
  }
}

// ----------------------------------------------------
// Student List Rendering & Selection
// ----------------------------------------------------
function renderStudentList() {
  const container = document.getElementById('student-list-container');
  if (!container) return;
  const search = (document.getElementById('student-search-input')?.value || '').toLowerCase();

  const filtered = state.students.filter(s => 
    s.name.toLowerCase().includes(search) || 
    s.place.toLowerCase().includes(search) || 
    s.id.toLowerCase().includes(search)
  );

  container.innerHTML = filtered.map(s => {
    const isSelected = s.id === state.activeStudentId;
    let badgeClass = "badge-green";
    let badgeLabel = "🟢 Well-Adapted";
    
    if (s.report) {
      if (s.report.triage_status.includes('🔴') || s.report.triage_status.includes('Requires')) {
        badgeClass = "badge-red";
        badgeLabel = "🔴 2nd Session";
      } else if (s.report.triage_status.includes('🟡') || s.report.triage_status.includes('Mild')) {
        badgeClass = "badge-amber";
        badgeLabel = "🟡 Observation";
      }
    }

    const displayName = s.is_confidential ? `Candidate ${s.id}` : s.name;

    return `
      <div onclick="selectStudent('${s.id}')" 
           class="p-2.5 rounded-lg cursor-pointer transition border text-xs ${
             isSelected 
               ? 'bg-emerald-50/80 border-emerald-500 shadow-sm' 
               : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
           }">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-slate-800 truncate">${displayName}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">
            ${badgeLabel}
          </span>
        </div>
        <div class="flex items-center justify-between text-slate-500 text-[11px]">
          <span>Age: ${s.age} | ${s.is_confidential ? '[City Masked]' : s.place}</span>
          <div class="flex items-center gap-1">
            ${s.is_confidential ? '<i data-lucide="lock" class="w-3 h-3 text-amber-600"></i>' : ''}
            <span class="text-slate-400 font-mono text-[10px]">${s.id}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

function filterStudentList() {
  renderStudentList();
}

function selectStudent(studentId) {
  state.activeStudentId = studentId;
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  renderStudentList();
  populateStudentForm(student);
  populateStudentReport(student);
  renderComments(student.comments);

  // Update Active Header
  const displayName = student.is_confidential ? `Candidate ${student.id} (CONFIDENTIAL)` : student.name;
  document.getElementById('active-student-name').innerText = displayName;
  document.getElementById('active-student-meta').innerText = `Age: ${student.age} | Origin: ${student.is_confidential ? '[Masked]' : student.place} | Batch: ${student.batch} | ID: ${student.id}`;
  
  const badge = document.getElementById('active-student-badge');
  if (student.report) {
    badge.innerText = student.report.triage_status;
    badge.className = `px-2 py-0.5 rounded text-xs font-semibold ${
      student.report.triage_status.includes('🔴') ? 'badge-red' :
      student.report.triage_status.includes('🟡') ? 'badge-amber' : 'badge-green'
    }`;
  } else {
    badge.innerText = "Status: Draft";
    badge.className = "px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700";
  }

  // Set confidentiality toggle checkbox
  const confToggle = document.getElementById('toggle-confidentiality');
  if (confToggle) {
    confToggle.checked = !!student.is_confidential;
    document.getElementById('confidentiality-status-label').innerText = student.is_confidential 
      ? "Masked (Confidential Blind Mode)" 
      : "Full Profile (Names Visible)";
  }
}

// ----------------------------------------------------
// Form Population & Saving
// ----------------------------------------------------
function populateStudentForm(student) {
  document.getElementById('form-name').value = student.name || '';
  document.getElementById('form-age').value = student.age || '';
  document.getElementById('form-place').value = student.place || '';
  document.getElementById('form-father-occ').value = student.fathers_occupation || '';
  document.getElementById('form-mother-occ').value = student.mothers_occupation || '';
  document.getElementById('form-batch').value = student.batch || 'Batch 2026-A';

  const q = student.questionnaire || {};
  document.getElementById('q-pre-session').value = q.pre_session_query || '';
  document.getElementById('q-strengths').value = q.strengths_rely_on || '';
  document.getElementById('q-weaknesses').value = q.weaknesses_not_rely_on || '';
  document.getElementById('q-worry').value = q.worry_overthink || '';
  document.getElementById('q-enjoy').value = q.enjoy_3_things || '';
  document.getElementById('q-insecure').value = q.insecure_uncomfortable || '';
  document.getElementById('q-proud').value = q.proud_of_yourself || '';
  document.getElementById('q-confident').value = q.confidence_source || '';
  document.getElementById('q-understood').value = q.feel_understood || '';
  document.getElementById('q-goto').value = q.go_to_person || '';
  document.getElementById('q-parents').value = q.parents_different || '';
  document.getElementById('q-study').value = q.study_motivation || '';
  document.getElementById('q-career').value = q.future_career || '';
  document.getElementById('q-adult-life').value = q.adult_life_imagined || '';
  document.getElementById('q-fears').value = q.fears_barriers_future || '';
  document.getElementById('q-alter').value = q.alter_improve_self || '';
  document.getElementById('q-magic').value = q.magic_button_wish || '';
  document.getElementById('q-felt').value = q.session_feeling || '';
  document.getElementById('q-unshared').value = q.unshared_thoughts || '';
  document.getElementById('q-takeaway').value = q.takeaway || '';
  document.getElementById('q-moula').value = q.moula_guidance_practice || '';

  const obs = student.observations || {};
  document.getElementById('obs-emotional').value = obs.emotional_expression || '';
  document.getElementById('obs-confidence').value = obs.confidence_level || '';
  document.getElementById('obs-anxiety').value = obs.anxiety_restlessness || '';
  document.getElementById('obs-clarity').value = obs.clarity_vs_confusion || '';
  document.getElementById('obs-pressure').value = obs.family_pressure_themes || '';
  document.getElementById('obs-fear').value = obs.fear_of_failure_judgement || '';
  document.getElementById('obs-motivation').value = obs.motivational_level || '';
  document.getElementById('obs-identity').value = obs.identity_struggles || '';
  document.getElementById('obs-peer').value = obs.peer_influence || '';
  document.getElementById('obs-maturity').value = obs.emotional_maturity || '';

  document.getElementById('form-raw-remarks').value = student.counsellor_raw_remarks || '';
  document.getElementById('form-raw-exercise').value = student.prescribed_exercise_raw || '';
}

function getStudentDataFromForm() {
  const current = state.students.find(s => s.id === state.activeStudentId) || {};
  return {
    ...current,
    name: document.getElementById('form-name').value.trim(),
    age: parseInt(document.getElementById('form-age').value) || 15,
    place: document.getElementById('form-place').value.trim(),
    fathers_occupation: document.getElementById('form-father-occ').value.trim(),
    mothers_occupation: document.getElementById('form-mother-occ').value.trim(),
    batch: document.getElementById('form-batch').value.trim() || 'Batch 2026-A',
    questionnaire: {
      pre_session_query: document.getElementById('q-pre-session').value.trim(),
      strengths_rely_on: document.getElementById('q-strengths').value.trim(),
      weaknesses_not_rely_on: document.getElementById('q-weaknesses').value.trim(),
      worry_overthink: document.getElementById('q-worry').value.trim(),
      enjoy_3_things: document.getElementById('q-enjoy').value.trim(),
      insecure_uncomfortable: document.getElementById('q-insecure').value.trim(),
      proud_of_yourself: document.getElementById('q-proud').value.trim(),
      confidence_source: document.getElementById('q-confident').value.trim(),
      feel_understood: document.getElementById('q-understood').value.trim(),
      go_to_person: document.getElementById('q-goto').value.trim(),
      parents_different: document.getElementById('q-parents').value.trim(),
      study_motivation: document.getElementById('q-study').value.trim(),
      future_career: document.getElementById('q-career').value.trim(),
      adult_life_imagined: document.getElementById('q-adult-life').value.trim(),
      fears_barriers_future: document.getElementById('q-fears').value.trim(),
      alter_improve_self: document.getElementById('q-alter').value.trim(),
      magic_button_wish: document.getElementById('q-magic').value.trim(),
      session_feeling: document.getElementById('q-felt').value.trim(),
      unshared_thoughts: document.getElementById('q-unshared').value.trim(),
      takeaway: document.getElementById('q-takeaway').value.trim(),
      moula_guidance_practice: document.getElementById('q-moula').value.trim()
    },
    observations: {
      emotional_expression: document.getElementById('obs-emotional').value.trim(),
      confidence_level: document.getElementById('obs-confidence').value.trim(),
      anxiety_restlessness: document.getElementById('obs-anxiety').value.trim(),
      clarity_vs_confusion: document.getElementById('obs-clarity').value.trim(),
      family_pressure_themes: document.getElementById('obs-pressure').value.trim(),
      fear_of_failure_judgement: document.getElementById('obs-fear').value.trim(),
      motivational_level: document.getElementById('obs-motivation').value.trim(),
      identity_struggles: document.getElementById('obs-identity').value.trim(),
      peer_influence: document.getElementById('obs-peer').value.trim(),
      emotional_maturity: document.getElementById('obs-maturity').value.trim()
    },
    counsellor_raw_remarks: document.getElementById('form-raw-remarks').value.trim(),
    prescribed_exercise_raw: document.getElementById('form-raw-exercise').value.trim()
  };
}

async function saveStudentFormData() {
  if (!state.activeStudentId) return;
  const updatedData = getStudentDataFromForm();

  try {
    const res = await fetch(`/api/students/${state.activeStudentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (!res.ok) throw new Error('Save failed');
    const saved = await res.json();
    
    // Update local state
    const idx = state.students.findIndex(s => s.id === saved.id);
    if (idx !== -1) state.students[idx] = saved;
    renderStudentList();
    showToast("Intake details saved successfully!");
  } catch (err) {
    alert("Error saving: " + err.message);
  }
}

// ----------------------------------------------------
// AI Report Generation & Synthesis
// ----------------------------------------------------
async function triggerGenerateReport() {
  if (!state.activeStudentId) return;
  
  // First save current form data
  await saveStudentFormData();

  const btn = document.getElementById('btn-generate-ai');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Synthesizing...</span>`;
  refreshIcons();

  try {
    const res = await fetch(`/api/students/${state.activeStudentId}/generate-report`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Report generation failed');
    const updatedStudent = await res.json();

    // Update state and UI
    const idx = state.students.findIndex(s => s.id === updatedStudent.id);
    if (idx !== -1) state.students[idx] = updatedStudent;
    
    selectStudent(updatedStudent.id);
    switchCounsellorTab('report');
    showToast("Report successfully synthesized!");
  } catch (err) {
    alert("Generation error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    refreshIcons();
  }
}

function populateStudentReport(student) {
  const r = student.report || {};
  document.getElementById('rep-exec-summary').value = r.executive_summary || '';
  document.getElementById('rep-emotional-profile').value = r.emotional_profile || '';
  document.getElementById('rep-social-dynamics').value = r.social_family_dynamics || '';
  document.getElementById('rep-academic-future').value = r.academic_future_outlook || '';
  document.getElementById('rep-spiritual-alignment').value = r.institutional_value_alignment || '';
  document.getElementById('rep-counsellor-remarks').value = r.counsellor_remarks || '';
  document.getElementById('rep-prescribed-exercises').value = r.prescribed_exercises || '';
  document.getElementById('rep-followup-notes').value = r.follow_up_notes || '';

  const triageSel = document.getElementById('report-triage-select');
  if (triageSel && r.triage_status) {
    triageSel.value = r.triage_status;
  }

  const dispName = student.is_confidential ? `Candidate ${student.id} (CONFIDENTIAL)` : student.name;
  document.getElementById('report-display-candidate-header').innerText = 
    `Candidate: ${dispName} | Age: ${student.age} | Batch: ${student.batch}`;
}

async function saveEditedReport() {
  if (!state.activeStudentId) return;
  const student = state.students.find(s => s.id === state.activeStudentId);
  if (!student) return;

  const currentTriage = document.getElementById('report-triage-select').value;
  const isFollowUp = currentTriage.includes('🔴') || currentTriage.includes('Requires');

  const reportPayload = {
    executive_summary: document.getElementById('rep-exec-summary').value,
    emotional_profile: document.getElementById('rep-emotional-profile').value,
    social_family_dynamics: document.getElementById('rep-social-dynamics').value,
    academic_future_outlook: document.getElementById('rep-academic-future').value,
    institutional_value_alignment: document.getElementById('rep-spiritual-alignment').value,
    clinical_synthesis: student.report?.clinical_synthesis || "",
    counsellor_remarks: document.getElementById('rep-counsellor-remarks').value,
    prescribed_exercises: document.getElementById('rep-prescribed-exercises').value,
    triage_status: currentTriage,
    follow_up_recommended: isFollowUp,
    follow_up_notes: document.getElementById('rep-followup-notes').value
  };

  try {
    const res = await fetch(`/api/students/${state.activeStudentId}/report`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportPayload)
    });
    if (!res.ok) throw new Error('Save failed');
    const updated = await res.json();
    
    const idx = state.students.findIndex(s => s.id === updated.id);
    if (idx !== -1) state.students[idx] = updated;
    selectStudent(updated.id);
    showToast("Edited report saved successfully!");
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// ----------------------------------------------------
// Confidentiality Shield & Triage Controls
// ----------------------------------------------------
async function toggleStudentConfidentiality(isConfidential) {
  if (!state.activeStudentId) return;
  try {
    const res = await fetch(`/api/students/${state.activeStudentId}/confidentiality`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_confidential: isConfidential })
    });
    if (!res.ok) throw new Error('Failed to toggle confidentiality');
    const updated = await res.json();
    
    const idx = state.students.findIndex(s => s.id === updated.id);
    if (idx !== -1) state.students[idx] = updated;
    selectStudent(updated.id);
    showToast(isConfidential ? "Confidential Blind Mode Activated (Names Masked)" : "Full Profile Mode (Names Visible)");
  } catch (err) {
    alert(err.message);
  }
}

function updateTriageSelection(val) {
  const badge = document.getElementById('active-student-badge');
  badge.innerText = val;
  badge.className = `px-2 py-0.5 rounded text-xs font-semibold ${
    val.includes('🔴') ? 'badge-red' :
    val.includes('🟡') ? 'badge-amber' : 'badge-green'
  }`;
}

// ----------------------------------------------------
// Tab Switching
// ----------------------------------------------------
function switchCounsellorTab(tab) {
  state.activeTab = tab;
  const formTab = document.getElementById('counsellor-tab-form');
  const reportTab = document.getElementById('counsellor-tab-report');
  const btnForm = document.getElementById('tab-btn-form');
  const btnReport = document.getElementById('tab-btn-report');

  if (tab === 'form') {
    formTab.classList.remove('hidden');
    reportTab.classList.add('hidden');
    btnForm.className = "px-3 py-1.5 rounded-md bg-white text-slate-900 shadow-sm transition flex items-center gap-1 font-semibold";
    btnReport.className = "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition flex items-center gap-1 font-semibold";
  } else {
    reportTab.classList.remove('hidden');
    formTab.classList.add('hidden');
    btnReport.className = "px-3 py-1.5 rounded-md bg-white text-slate-900 shadow-sm transition flex items-center gap-1 font-semibold";
    btnForm.className = "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition flex items-center gap-1 font-semibold";
  }
  refreshIcons();
}

// ----------------------------------------------------
// Collaboration & Discussion Thread
// ----------------------------------------------------
function renderComments(comments = []) {
  const container = document.getElementById('comments-container');
  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No notes or comments yet. Program management and counsellor can converse here.</p>`;
    return;
  }

  container.innerHTML = comments.map(c => `
    <div class="p-3 rounded-lg border text-xs ${
      c.role === 'Management' 
        ? 'bg-amber-50/50 border-amber-200' 
        : 'bg-emerald-50/50 border-emerald-200'
    }">
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold ${c.role === 'Management' ? 'text-amber-900' : 'text-emerald-900'}">${c.author} (${c.role})</span>
        <span class="text-[10px] text-slate-400">${c.timestamp}</span>
      </div>
      <p class="text-slate-700 leading-relaxed">${c.text}</p>
    </div>
  `).join('');
}

async function postComment() {
  const input = document.getElementById('input-new-comment');
  const text = input.value.trim();
  if (!text || !state.activeStudentId) return;

  const author = state.currentRole === 'counsellor' ? 'Counsellor' : 'Program Management';
  const role = state.currentRole === 'counsellor' ? 'Counsellor' : 'Management';

  try {
    const res = await fetch(`/api/students/${state.activeStudentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, role, text })
    });
    if (!res.ok) throw new Error('Comment failed');
    const updated = await res.json();
    
    const idx = state.students.findIndex(s => s.id === updated.id);
    if (idx !== -1) state.students[idx] = updated;
    
    renderComments(updated.comments);
    input.value = '';
    showToast("Note added to student dossier!");
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// Management Dashboard View
// ----------------------------------------------------
function renderManagementDashboard() {
  const total = state.students.length;
  let green = 0, amber = 0, red = 0;

  state.students.forEach(s => {
    if (s.report) {
      if (s.report.triage_status.includes('🔴') || s.report.triage_status.includes('Requires')) red++;
      else if (s.report.triage_status.includes('🟡') || s.report.triage_status.includes('Mild')) amber++;
      else green++;
    } else {
      green++;
    }
  });

  const elTotal = document.getElementById('mgmt-stat-total');
  const elGreen = document.getElementById('mgmt-stat-green');
  const elAmber = document.getElementById('mgmt-stat-amber');
  const elRed = document.getElementById('mgmt-stat-red');

  if (elTotal) elTotal.innerText = total;
  if (elGreen) elGreen.innerText = green;
  if (elAmber) elAmber.innerText = amber;
  if (elRed) elRed.innerText = red;

  const tableBody = document.getElementById('mgmt-table-body');
  if (!tableBody) return;

  let filtered = state.students;
  if (state.activeFilter === 'red') {
    filtered = filtered.filter(s => s.report && (s.report.triage_status.includes('🔴') || s.report.triage_status.includes('Requires')));
  } else if (state.activeFilter === 'amber') {
    filtered = filtered.filter(s => s.report && (s.report.triage_status.includes('🟡') || s.report.triage_status.includes('Mild')));
  } else if (state.activeFilter === 'green') {
    filtered = filtered.filter(s => !s.report || s.report.triage_status.includes('🟢') || s.report.triage_status.includes('Well'));
  }

  tableBody.innerHTML = filtered.map(s => {
    const dispName = s.is_confidential ? `Candidate ${s.id}` : s.name;
    const triage = s.report ? s.report.triage_status : '🟢 Well-Adapted';
    let badgeClass = triage.includes('🔴') ? 'badge-red' : triage.includes('🟡') ? 'badge-amber' : 'badge-green';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3.5">
          <div class="font-bold text-slate-900">${dispName}</div>
          <span class="text-[10px] text-slate-400 font-mono">${s.id}</span>
        </td>
        <td class="p-3.5 text-slate-600">
          <div>${s.age} Years</div>
          <div class="text-[11px] text-slate-400">${s.is_confidential ? '[Masked]' : s.place}</div>
        </td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${badgeClass}">
            ${triage}
          </span>
        </td>
        <td class="p-3.5 text-slate-700 max-w-xs truncate">
          ${s.questionnaire.worry_overthink || s.observations.anxiety_restlessness || 'General adaptation'}
        </td>
        <td class="p-3.5 text-slate-700 max-w-xs truncate">
          <span class="text-amber-800 font-medium">${s.questionnaire.moula_guidance_practice || 'General discipline'}</span>
        </td>
        <td class="p-3.5 text-right space-x-1">
          <button onclick="viewStudentInManagement('${s.id}')" class="px-2.5 py-1 bg-jamea hover:bg-jamea-light text-white rounded text-xs font-semibold transition">
            View Dossier
          </button>
        </td>
      </tr>
    `;
  }).join('');

  refreshIcons();
}

function filterManagementRoster(filterType) {
  state.activeFilter = filterType;
  const buttons = ['all', 'red', 'amber', 'green'];
  buttons.forEach(b => {
    const el = document.getElementById(`filter-${b}-btn`);
    if (!el) return;
    if (b === filterType) {
      el.className = "px-3 py-1.5 rounded-lg bg-jamea text-white shadow-sm font-semibold";
    } else {
      el.className = "px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200";
    }
  });
  renderManagementDashboard();
}

function viewStudentInManagement(studentId) {
  selectStudent(studentId);
  setRole('counsellor');
  switchCounsellorTab('report');
}

// ----------------------------------------------------
// Cumulative Conclusive Cohort Dossier
// ----------------------------------------------------
async function openCumulativeModal() {
  const modal = document.getElementById('cumulative-modal');
  const container = document.getElementById('cumulative-modal-content');
  modal.classList.remove('hidden');

  container.innerHTML = `<div class="p-8 text-center text-slate-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700"></i>Compiling cumulative cohort dossier...</div>`;
  refreshIcons();

  try {
    const res = await fetch('/api/cumulative');
    const data = await res.json();
    state.cumulativeData = data;

    container.innerHTML = `
      <!-- Cohort Numbers Header -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
          <p class="text-xs font-bold text-emerald-800 uppercase">🟢 Well-Adapted / Thriving</p>
          <h4 class="font-serif text-2xl font-bold text-emerald-900 mt-1">${data.triage_counts['Well-Adapted'] || 0} Students</h4>
          <p class="text-[11px] text-emerald-700 mt-0.5">Smooth transition into campus</p>
        </div>
        <div class="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
          <p class="text-xs font-bold text-amber-800 uppercase">🟡 Mild Observation</p>
          <h4 class="font-serif text-2xl font-bold text-amber-900 mt-1">${data.triage_counts['Mild Observation'] || 0} Students</h4>
          <p class="text-[11px] text-amber-700 mt-0.5">Observational mentor support</p>
        </div>
        <div class="p-3.5 bg-red-50 rounded-xl border border-red-200 text-center">
          <p class="text-xs font-bold text-red-800 uppercase">🔴 Action / 2nd Session</p>
          <h4 class="font-serif text-2xl font-bold text-red-900 mt-1">${data.triage_counts['Requires Follow-up'] || 0} Students</h4>
          <p class="text-[11px] text-red-700 mt-0.5">Scheduled 1-on-1 before camp exit</p>
        </div>
      </div>

      <!-- Executive Overview -->
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 class="font-serif font-bold text-slate-900 text-sm mb-2 text-jamea">1. Executive Pastoral Overview</h3>
        <p class="text-slate-700 leading-relaxed text-xs">${data.executive_overview}</p>
      </div>

      <!-- Prevalent Themes -->
      <div>
        <h3 class="font-serif font-bold text-slate-900 text-sm mb-2 text-jamea">2. Prevalent Cohort Psychological & Developmental Themes</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${data.key_cohort_themes.map(t => `
            <div class="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
              <h4 class="font-bold text-emerald-800 text-xs mb-1">${t.theme}</h4>
              <p class="text-slate-600 text-xs leading-relaxed">${t.observation}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Spiritual Integration -->
      <div class="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
        <h3 class="font-serif font-bold text-amber-900 text-sm mb-1.5 flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-4 h-4 text-amber-700"></i>
          <span>3. Spiritual Assimilation & Practice of Moula's Guidance</span>
        </h3>
        <p class="text-amber-950 text-xs leading-relaxed">${data.spiritual_value_integration_summary}</p>
      </div>

      <!-- Action Roster -->
      ${data.action_roster_high_risk.length > 0 ? `
        <div>
          <h3 class="font-serif font-bold text-slate-900 text-sm mb-2 text-red-800 flex items-center gap-1.5">
            <i data-lucide="alert-octagon" class="w-4 h-4 text-red-600"></i>
            <span>4. Action Roster: Candidates Requiring Pastoral Attention</span>
          </h3>
          <div class="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table class="w-full text-left text-xs divide-y divide-slate-200">
              <thead class="bg-slate-100 text-slate-600 font-semibold">
                <tr>
                  <th class="p-2.5">Candidate</th>
                  <th class="p-2.5">Triage</th>
                  <th class="p-2.5">Primary Concern</th>
                  <th class="p-2.5">Action Plan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                ${data.action_roster_high_risk.map(item => `
                  <tr>
                    <td class="p-2.5 font-bold">${item.name} (${item.age}y, ${item.origin})</td>
                    <td class="p-2.5">
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.triage.includes('🔴') ? 'badge-red' : 'badge-amber'
                      }">${item.triage}</span>
                    </td>
                    <td class="p-2.5 text-slate-700">${item.key_concern}</td>
                    <td class="p-2.5 text-emerald-800 font-medium">${item.action_recommended}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Management Recommendations -->
      <div class="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
        <h3 class="font-serif font-bold text-emerald-900 text-sm mb-2">5. Strategic Recommendations for Saire Ilmi Organizers</h3>
        <ul class="space-y-1 text-xs text-slate-700 list-disc list-inside">
          ${data.management_recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;

    refreshIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-red-600">Error loading cumulative report: ${err.message}</div>`;
  }
}

function closeCumulativeModal() {
  document.getElementById('cumulative-modal').classList.add('hidden');
}

// ----------------------------------------------------
// Exports: Word (.docx) & Browser PDF Printing
// ----------------------------------------------------
function downloadStudentDocx() {
  if (!state.activeStudentId) return;
  window.open(`/api/students/${state.activeStudentId}/export/docx`, '_blank');
}

function downloadCumulativeDocx() {
  window.open(`/api/cumulative/export/docx`, '_blank');
}

function printStudentReport() {
  const student = state.students.find(s => s.id === state.activeStudentId);
  if (!student || !student.report) {
    alert("Please generate or synthesize a report first before printing.");
    return;
  }

  const dispName = student.is_confidential ? `Candidate ${student.id} (CONFIDENTIAL)` : student.name;
  const dispPlace = student.is_confidential ? '[City Masked]' : student.place;
  const dispParents = student.is_confidential ? '[Family Details Confidential]' : `Father: ${student.fathers_occupation} | Mother: ${student.mothers_occupation}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Saire Ilmi Report - ${dispName}</title>
      <style>
        body { font-family: 'Georgia', serif; color: #1e293b; padding: 25px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #b48e3c; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #143829; font-size: 22px; margin: 0; font-weight: bold; letter-spacing: 1px; }
        .header h3 { color: #b48e3c; font-size: 13px; margin: 5px 0 0 0; text-transform: uppercase; font-family: sans-serif; font-weight: bold; }
        .header p { font-size: 11px; color: #64748b; margin-top: 4px; font-family: sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; font-family: sans-serif; background: #f8fafc; border: 1px solid #e2e8f0; }
        td { padding: 8px 12px; border: 1px solid #e2e8f0; }
        h4 { color: #143829; font-family: Georgia, serif; font-size: 14px; margin: 16px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        p { font-size: 12.5px; margin: 0 0 10px 0; font-family: sans-serif; }
        .remarks { font-weight: 500; color: #143829; }
        .exercises { white-space: pre-line; background: #f8fafc; padding: 10px; border-radius: 6px; border-left: 3px solid #143829; }
        .signatures { margin-top: 45px; display: flex; justify-content: space-between; font-size: 11px; font-family: sans-serif; color: #475569; }
        @media print {
          body { padding: 0; }
          @page { size: A4 portrait; margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AL JAMEA TUS SAIFIYAH</h1>
        <h3>Saire Ilmi Program — Student Counselling & Psychological Evaluation</h3>
        <p>Official Pastoral Record • Academic Year 1448H</p>
      </div>

      <table>
        <tr>
          <td><b>Candidate Name:</b> ${dispName}</td>
          <td><b>Age:</b> ${student.age} Years</td>
        </tr>
        <tr>
          <td><b>Origin / Place:</b> ${dispPlace}</td>
          <td><b>Program Batch:</b> ${student.batch}</td>
        </tr>
        <tr>
          <td><b>Family Background:</b> ${dispParents}</td>
          <td><b>Triage Status:</b> <b>${student.report.triage_status}</b></td>
        </tr>
      </table>

      <h4>1. Executive Summary & Program Adaptation</h4>
      <p>${student.report.executive_summary}</p>

      <h4>2. Emotional Profile, Self-Concept & Coping Mechanisms</h4>
      <p>${student.report.emotional_profile}</p>

      <h4>3. Social & Family Ecosystem</h4>
      <p>${student.report.social_family_dynamics}</p>

      <h4>4. Academic Orientation & Future Aspirations</h4>
      <p>${student.report.academic_future_outlook}</p>

      <h4>5. Institutional & Spiritual Value Alignment (Saire Ilmi Ethos)</h4>
      <p>${student.report.institutional_value_alignment}</p>

      <h4>6. Counsellor's Professional Remarks & Clinical Judgement</h4>
      <p class="remarks">${student.report.counsellor_remarks}</p>

      <h4>7. Prescribed Exercises & Recommended Routines</h4>
      <p class="exercises">${student.report.prescribed_exercises}</p>

      ${student.report.follow_up_notes ? `
        <h4 style="color: #991b1b; border-bottom-color: #fee2e2;">8. Follow-up / Pastoral Action Plan</h4>
        <p style="color: #7f1d1d;">${student.report.follow_up_notes}</p>
      ` : ''}

      <div class="signatures">
        <div>
          <p>Evaluation Date: ${new Date(student.created_at).toLocaleDateString()}</p>
          <p>Record ID: ${student.id}</p>
        </div>
        <div style="text-align: right;">
          <p>_____________________________________</p>
          <p>Lead Counsellor & Pastoral Evaluator<br>Al Jamea tus Saifiyah</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

function printCumulativeReport() {
  if (!state.cumulativeData) return;
  const d = state.cumulativeData;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Saire Ilmi - Cumulative Cohort Dossier</title>
      <style>
        body { font-family: 'Georgia', serif; color: #1e293b; padding: 25px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #b48e3c; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #143829; font-size: 22px; margin: 0; font-weight: bold; }
        .header h3 { color: #b48e3c; font-size: 13px; margin: 5px 0 0 0; text-transform: uppercase; font-family: sans-serif; font-weight: bold; }
        .header p { font-size: 11px; color: #64748b; margin-top: 4px; font-family: sans-serif; }
        h4 { color: #143829; font-family: Georgia, serif; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px; }
        p, li { font-size: 12.5px; font-family: sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; font-family: sans-serif; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #f1f5f9; }
        @media print {
          body { padding: 0; }
          @page { size: A4 portrait; margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AL JAMEA TUS SAIFIYAH</h1>
        <h3>Saire Ilmi Program — Cumulative Conclusive Cohort Dossier</h3>
        <p>Generated: ${d.generated_at} | Total Candidates Counselled: ${d.total_evaluated}</p>
      </div>

      <h4>1. Executive Pastoral Overview</h4>
      <p>${d.executive_overview}</p>

      <h4>2. Spiritual Assimilation & Moula's Guidance</h4>
      <p>${d.spiritual_value_integration_summary}</p>

      ${d.action_roster_high_risk && d.action_roster_high_risk.length > 0 ? `
        <h4>3. Action Roster (Candidates Requiring Continued Attention)</h4>
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Triage Level</th>
              <th>Primary Concern</th>
              <th>Recommended Next Step</th>
            </tr>
          </thead>
          <tbody>
            ${d.action_roster_high_risk.map(item => `
              <tr>
                <td><b>${item.name}</b> (${item.age}y, ${item.origin})</td>
                <td>${item.triage}</td>
                <td>${item.key_concern}</td>
                <td>${item.action_recommended}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <h4>4. Strategic Recommendations for Organizers</h4>
      <ul>
        ${d.management_recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

// ----------------------------------------------------
// Quick-Fill Demo & New Student Creation
// ----------------------------------------------------
function loadAbbasDemoData() {
  const abbas = state.students.find(s => s.name.toLowerCase().includes('abbas'));
  if (abbas) {
    selectStudent(abbas.id);
    switchCounsellorTab('form');
    showToast("Loaded Abbas's evaluation intake from sheet!");
  }
}

async function createNewStudent() {
  const newStd = {
    id: `SI-2026-${Math.floor(100 + Math.random() * 900)}`,
    name: "New Candidate",
    age: 15,
    fathers_occupation: "",
    mothers_occupation: "",
    place: "",
    batch: "Batch 2026-A",
    is_confidential: false,
    status: "Draft",
    questionnaire: {
      pre_session_query: "",
      strengths_rely_on: "",
      weaknesses_not_rely_on: "",
      worry_overthink: "",
      enjoy_3_things: "",
      insecure_uncomfortable: "",
      proud_of_yourself: "",
      confidence_source: "",
      feel_understood: "Yes",
      go_to_person: "",
      parents_different: "",
      study_motivation: "",
      future_career: "",
      adult_life_imagined: "",
      fears_barriers_future: "",
      alter_improve_self: "",
      magic_button_wish: "",
      session_feeling: "",
      unshared_thoughts: "",
      takeaway: "",
      moula_guidance_practice: ""
    },
    observations: {
      emotional_expression: "Fully Expressive",
      confidence_level: "Confident",
      anxiety_restlessness: "A little bit",
      clarity_vs_confusion: "Clear",
      family_pressure_themes: "No",
      fear_of_failure_judgement: "Mild",
      motivational_level: "High",
      identity_struggles: "None Observed",
      peer_influence: "Positive",
      emotional_maturity: "Good"
    },
    counsellor_raw_remarks: "",
    prescribed_exercise_raw: "",
    comments: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStd)
    });
    if (!res.ok) throw new Error('Create failed');
    const created = await res.json();
    state.students.unshift(created);
    selectStudent(created.id);
    switchCounsellorTab('form');
    showToast("New student intake created!");
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// Settings & Account Credential Management
// ----------------------------------------------------
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  if (state.currentUser) {
    document.getElementById('setting-display-name').value = state.currentUser.name || '';
    document.getElementById('setting-username').value = state.currentUser.username || '';
    document.getElementById('setting-password').value = '';
  }
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

async function saveAccountSettings() {
  if (!state.currentUser) return;
  const name = document.getElementById('setting-display-name').value.trim();
  const username = document.getElementById('setting-username').value.trim();
  const password = document.getElementById('setting-password').value.trim();

  if (!name || !username) {
    alert("Display name and username cannot be blank.");
    return;
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.currentUser.id,
        name: name,
        username: username,
        password: password || null
      })
    });
    if (!res.ok) throw new Error('Failed to update credentials');
    const updated = await res.json();
    state.currentUser = updated;
    localStorage.setItem('saire_ilmi_user', JSON.stringify(updated));
    applyUserRole(updated);
    closeSettingsModal();
    showToast("Account credentials updated successfully!");
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function exportAllDataJson() {
  try {
    const res = await fetch('/api/students');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Saire_Ilmi_Database_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Database exported to JSON!");
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

// ----------------------------------------------------
// Delete Candidate Entry
// ----------------------------------------------------
async function confirmDeleteActiveStudent() {
  if (!state.activeStudentId) return;
  const student = state.students.find(s => s.id === state.activeStudentId);
  const studentName = student ? (student.is_confidential ? `Candidate ${student.id}` : student.name) : "this student";

  if (!confirm(`Are you sure you want to permanently delete ${studentName}? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/students/${state.activeStudentId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Deletion failed');

    state.students = state.students.filter(s => s.id !== state.activeStudentId);
    showToast(`${studentName} removed from roster.`);

    if (state.students.length > 0) {
      selectStudent(state.students[0].id);
    } else {
      createNewStudent();
    }
    renderStudentList();
    renderManagementDashboard();
  } catch (err) {
    alert("Delete error: " + err.message);
  }
}

async function saveApiKey() {
  const key = document.getElementById('input-api-key').value.trim();
  try {
    const res = await fetch('/api/settings/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key })
    });
    const data = await res.json();
    closeSettingsModal();
    await checkApiKeyStatus();
    showToast(key ? "Gemini API Key saved!" : "Reverted to Expert Clinical Engine");
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// UI Toast Notification
// ----------------------------------------------------
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = "fixed bottom-5 right-5 bg-jamea text-white px-4 py-2.5 rounded-lg shadow-xl text-xs z-50 flex items-center gap-2 border border-amber-400/40 animate-fade-in";
  toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-amber-300"></i><span>${msg}</span>`;
  document.body.appendChild(toast);
  refreshIcons();
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

