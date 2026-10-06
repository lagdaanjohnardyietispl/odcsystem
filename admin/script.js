/* =========================================
   MOBILE HELPERS
   - Builds the top bar + slide-out menu button on phones
   - Labels table cells (data-label) so tables can show as stacked cards
========================================= */
(function () {
    'use strict';

    function initMobileNav() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || document.querySelector('.mobile-topbar')) return;

        const logo = sidebar.querySelector('.sidebar-brand img');
        const bar = document.createElement('div');
        bar.className = 'mobile-topbar';
        bar.innerHTML =
            '<button type="button" class="mobile-menu-btn" aria-label="Open menu" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>' +
            (logo ? '<img src="' + logo.getAttribute('src') + '" alt="">' : '') +
            '<span>Oralux Dental</span>';
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.insertBefore(bar, document.body.firstChild);
        document.body.appendChild(backdrop);

        const btn = bar.querySelector('.mobile-menu-btn');
        const setOpen = (open) => {
            document.body.classList.toggle('nav-open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        btn.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
        backdrop.addEventListener('click', () => setOpen(false));
        sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
        window.addEventListener('resize', () => { if (window.innerWidth > 900) setOpen(false); });
    }

    function labelTables() {
        document.querySelectorAll('table').forEach(table => {
            if (table.closest('.calendar')) return;
            table.classList.add('rt');
            const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim());
            table.querySelectorAll('tbody tr').forEach(tr => {
                Array.from(tr.children).forEach((td, i) => {
                    if (td.colSpan > 1 || !heads[i]) return;
                    if (td.dataset.label !== heads[i]) td.dataset.label = heads[i];
                });
            });
        });
    }

    let queued = false;
    function queueLabel() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; labelTables(); });
    }

    function start() {
        initMobileNav();
        labelTables();
        // tables are re-drawn by other scripts whenever data loads or filters change
        new MutationObserver(queueLabel).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

/* =========================================
   0. AUTH SLIDER & LOGIN HANDLERS
   Real accounts via Supabase Auth — signUp()/signInWithPassword() below —
   instead of the old localStorage-only system. Login is by EMAIL, not
   username (Supabase Auth's native identifier); a username is still
   collected at registration and stored in a "profiles" table for display.
========================================= */
function openRegister() {
    const container = document.getElementById('authContainer');
    if (container) container.classList.add('active');
}

function openLogin() {
    const container = document.getElementById('authContainer');
    if (container) container.classList.remove('active');
}

/* =========================================
   0z. STAFF APPROVAL STATUS
   New accounts land in "profiles.status = 'pending'" (set by the column
   default in Supabase — see the setup guide) and can't use the dashboard
   until an existing approved staff member flips them to 'approved' from
   the "Pending Staff Approvals" panel on the Dashboard page.
========================================= */
async function getProfileStatus(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('status')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('Failed to check profile status:', error);
        // Fail closed: if we can't verify approval, don't let them in.
        return null;
    }

    return data ? data.status : null;
}

// Stashes a message in sessionStorage so it survives the redirect to
// login.html, then shows it once the login page has loaded.
function redirectToLoginWithMessage(message, type = 'error') {
    sessionStorage.setItem('authRedirectMessage', JSON.stringify({ message, type }));
    window.location.href = 'login.html';
}

function showPendingRedirectMessageIfAny() {
    const raw = sessionStorage.getItem('authRedirectMessage');
    if (!raw) return;
    sessionStorage.removeItem('authRedirectMessage');
    try {
        const { message, type } = JSON.parse(raw);
        showNotification(message, type);
    } catch (e) { /* ignore malformed value */ }
}

/* =========================================
   PASSWORD RULES (registration + password reset)
   Min 8 characters, with an uppercase letter, a lowercase letter, a
   number and a special character. Login is NOT checked against these, so
   older accounts with weaker passwords can still sign in (and then change
   it through "Forgot Password?").
========================================= */
const PASSWORD_RULES = [
    { id: 'len',   label: 'At least 8 characters',   test: p => p.length >= 8 },
    { id: 'upper', label: 'One uppercase letter',    test: p => /[A-Z]/.test(p) },
    { id: 'lower', label: 'One lowercase letter',    test: p => /[a-z]/.test(p) },
    { id: 'num',   label: 'One number',              test: p => /[0-9]/.test(p) },
    { id: 'sym',   label: 'One special character',   test: p => /[^A-Za-z0-9]/.test(p) }
];

function getPasswordProblems(password) {
    return PASSWORD_RULES.filter(rule => !rule.test(password)).map(rule => rule.label.toLowerCase());
}

// Ticks/unticks the checklist under a password field as the user types.
function updatePasswordChecklist(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;
    PASSWORD_RULES.forEach(rule => {
        const li = list.querySelector(`[data-rule="${rule.id}"]`);
        if (li) li.classList.toggle('met', rule.test(input.value));
    });
}

// "Passwords match / do not match" line under the confirm box in the reset popup
function updatePasswordMatchHint() {
    const hint = document.getElementById('forgotMatchHint');
    const a = document.getElementById('forgot-new-password');
    const b = document.getElementById('forgot-confirm-password');
    if (!hint || !a || !b) return;
    if (!b.value) {
        hint.textContent = '';
        hint.className = 'password-match-hint';
        return;
    }
    const same = a.value === b.value;
    hint.textContent = same ? 'Passwords match' : 'Passwords do not match';
    hint.className = 'password-match-hint ' + (same ? 'ok' : 'bad');
}

function passwordErrorMessage(password) {
    const problems = getPasswordProblems(password);
    if (!problems.length) return '';
    return 'Password needs: ' + problems.join(', ') + '.';
}

/* =========================================
   SHOW / HIDE PASSWORD
   Adds an eye button inside every password box (sign in, register and the
   forgot-password popup).
========================================= */
function addPasswordToggles() {
    document.querySelectorAll('.input-icon-wrapper input[type="password"]').forEach(input => {
        const wrapper = input.parentElement;
        if (wrapper.querySelector('.pw-toggle')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-toggle';
        btn.setAttribute('aria-label', 'Show password');
        btn.title = 'Show password';
        btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            btn.title = show ? 'Hide password' : 'Show password';
            input.focus();
        });
        wrapper.appendChild(btn);
        input.classList.add('has-pw-toggle');
    });
}
addPasswordToggles();

async function register() {
    const usernameInput = document.getElementById('reg-username');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const requestedRole = document.getElementById('reg-role')?.value === 'dentist' ? 'dentist' : 'staff';

    const username = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username || !email || !password) {
        showNotification('Please fill in all registration fields.', 'error');
        return;
    }

    const passwordError = passwordErrorMessage(password);
    if (passwordError) {
        showNotification(passwordError, 'error');
        return;
    }

    if (!supabaseClient) {
        showNotification('Registration requires a live Supabase connection.', 'error');
        return;
    }

    // The "username" is passed as user metadata; a database trigger (see the
    // setup guide) copies it into a "profiles" row automatically — this
    // works whether or not email confirmation is required, since it runs
    // server-side rather than depending on the browser having a session yet.
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username, requested_role: requestedRole } }
    });

    if (error) {
        showNotification(error.message, 'error');
        return;
    }

    if (usernameInput) usernameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    updatePasswordChecklist('reg-password', 'regPasswordRules');

    // New accounts always start as "pending" (see profiles.status default)
    // and must be approved by an existing staff member before they can sign
    // in — so we never auto-redirect into the dashboard from here, even if
    // Supabase handed back an active session.
    if (data.session) {
        await supabaseClient.auth.signOut();
    }

    showNotification(
        requestedRole === 'dentist'
            ? 'Dentist account created! An admin needs to approve it before you can log in.'
            : 'Account created! An existing staff admin needs to approve it before you can log in.',
        'success'
    );
    openLogin();
}

async function login() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('password');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!email || !password) {
        showNotification('Please enter both email and password.', 'error');
        return;
    }

    if (!supabaseClient) {
        showNotification('Login requires a live Supabase connection.', 'error');
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        showNotification(
            error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message,
            'error'
        );
        return;
    }

    const status = await getProfileStatus(data.user.id);

    if (status !== 'approved') {
        await supabaseClient.auth.signOut();
        if (status === 'pending' || status === null) {
            showNotification('Your account is awaiting admin approval. Please check back later.', 'error');
        } else {
            showNotification('This account has been declined. Contact the clinic admin.', 'error');
        }
        return;
    }

    showNotification('Login successful! Redirecting...', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

/* =========================================
   ADMIN UI CACHE
   The Staff link, the earnings card and the Staff page sections are admin-only.
   Checking the role needs a round trip to the server, so on every refresh or
   page change they used to be missing for a moment (or longer on a slow
   connection). The last known role is remembered in this browser and applied
   instantly; the server check that follows corrects it if it changed.
   This is cosmetic only - the server still enforces who can see staff data.
========================================= */
const ADMIN_CACHE_KEY = 'dental_admin_ui_cache';

function readAdminCache() {
    try { return JSON.parse(localStorage.getItem(ADMIN_CACHE_KEY)) || {}; } catch (e) { return {}; }
}
function writeAdminCache(patch) {
    try { localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ ...readAdminCache(), ...patch })); } catch (e) { /* storage unavailable */ }
}
function clearAdminCache() {
    try { localStorage.removeItem(ADMIN_CACHE_KEY); } catch (e) { /* ignore */ }
}

// Show / hide everything that is only for admins
function setAdminUI(isAdmin) {
    const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = isAdmin ? '' : 'none'; };
    show('staffNavItem');
    show('earningCard');
    show('pendingApprovalsSection');
    show('staffManagementSection');
    const edit = document.getElementById('editSlotsBtn');
    if (edit) edit.style.display = isAdmin ? '' : 'none';
}

// Runs immediately (script sits at the end of <body>): no waiting for the network
(function applyCachedAdminUI() {
    const cached = readAdminCache();
    if (cached.role !== 'admin') return;
    setAdminUI(true);
    const badge = document.getElementById('navPendingBadge');
    if (badge && cached.pending > 0) { badge.textContent = cached.pending; badge.style.display = ''; }
})();

async function logout() {
    clearAdminCache();
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    window.location.href = 'login.html';
}

/* =========================================
   0a. PAGE GUARD
   Runs immediately (not waiting for DOMContentLoaded) on every page except
   login.html itself, and sends anyone without a valid session back to it.
   The reverse also applies: an already-logged-in visitor to login.html is
   sent straight to the dashboard instead of seeing the login form again.
========================================= */
// Pages start hidden (see the AUTH GATE in each page's <head>) and are only
// revealed once the session has been checked, so nobody sees the dashboard
// flash up before being sent to the login page.
function revealPage() {
    document.documentElement.classList.remove('auth-pending');
}

async function requireAuth() {
    if (!supabaseClient) { revealPage(); return; }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('login.html');
        return;
    }

    const status = await getProfileStatus(session.user.id);
    if (status !== 'approved') {
        await supabaseClient.auth.signOut();
        redirectToLoginWithMessage(
            status === 'pending' || status === null
                ? 'Your account is awaiting admin approval. Please check back later.'
                : 'This account has been declined. Contact the clinic admin.'
        );
        return;
    }
    revealPage();
}

async function redirectIfAlreadyLoggedIn() {
    if (!supabaseClient) { revealPage(); return; }

    // Arriving from an emailed password-reset link carries a temporary
    // session. Don't treat that as "already logged in" - the visitor must
    // see the "set a new password" popup instead.
    if (window.location.hash.includes('type=recovery') ||
        new URLSearchParams(window.location.search).has('code')) {
        revealPage();
        return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.replace('index.html');
        return;
    }
    revealPage();
}

// (invoked further down, once the Supabase client below actually exists)

/* =========================================
   0b. FORGOT PASSWORD
   A real emailed reset link via Supabase Auth. Step 1 sends the email;
   step 2 (setting a new password) only becomes reachable by actually
   clicking that link, which is what fires the PASSWORD_RECOVERY event below.
========================================= */
function openForgotPassword() {
    const overlay = document.getElementById('forgotPasswordOverlay');
    if (!overlay) return;

    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
    const emailField = document.getElementById('forgot-email');
    if (emailField) emailField.value = '';

    overlay.classList.add('active');
}

function closeForgotPassword() {
    const overlay = document.getElementById('forgotPasswordOverlay');
    if (overlay) overlay.classList.remove('active');
}

async function sendPasswordResetEmail() {
    const email = document.getElementById('forgot-email')?.value.trim();

    if (!email) {
        showNotification('Enter the email you registered with.', 'error');
        return;
    }

    if (!supabaseClient) {
        showNotification('Password reset requires a live Supabase connection.', 'error');
        return;
    }

    // Admin and dentist passwords can only be changed by the super admin.
    const policy = await supabaseClient.rpc('can_self_reset_password', { p_email: email });
    if (!policy.error && policy.data === false) {
        showNotification('Admin and dentist accounts can\u2019t reset their own password. Please ask the super admin to reset it for you.', 'error');
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });

    if (error) {
        showNotification(error.message, 'error');
        return;
    }

    // Same message whether or not the email is actually registered, so this
    // form can't be used to check who has an account.
    showNotification("If that email is registered, a reset link is on its way.", 'success');
    closeForgotPassword();
}

async function submitNewPassword() {
    const newPassword = document.getElementById('forgot-new-password')?.value.trim();
    const confirmPassword = document.getElementById('forgot-confirm-password')?.value.trim();

    if (!newPassword || !confirmPassword) {
        showNotification('Please fill in both password fields.', 'error');
        return;
    }

    const newPasswordError = passwordErrorMessage(newPassword);
    if (newPasswordError) {
        showNotification(newPasswordError, 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match.', 'error');
        return;
    }

    if (!supabaseClient) {
        showNotification('Password reset requires a live Supabase connection.', 'error');
        return;
    }

    // Second check on the reset-link page: privileged accounts can't set their own password here.
    const { data: { session: recoverySession } } = await supabaseClient.auth.getSession();
    if (recoverySession && recoverySession.user.email) {
        const policy = await supabaseClient.rpc('can_self_reset_password', { p_email: recoverySession.user.email });
        if (!policy.error && policy.data === false) {
            showNotification('Admin and dentist accounts can\u2019t reset their own password. Please ask the super admin to reset it for you.', 'error');
            await supabaseClient.auth.signOut();
            closeForgotPassword();
            return;
        }
    }

    // Set the new password straight away - no admin approval is needed.
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        showNotification(error.message, 'error');
        return;
    }

    document.getElementById('forgot-new-password').value = '';
    document.getElementById('forgot-confirm-password').value = '';
    updatePasswordChecklist('forgot-new-password', 'forgotPasswordRules');
    updatePasswordMatchHint();

    showNotification('Password updated! Please log in with your new password.', 'success');
    closeForgotPassword();
    await supabaseClient.auth.signOut(); // the recovery session shouldn't linger as a real login
}

// Arriving here via the emailed reset link jumps straight to "set a new
// password" instead of the normal "request a reset" step — see the
// PASSWORD_RECOVERY listener attached right after the Supabase client below.

/* =========================================
   1. SUPABASE CLIENT & GLOBAL STATE
========================================= */
const SUPABASE_URL = 'https://hjugipwtfilcqbwhncjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t4pKFwNIzyrEu9OGLwHVhA_iVKE2mZl';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Page guard: runs as early as possible, right as the client becomes
    // available, rather than waiting for DOMContentLoaded.
    if (window.location.pathname.endsWith('login.html')) {
        redirectIfAlreadyLoggedIn();
        showPendingRedirectMessageIfAny();
    } else {
        requireAuth();
    }

    // Arriving via the emailed password-reset link fires this event —
    // jump straight to the "set a new password" step (see forgot-password
    // functions above) instead of the normal "request a reset" step.
    supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            const overlay = document.getElementById('forgotPasswordOverlay');
            if (overlay) {
                document.getElementById('forgotStep1').style.display = 'none';
                document.getElementById('forgotStep2').style.display = 'block';
                overlay.classList.add('active');
            }
        }
    });
}

// Global Data Store
let appointmentsData = [];
let DAILY_MAX_SLOTS = 10; // appointments allowed per day; admins can change it (saved in clinic_settings)
let currentCalendarDate = new Date();
let selectedFilterDate = null;

// Chart Instances Tracker
let weeklyChartInstance = null;
let treatmentsChartInstance = null;

// Helper: Get local date string YYYY-MM-DD
function getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* =========================================
   DAILY APPOINTMENT LIMIT (admin-adjustable)
   Stored in the clinic_settings table so every staff member sees the same
   number. Everyone can read it; only admins can change it (via the
   admin_set_daily_max_slots function).
========================================= */
async function loadClinicSettings() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('clinic_settings')
            .select('value')
            .eq('key', 'daily_max_slots')
            .maybeSingle();

        if (error) throw error;

        const value = parseInt(data && data.value, 10);
        if (Number.isInteger(value) && value >= 1 && value <= 100) {
            DAILY_MAX_SLOTS = value;
        }
    } catch (err) {
        console.warn('Using the default daily limit:', err.message || err);
    }
}

// Slots left today = daily limit minus today's appointments that aren't canceled.
function computeAvailableSlots() {
    const todayStr = getLocalDateString();
    const used = appointmentsData.filter(item => {
        const st = (item.status || '').toLowerCase();
        return item.date === todayStr && st !== 'canceled' && st !== 'cancelled';
    }).length;
    return Math.max(0, DAILY_MAX_SLOTS - used);
}

function initSlotsEditor() {
    const editBtn = document.getElementById('editSlotsBtn');
    const overlay = document.getElementById('slotsLimitOverlay');
    if (!editBtn || !overlay) return; // not the dashboard

    getMyRole().then(role => {
        if (role === 'admin') editBtn.style.display = '';
    });

    const input = document.getElementById('dailySlotsInput');
    const saveBtn = document.getElementById('slotsLimitSaveBtn');
    const close = () => overlay.classList.remove('active');

    editBtn.addEventListener('click', () => {
        input.value = DAILY_MAX_SLOTS;
        overlay.classList.add('active');
        input.focus();
        input.select();
    });
    document.getElementById('slotsLimitCancelBtn').addEventListener('click', close);
    document.getElementById('slotsLimitCloseBtn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

    saveBtn.addEventListener('click', async () => {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 1 || value > 100) {
            showNotification('Enter a whole number from 1 to 100.', 'error');
            return;
        }
        if (!supabaseClient) return;

        saveBtn.disabled = true;
        const { error } = await supabaseClient.rpc('admin_set_daily_max_slots', { new_value: value });
        saveBtn.disabled = false;

        if (error) {
            console.error('Failed to save daily limit:', error);
            showNotification(`Couldn't save the limit: ${error.message}`, 'error');
            return;
        }

        DAILY_MAX_SLOTS = value;
        const slotsElem = document.getElementById('availableSlots');
        if (slotsElem) slotsElem.textContent = computeAvailableSlots();

        close();
        showNotification(`Daily limit set to ${value} appointments.`, 'success');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Who-is-signed-in work goes FIRST and is not held up by the (slower)
    // appointment data below, so the Staff link and admin sections show right away.
    initAdminNav();
    loadPendingApprovals();
    loadWelcomeMessage();

    await loadClinicSettings();
    await fetchDashboardData();
    initModal();
    initSearchAndFilter();
    initInteractiveCalendar();
    initScheduleSearch();
    setupFormSubmission();
    initPatientPageSearch();
    initSlotsEditor();
});

/* =========================================
   1a. PENDING STAFF APPROVALS (staff.html only)
   Lists any profiles.status = 'pending' accounts so an approved staff
   member can let a new hire in, or reject an account that shouldn't have
   access. The panel only renders itself if #pendingApprovalsTable exists
   on the current page (i.e. staff.html), so it's a no-op elsewhere.
========================================= */
// Username + role of the signed-in user, for the dashboard welcome line.
// Falls back to the part of the email before the "@" if no username is stored.
async function getMyProfile() {
    if (!supabaseClient) return null;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    let { data, error } = await supabaseClient
        .from('profiles')
        .select('username, role, account_type')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        // account_type column not created yet - fall back to the basics
        ({ data, error } = await supabaseClient
            .from('profiles')
            .select('username, role')
            .eq('id', session.user.id)
            .maybeSingle());
        if (error) console.error('Failed to load profile:', error);
    }

    const emailName = (session.user.email || '').split('@')[0];
    return {
        username: (data && data.username) || emailName || 'there',
        role: (data && data.role) || 'staff',
        accountType: (data && data.account_type) || ((data && data.role) === 'admin' ? 'admin' : 'staff')
    };
}

/* =========================================
   ACCOUNT TYPES
   profiles.role stays 'admin' or 'staff' (so every existing admin rule keeps
   working). profiles.account_type says WHICH kind of admin:
     super_admin - the owner: can also reset admin / dentist passwords
     admin       - regular administrator
     dentist     - sees and can do everything an admin can
     staff       - regular staff
========================================= */
const ACCOUNT_TYPE_LABELS = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    dentist: 'Dentist',
    staff: 'Staff'
};

let myAccountTypePromise = null;
function getMyAccountType() {
    if (!myAccountTypePromise) {
        myAccountTypePromise = (async () => {
            if (!supabaseClient) return null;
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return null;
            const { data, error } = await supabaseClient
                .from('profiles').select('account_type').eq('id', session.user.id).maybeSingle();
            if (error) return null;   // column not created yet: treated as "not super admin"
            return data ? data.account_type : null;
        })();
    }
    return myAccountTypePromise;
}

async function loadWelcomeMessage() {
    const nameEl = document.getElementById('welcomeUsername');
    if (!nameEl) return; // not the dashboard

    const profile = await getMyProfile();
    if (!profile) return;

    // "aldrin madredio" -> "Aldrin Madredio"
    nameEl.textContent = profile.username.replace(/\b\w/g, c => c.toUpperCase());

    const titleEl = document.getElementById('dashboardTitle');
    if (titleEl) titleEl.textContent = profile.role === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard';

    const roleEl = document.getElementById('welcomeRole');
    if (roleEl) roleEl.textContent = ACCOUNT_TYPE_LABELS[profile.accountType] || (profile.role === 'admin' ? 'Administrator' : 'Staff');

    const line = document.getElementById('welcomeLine');
    if (line) line.style.display = '';
}

// One shared lookup (several parts of the page ask for the role at once)
let myRolePromise = null;
function getMyRole() {
    if (!myRolePromise) {
        myRolePromise = fetchMyRoleFromServer().then(role => {
            if (role === null) myRolePromise = null;   // unknown: allow a retry
            return role;
        });
    }
    return myRolePromise;
}

async function fetchMyRoleFromServer() {
    if (!supabaseClient) return null;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        console.error('Failed to check role:', error);
        return null; // fail closed: unknown role = no admin panel
    }

    const role = data ? data.role : null;
    if (role === 'admin') writeAdminCache({ role: 'admin' });
    else clearAdminCache();
    return role;
}

/* Sidebar "Staff" link: shown to admins only, with a red badge counting
   accounts still waiting for approval (so pending requests stay noticeable
   now that they no longer sit on the dashboard). */
function setNavPendingBadge(count) {
    const badge = document.getElementById('navPendingBadge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
    writeAdminCache({ pending: count });
}

async function initAdminNav() {
    const navItem = document.getElementById('staffNavItem');
    if (!navItem || !supabaseClient) return;

    const role = await getMyRole();
    if (role !== 'admin') {
        if (role !== null) setAdminUI(false);   // cached admin look was stale
        return; // stays hidden for regular staff
    }

    setAdminUI(true);
    navItem.style.display = '';

    // Monthly earnings on the dashboard are for admins only.
    const earningCard = document.getElementById('earningCard');
    if (earningCard) earningCard.style.display = '';

    const { count, error } = await supabaseClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (!error) setNavPendingBadge(count || 0);
}

async function loadPendingApprovals() {
    const tbody = document.querySelector('#pendingApprovalsTable tbody');
    if (!tbody || !supabaseClient) return;

    // Only admins ever see this panel. Staff accounts leave it hidden and
    // never even request the pending list. (Supabase RLS enforces the same
    // rule server-side, so this isn't just cosmetic.)
    const role = await getMyRole();
    if (role !== 'admin') {
        // Regular staff have no business on this page - send them back to the dashboard.
        window.location.href = 'index.html';
        return;
    }

    const section = document.getElementById('pendingApprovalsSection');
    if (section) section.style.display = '';

    loadStaffManagement();
    loadSuperAdminSection();
    initBackupSection();

    let { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, status, created_at, password_reset_requested_at, requested_role')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        // requested_role column not created yet - load the list without it
        ({ data, error } = await supabaseClient
            .from('profiles')
            .select('id, username, status, created_at, password_reset_requested_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: true }));
    }

    if (error) {
        console.error('Failed to load pending approvals:', error);
        tbody.innerHTML = `<tr><td colspan="3">Couldn't load pending accounts.</td></tr>`;
        return;
    }

    renderPendingApprovals(data || []);
}

function renderPendingApprovals(rows) {
    const tbody = document.querySelector('#pendingApprovalsTable tbody');
    const badge = document.getElementById('pendingApprovalsCount');
    if (!tbody) return;

    if (badge) badge.textContent = rows.length;
    setNavPendingBadge(rows.length);

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="color: var(--text-muted, #888);">No accounts waiting for approval.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    rows.forEach(profile => {
        const row = tbody.insertRow();

        const isReset = !!profile.password_reset_requested_at;

        const nameCell = row.insertCell();
        nameCell.textContent = profile.username || '(no username)';
        const tag = document.createElement('span');
        tag.className = isReset ? 'request-tag request-tag-reset' : 'request-tag';
        const wantsDentist = profile.requested_role === 'dentist';
        tag.textContent = isReset ? 'Password reset' : (wantsDentist ? 'New account \u00b7 Dentist' : 'New account');
        nameCell.appendChild(tag);

        const dateCell = row.insertCell();
        const requestedAt = isReset ? profile.password_reset_requested_at : profile.created_at;
        dateCell.textContent = requestedAt
            ? formatLongDateTime(requestedAt)
            : '—';

        const actionCell = row.insertCell();

        const approveBtn = document.createElement('button');
        approveBtn.textContent = 'Approve';
        approveBtn.className = 'btn-icon btn-view';
        approveBtn.style.cssText = 'width:auto; padding:6px 12px; margin-right:6px;';
        approveBtn.onclick = () => setProfileApprovalStatus(profile.id, 'approved', row, isReset);

        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = 'Reject';
        rejectBtn.className = 'btn-icon btn-cancel';
        rejectBtn.style.cssText = 'width:auto; padding:6px 12px;';
        rejectBtn.onclick = () => setProfileApprovalStatus(profile.id, 'rejected', row, isReset);

        actionCell.append(approveBtn, rejectBtn);
    });
}

async function setProfileApprovalStatus(profileId, status, row, isReset = false) {
    if (!supabaseClient) return;

    let error;
    if (status === 'approved') {
        // The database function also gives an approved Dentist the admin-level view.
        const rpcResult = await supabaseClient.rpc('admin_approve_account', { p_id: profileId });
        error = rpcResult.error;
        if (error && /admin_approve_account|schema cache|does not exist/i.test(error.message || '')) {
            // setup SQL not run yet: plain approval like before
            ({ error } = await supabaseClient.from('profiles').update({ status }).eq('id', profileId));
        }
    } else {
        ({ error } = await supabaseClient.from('profiles').update({ status }).eq('id', profileId));
    }

    if (error) {
        console.error('Failed to update approval status:', error);
        showNotification(`Failed to update account: ${error.message}`, 'error');
        return;
    }

    if (isReset) {
        showNotification(
            status === 'approved'
                ? 'Password change approved. They can now log in with the new password.'
                : 'Password change declined. They can request another reset.',
            'success'
        );
    } else {
        showNotification(status === 'approved' ? 'Account approved.' : 'Account rejected.', 'success');
    }
    row?.remove();
    if (status === 'approved') loadStaffManagement();

    const tbody = document.querySelector('#pendingApprovalsTable tbody');
    if (tbody && !tbody.querySelector('tr')) {
        renderPendingApprovals([]);
    }
    const badge = document.getElementById('pendingApprovalsCount');
    if (badge) {
        badge.textContent = Math.max(0, (parseInt(badge.textContent, 10) || 1) - 1);
        setNavPendingBadge(parseInt(badge.textContent, 10));
    }
}

/* =========================================
   2. DATA FETCHING & COUNTERS
========================================= */
async function fetchDashboardData() {
    const todayStr = getLocalDateString(new Date());

    if (supabaseClient) {
        const { data: appointments, error } = await supabaseClient
            .from('appointments')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (!error && appointments) {
            appointmentsData = appointments;
        } else if (error) {
            console.error('Error fetching Supabase data:', error);
        }
    } else {
        // Local Storage Fallback
        const stored = localStorage.getItem('dental_appointments');
        if (stored) {
            appointmentsData = JSON.parse(stored);
        } else {
            appointmentsData = [
                { id: 1, client: 'Gongaga', phone: '09923153141', date: '2026-09-11', time: '11:11', service: 'Braces', items_used: 'wwerwerw: 235\nsdrsdfs: 400', price: 635, status: 'completed' },
                { id: 2, client: 'John Doe', phone: '09123456789', date: todayStr, time: '10:00', service: 'Cleaning', items_used: '', price: 0, status: 'pending' }
            ];
            localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
        }
    }

    await loadPayments();

    // Belt-and-suspenders sort: guarantees earliest-date, earliest-time-first
    // ordering everywhere appointmentsData is used, regardless of the order
    // Supabase (or the localStorage fallback) happened to return rows in.
    appointmentsData.sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '').localeCompare(b.time || '');
    });

    // Dashboard Calculations
    const todaysAppointments = appointmentsData.filter(item => item.date === todayStr);
    const availableSlots = computeAvailableSlots();

    // Monthly revenue: completed appointments whose date falls in the
    // current calendar month, string-matched against "YYYY-MM" so it lines
    // up exactly with how todayStr already avoids timezone drift.
    const currentMonthPrefix = todayStr.slice(0, 7);
    const monthlyRevenue = appointmentsData
        .filter(item => item.status === 'completed' && item.date && item.date.startsWith(currentMonthPrefix))
        .reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)
        + sumKeptPaymentsForMonth(currentMonthPrefix);

    // Previous month, computed from today's actual year/month rather than
    // re-parsing a date string, so it can't drift across a year boundary.
    const now = new Date();
    let prevMonthIndex = now.getMonth() - 1;
    let prevMonthYear = now.getFullYear();
    if (prevMonthIndex < 0) {
        prevMonthIndex = 11;
        prevMonthYear -= 1;
    }
    const previousMonthPrefix = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
    const previousMonthRevenue = appointmentsData
        .filter(item => item.status === 'completed' && item.date && item.date.startsWith(previousMonthPrefix))
        .reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)
        + sumKeptPaymentsForMonth(previousMonthPrefix);

    // Update DOM Counters
    const patientElem = document.getElementById('patientCount');
    const appointmentElem = document.getElementById('appointmentCount');
    const slotsElem = document.getElementById('availableSlots');
    const revenueElem = document.getElementById('monthlyRevenue');
    const prevRevenueElem = document.getElementById('previousMonthRevenue');

    if (patientElem) {
        const uniquePatients = new Set(appointmentsData.map((a, i) => getPatientGroupKey(a) || `__unnamed_${i}`));
        patientElem.textContent = uniquePatients.size;
    }
    // Canceled appointments don't count toward today's total
    const activeTodayCount = todaysAppointments.filter(item => !/^cancel/i.test(item.status || '')).length;
    if (appointmentElem) appointmentElem.textContent = activeTodayCount;
    if (slotsElem) slotsElem.textContent = availableSlots;
    if (revenueElem) revenueElem.textContent = `₱${monthlyRevenue.toFixed(2)}`;
    if (prevRevenueElem) prevRevenueElem.textContent = `₱${previousMonthRevenue.toFixed(2)}`;

    // Render components strictly by page target
    renderCalendar();
    renderDashboardTodayTable(todaysAppointments);
    renderPatientTable();

    applyScheduleFilters();

    // Trigger chart updates on every data refresh
    initCharts();
}

/* =========================================
   BRACES INSTALLMENT PLAN
   A braces patient has one total bill (e.g. 50,000) and pays a fixed
   amount at every adjustment visit (e.g. 10,000). The plan is stored on
   the patient's first Braces appointment (braces_total / braces_per_visit)
   and is the single source of truth for every later visit. "Paid so far"
   is the sum of the price of that patient's completed Braces visits.
========================================= */
/* =========================================
   PAYMENT LEDGER (Supabase table "payments")
   Every confirmed payment is also saved as its own record, so deleting a
   visit never changes what a patient has paid. Totals are:
     live completed visits  +  ledger rows whose visit no longer exists.
   If the table isn't set up yet everything keeps working as before (totals
   come from the visits only) and deleting a paid visit shows a warning.
========================================= */
let paymentsData = [];
let paymentsAvailable = false;

async function loadPayments() {
    paymentsData = [];
    paymentsAvailable = false;
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('payments').select('*');
    if (error) {
        if (!window.__paymentsWarned) {
            console.warn('payments table not available - totals use visits only:', error.message);
            window.__paymentsWarned = true;
        }
        return;
    }
    paymentsAvailable = true;
    paymentsData = data || [];
}

// Ledger rows whose appointment has been deleted - these are the payments
// that would otherwise have been lost.
function getKeptPayments() {
    if (!paymentsData.length) return [];
    const liveIds = new Set(appointmentsData.map(a => String(a.id)));
    return paymentsData.filter(p => !liveIds.has(String(p.appointment_id)));
}

function sumKeptPaymentsForMonth(prefix) {
    return getKeptPayments()
        .filter(p => p.paid_on && String(p.paid_on).startsWith(prefix))
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
}

// Save / update the ledger row for one completed visit. Returns true if saved.
async function recordPayment(appt) {
    if (!supabaseClient || !appt || appt.id == null) return false;
    const amount = parseFloat(appt.price) || 0;
    if (appt.status !== 'completed' || amount <= 0) return true;   // nothing to keep

    const service = appt.service || appt.treatment || '';
    const isBraces = isBracesService(service);
    const plan = isBraces ? getBracesPlan(appt.client) : null;
    const row = {
        appointment_id: String(appt.id),
        patient_key: getPatientGroupKey(appt),
        patient_name: appt.client || '',
        service,
        amount,
        installment: isBraces ? getBracesInstallmentPart(appt, plan ? plan.perVisit : 0) : null,
        plan_total: plan ? plan.total : (parseFloat(appt.braces_total) || null),
        plan_per_visit: plan ? plan.perVisit : (parseFloat(appt.braces_per_visit) || null),
        paid_on: appt.date || null,
        updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient.from('payments').upsert(row, { onConflict: 'appointment_id' });
    if (error) {
        console.warn('Could not save payment record:', error.message);
        return false;
    }
    const i = paymentsData.findIndex(p => String(p.appointment_id) === row.appointment_id);
    if (i >= 0) paymentsData[i] = { ...paymentsData[i], ...row }; else paymentsData.push(row);
    paymentsAvailable = true;
    return true;
}

function isBracesService(service) {
    return String(service || '').trim().toLowerCase() === 'braces';
}

function getBracesPlan(client) {
    const key = getPatientGroupKey({ client });
    if (!key) return null;
    const source = appointmentsData
        .filter(a => getPatientGroupKey(a) === key &&
                     isBracesService(a.service || a.treatment) &&
                     (parseFloat(a.braces_total) || 0) > 0 &&
                     a.status !== 'canceled' && a.status !== 'cancelled')
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))[0];
    if (!source) {
        // every braces visit was deleted: the plan survives in the payment ledger
        const kept = getKeptPayments()
            .filter(p => p.patient_key === key && isBracesService(p.service) && (parseFloat(p.plan_total) || 0) > 0)
            .sort((a, b) => String(b.paid_on || '').localeCompare(String(a.paid_on || '')))[0];
        if (!kept) return null;
        return { sourceId: null, total: parseFloat(kept.plan_total) || 0, perVisit: parseFloat(kept.plan_per_visit) || 0 };
    }
    return {
        sourceId: source.id,
        total: parseFloat(source.braces_total) || 0,
        perVisit: parseFloat(source.braces_per_visit) || 0
    };
}

// A braces visit's price = the plan installment + any items used that day
// (anesthesia, etc.). Only the installment reduces the braces balance, so
// the items part is taken back out here. Older visits saved with just the
// installment (price == per-visit amount) are counted as-is.
function getBracesInstallmentPart(appt, perVisit) {
    const price = parseFloat(appt.price) || 0;
    if (Math.abs(price - perVisit) < 0.005) return price;
    const itemsTotal = parseFloat(calculatePriceFromText(appt.items_used)) || 0;
    return Math.max(0, price - itemsTotal);
}

function getBracesPaid(client) {
    const key = getPatientGroupKey({ client });
    const plan = getBracesPlan(client);
    const perVisit = plan ? plan.perVisit : 0;
    const fromVisits = appointmentsData
        .filter(a => getPatientGroupKey(a) === key &&
                     isBracesService(a.service || a.treatment) &&
                     a.status === 'completed')
        .reduce((sum, a) => sum + getBracesInstallmentPart(a, perVisit), 0);
    // installments from visits that were later deleted are still paid
    const fromDeleted = getKeptPayments()
        .filter(p => p.patient_key === key && isBracesService(p.service))
        .reduce((sum, p) => sum + (parseFloat(p.installment ?? p.amount) || 0), 0);
    return fromVisits + fromDeleted;
}

// How many braces payments belong to deleted visits (shown on the patient profile)
function getKeptBracesPaymentCount(client) {
    const key = getPatientGroupKey({ client });
    return getKeptPayments().filter(p => p.patient_key === key && isBracesService(p.service)).length;
}

function formatPeso(n) {
    return '\u20b1' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Everything the UI needs about a patient's braces plan in one object.
function getBracesSummary(client) {
    const plan = getBracesPlan(client);
    if (!plan) return null;
    const paid = getBracesPaid(client);
    const balance = Math.max(0, plan.total - paid);
    const visitsLeft = plan.perVisit > 0 ? Math.ceil(balance / plan.perVisit) : 0;
    return { ...plan, paid, balance, visitsLeft, percent: plan.total > 0 ? Math.min(100, (paid / plan.total) * 100) : 0 };
}

// Shows/hides the plan inputs on the booking form. If the patient already
// has a plan (from an earlier braces visit), it is filled in and locked so
// every adjustment uses the same numbers.
function refreshBracesPlanFields() {
    const group = document.getElementById('bracesPlanGroup');
    const treatmentSelect = document.getElementById('treatment');
    if (!group || !treatmentSelect) return;

    const totalEl = document.getElementById('bracesTotal');
    const perVisitEl = document.getElementById('bracesPerVisit');
    const hintEl = document.getElementById('bracesPlanHint');
    const isBraces = isBracesService(treatmentSelect.value);

    group.style.display = isBraces ? 'flex' : 'none';
    totalEl.required = isBraces;
    perVisitEl.required = isBraces;
    if (!isBraces) {
        totalEl.value = '';
        perVisitEl.value = '';
        totalEl.readOnly = false;
        perVisitEl.readOnly = false;
        return;
    }

    const clientName = document.getElementById('clientName')?.value || '';
    const summary = getBracesSummary(clientName);
    const editingId = window.currentEditingAppointmentId;
    const isPlanOwner = summary && editingId && String(summary.sourceId) === String(editingId);

    if (summary && !isPlanOwner) {
        totalEl.value = summary.total;
        perVisitEl.value = summary.perVisit;
        totalEl.readOnly = true;
        perVisitEl.readOnly = true;
        hintEl.textContent = summary.balance > 0
            ? `Existing plan for this patient: paid ${formatPeso(summary.paid)} of ${formatPeso(summary.total)}. Balance ${formatPeso(summary.balance)} (about ${summary.visitsLeft} adjustment visit${summary.visitsLeft === 1 ? '' : 's'} left).`
            : `This patient has fully paid the ${formatPeso(summary.total)} braces bill.`;
    } else {
        totalEl.readOnly = false;
        perVisitEl.readOnly = false;
        if (isPlanOwner) {
            totalEl.value = summary.total;
            perVisitEl.value = summary.perVisit;
        }
        hintEl.textContent = 'The patient pays this amount at every adjustment visit until the total is fully paid.';
    }
}

/* =========================================
   3. PATIENT BILLING & CONFIRM SYSTEM
========================================= */
function renderPatientTable(filteredList = null) {
    const tbody = document.querySelector('#patientTable tbody');
    if (!tbody) return;

    const isDone = item => item.status === 'completed' || item.confirmed === true;
    // Cancelled appointments shouldn't show up for billing — once a
    // patient's appointment is cancelled, they drop off this list.
    const notCancelled = appointmentsData.filter(item => {
        const statusKey = (item.status || '').toLowerCase();
        return statusKey !== 'canceled' && statusKey !== 'cancelled';
    });

    // Counts on the filter tabs (independent of the search box).
    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
    setCount('pfCountAll', notCancelled.length);
    setCount('pfCountCompleted', notCancelled.filter(isDone).length);
    setCount('pfCountNotCompleted', notCancelled.filter(i => !isDone(i)).length);

    // Search box + Completed / Not Completed tab are applied together.
    const query = (document.getElementById('patientSearch')?.value || '').toLowerCase().trim();
    const statusFilter = document.querySelector('#patientFilterTabs .patient-filter-tab.active')?.dataset.filter || 'all';

    const listToRender = (filteredList || notCancelled).filter(item => {
        const statusKey = (item.status || '').toLowerCase();
        if (statusKey === 'canceled' || statusKey === 'cancelled') return false;
        if (statusFilter === 'completed' && !isDone(item)) return false;
        if (statusFilter === 'notcompleted' && isDone(item)) return false;
        if (!filteredList && query) {
            const hay = [item.client || item.clientName, item.service || item.treatment, item.phone]
                .map(v => (v || '').toLowerCase());
            if (!hay.some(v => v.includes(query))) return false;
        }
        return true;
    });

    if (!listToRender || listToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted, #94a3b8); padding: 24px;">No patient records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = listToRender.map((item) => {
        const origIndex = appointmentsData.findIndex(a => a === item);
        const isConfirmed = item.status === 'completed' || item.confirmed === true;
        const itemsValue = item.items_used || '';
        let priceValue = item.price !== undefined && item.price !== null ? item.price : calculatePriceFromText(itemsValue);

        // Braces: the price for this visit is the plan's per-adjustment
        // amount, capped at whatever balance is still owed.
        let bracesNote = '';
        if (isBracesService(item.service || item.treatment)) {
            const summary = getBracesSummary(item.client || item.clientName);
            if (summary) {
                if (!isConfirmed && !(parseFloat(item.price) > 0)) {
                    const installment = Math.min(summary.perVisit, summary.balance);
                    priceValue = (installment + (parseFloat(calculatePriceFromText(itemsValue)) || 0)).toFixed(2);
                }
                bracesNote = `<div class="braces-price-note">Braces plan: <strong>${formatPeso(summary.perVisit)}</strong> per visit<br>Paid ${formatPeso(summary.paid)} of ${formatPeso(summary.total)} &middot; Balance ${formatPeso(summary.balance)}</div>`;
            }
        }

        return `
            <tr data-index="${origIndex}">
                <td><strong>${item.client || item.clientName || 'N/A'}</strong></td>
                <td>${item.phone || 'N/A'}</td>
                <td>${formatLongDate(item.date)}</td>
                <td>${formatTimeDisplay(item.time)}</td>
                <td>${item.service || item.treatment || 'N/A'}</td>
                <td>
                    <textarea 
                        class="items-input" 
                        placeholder="e.g. anesthesia: 250&#10;pasta: 1000"
                        oninput="autoCalculatePrice(${origIndex}, this.value)"
                        ${isConfirmed ? 'disabled' : ''}
                    >${itemsValue}</textarea>
                </td>
                <td>
                    <div class="price-field">
                        <span class="currency-sign">₱</span>
                        <input 
                            type="number" 
                            class="price-input" 
                            id="price-${origIndex}" 
                            value="${priceValue}" 
                            step="0.01"
                            ${isConfirmed ? 'disabled' : ''}
                        />
                    </div>
                    ${bracesNote}
                </td>
                <td>
                    ${isConfirmed ? `
                        <button class="btn-confirm btn-confirmed-done" disabled>
                            <i class="fa-solid fa-check"></i> Confirmed
                        </button>
                    ` : `
                        <button class="btn-confirm" onclick="confirmPatientTreatment(${origIndex})">
                            Confirm
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function autoCalculatePrice(index, text) {
    const priceInput = document.getElementById(`price-${index}`);
    if (!priceInput) return;

    // Braces visits: price = the plan's installment for this visit (capped at
    // the remaining balance) + whatever items were used.
    const appt = appointmentsData[index];
    const itemsTotal = parseFloat(calculatePriceFromText(text)) || 0;
    if (appt && isBracesService(appt.service || appt.treatment)) {
        const summary = getBracesSummary(appt.client);
        if (summary) {
            const installment = Math.min(summary.perVisit, summary.balance);
            priceInput.value = (installment + itemsTotal).toFixed(2);
            return;
        }
    }

    priceInput.value = itemsTotal.toFixed(2);
}

// Items are typed one per line as "name: price" (e.g. "anesthesia: 250").
// Only the amount after the colon is added up, so numbers inside an item's
// name (e.g. "needle 27G", "gauze-100") are never counted as a price.
// Lines without a colon have no price and add nothing.
function calculatePriceFromText(text) {
    if (!text) return '0.00';
    let total = 0;
    String(text).split(/\r?\n/).forEach(line => {
        const colon = line.lastIndexOf(':');
        if (colon === -1) return;
        const m = /^\s*(?:\u20b1|php)?\s*(\d[\d,]*(?:\.\d+)?)/i.exec(line.slice(colon + 1));
        if (m) total += parseFloat(m[1].replace(/,/g, '')) || 0;
    });
    return total.toFixed(2);
}

async function confirmPatientTreatment(index) {
    const targetItem = appointmentsData[index];
    if (!targetItem) return;

    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (!row) return;

    const itemsText = row.querySelector('.items-input')?.value || '';
    const priceVal = parseFloat(row.querySelector('.price-input')?.value || 0);

    if (isBracesService(targetItem.service || targetItem.treatment)) {
        const summary = getBracesSummary(targetItem.client);
        const itemsPart = parseFloat(calculatePriceFromText(itemsText)) || 0;
        const installmentPaid = Math.max(0, priceVal - itemsPart);
        if (summary && installmentPaid > summary.balance + 0.005) {
            const ok = window.confirm(`This braces payment (${formatPeso(installmentPaid)}, not counting items) is more than the remaining braces balance (${formatPeso(summary.balance)}). Continue anyway?`);
            if (!ok) return;
        }
    }

    const previousItemsUsed = targetItem.items_used;
    const previousPrice = targetItem.price;
    const previousStatus = targetItem.status;
    const previousConfirmed = targetItem.confirmed;

    targetItem.items_used = itemsText;
    targetItem.price = priceVal;
    targetItem.status = 'completed';
    targetItem.confirmed = true;

    if (supabaseClient && targetItem.id) {
        const { error } = await supabaseClient
            .from('appointments')
            .update({ items_used: itemsText, price: priceVal, status: 'completed' })
            .eq('id', targetItem.id);

        if (error) {
            console.error('Supabase update failed:', error);
            targetItem.items_used = previousItemsUsed;
            targetItem.price = previousPrice;
            targetItem.status = previousStatus;
            targetItem.confirmed = previousConfirmed;
            showNotification(`Failed to save billing: ${error.message}`, 'error');
            return;
        }
    } else {
        localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
    }

    await recordPayment(targetItem);   // keep a ledger copy of this payment

    const displayPrice = Number.isFinite(priceVal) ? priceVal.toFixed(2) : '0.00';
    showNotification(`Treatment confirmed for ${targetItem.client || 'Patient'}! Total: ₱${displayPrice}`, 'success');
    await fetchDashboardData();
}

function initPatientPageSearch() {
    const searchInput = document.getElementById('patientSearch');
    if (!searchInput) return;

    // Search and the Completed / Not Completed tabs share renderPatientTable,
    // which reads both, so they always apply together.
    searchInput.addEventListener('input', () => renderPatientTable());

    document.querySelectorAll('#patientFilterTabs .patient-filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#patientFilterTabs .patient-filter-tab')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPatientTable();
        });
    });
}

/* =========================================
   4. CALENDAR SYSTEM
========================================= */
function initInteractiveCalendar() {
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const clearBtn = document.getElementById('clearDateFilterBtn');

    if (prevBtn) prevBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    if (clearBtn) clearBtn.addEventListener('click', clearDateFilter);
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const monthYearText = document.getElementById('calendarMonthYear');
    if (!calendarDays || !monthYearText) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    monthYearText.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    // One calendar cell. Days spilling in from the previous/next month are
    // shown muted but still carry their patient count and can be clicked,
    // so an appointment on e.g. Sept 30 still shows in October's top row.
    const buildDayCell = (y, m, d, otherMonth) => {
        const fullDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedFilterDate === fullDateStr ? ' active' : '';
        // Number of patients booked that day (cancelled ones don't count)
        const dayCount = appointmentsData.filter(item => {
            const st = (item.status || '').toLowerCase();
            return item.date === fullDateStr && st !== 'canceled' && st !== 'cancelled';
        }).length;
        const isFull = dayCount >= DAILY_MAX_SLOTS ? ' full' : '';
        const dotHTML = dayCount > 0
            ? `<span class="day-count${isFull}" title="${dayCount} of ${DAILY_MAX_SLOTS} slots booked">` +
              `<strong>${dayCount}</strong><span class="day-count-label"> ${dayCount === 1 ? 'patient' : 'patients'}</span></span>`
            : '';
        return `
            <div class="day${otherMonth ? ' other-month' : ''}${isSelected}" data-date="${fullDateStr}">
                ${d}
                ${dotHTML}
            </div>
        `;
    };

    let daysHTML = '';

    // Leading days from the previous month
    const prevMonthDate = new Date(year, month - 1, 1);
    for (let i = firstDayIndex; i > 0; i--) {
        daysHTML += buildDayCell(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), prevLastDate - i + 1, true);
    }

    // This month
    for (let day = 1; day <= lastDate; day++) {
        daysHTML += buildDayCell(year, month, day, false);
    }

    // Trailing days from the next month, to finish the last week
    const nextMonthDate = new Date(year, month + 1, 1);
    const trailing = (7 - ((firstDayIndex + lastDate) % 7)) % 7;
    for (let day = 1; day <= trailing; day++) {
        daysHTML += buildDayCell(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), day, true);
    }

    calendarDays.innerHTML = daysHTML;

    calendarDays.querySelectorAll('.day:not(.inactive)').forEach(dayElem => {
        dayElem.addEventListener('click', () => {
            const chosenDate = dayElem.getAttribute('data-date');
            if (selectedFilterDate === chosenDate) {
                clearDateFilter();
            } else {
                filterAppointmentsByDate(chosenDate);
            }
        });
    });
}

function filterAppointmentsByDate(dateStr) {
    selectedFilterDate = dateStr;

    // Picking a day on the calendar replaces any typed search
    const searchEl = document.getElementById('scheduleSearch');
    if (searchEl) searchEl.value = '';

    renderCalendar();
    applyScheduleFilters();
}

function clearDateFilter() {
    selectedFilterDate = null;
    renderCalendar();
    applyScheduleFilters();
}

/* =========================================
   4b. SCHEDULE SEARCH (name or date)
   The box under the calendar on the Appointment Schedule page. Every
   word you type must match either the patient's name or the appointment
   date, so "jay", "sept 25", "2026-09-25", "9/25/2026" or "jay september"
   all work. A typed search looks across ALL days; clicking a calendar day
   clears the search (and vice versa) so the two never fight each other.
========================================= */
const SEARCH_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];

function getDateSearchInfo(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
    if (!m) return null;

    const [, y, mm, dd] = m;
    const monthNum = parseInt(mm, 10);
    const dayNum = parseInt(dd, 10);
    const yy = y.slice(-2);

    return {
        year: y,
        monthName: SEARCH_MONTHS[monthNum - 1] || '',
        numbers: new Set([String(dayNum), dd, String(monthNum), mm]),
        fullForms: [
            `${y}-${mm}-${dd}`,
            `${monthNum}/${dayNum}/${y}`, `${mm}/${dd}/${y}`, `${monthNum}/${dayNum}/${yy}`, `${mm}/${dd}/${yy}`,
            `${dayNum}/${monthNum}/${y}`, `${dd}/${mm}/${y}`, `${dayNum}/${monthNum}/${yy}`, `${dd}/${mm}/${yy}`
        ]
    };
}

function tokenMatchesDate(token, info) {
    if (!info) return false;

    // Anything with / or - is treated as a (partial) full date: "9/25", "2026-09"
    if (/[\/-]/.test(token)) return info.fullForms.some(form => form.startsWith(token));

    // Whole-number parts only, so "26" finds the 26th but not every date in 2026
    if (info.numbers.has(token) || token === info.year) return true;

    // "sep", "sept", "september"
    return token.length >= 3 && /^[a-z]+$/.test(token) && info.monthName.startsWith(token);
}

function matchesScheduleSearch(item, rawQuery) {
    const name = (item.client || item.clientName || '').toLowerCase();
    const dateInfo = getDateSearchInfo(item.date);
    const tokens = rawQuery.toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);

    return tokens.every(token => name.includes(token) || tokenMatchesDate(token, dateInfo));
}

// Shrinks a list of appointments to ONE row per patient. The row kept is the
// one staff most likely care about: the soonest upcoming appointment if
// there is one, otherwise the most recent visit that wasn't canceled (or the
// most recent canceled one if that's all they have).
function collapseToOnePerPatient(rows) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const stamp = a => `${a.date || ''} ${a.time || ''}`;
    const isCanceled = a => /^cancel/i.test(a.status || '');
    const isCompleted = a => (a.status || '').toLowerCase() === 'completed';

    const groups = new Map();
    rows.forEach((item, i) => {
        const key = getPatientGroupKey(item) || `__unnamed_${i}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });

    const chosen = [];
    groups.forEach(list => {
        const upcoming = list
            .filter(a => (a.date || '') >= today && !isCanceled(a) && !isCompleted(a))
            .sort((a, b) => stamp(a).localeCompare(stamp(b)));

        if (upcoming.length) {
            chosen.push(upcoming[0]);
            return;
        }

        const active = list.filter(a => !isCanceled(a));
        const pool = (active.length ? active : list)
            .slice()
            .sort((a, b) => stamp(b).localeCompare(stamp(a)));
        chosen.push(pool[0]);
    });

    // keep the table in the same order it had before
    return chosen.sort((a, b) => appointmentsData.indexOf(a) - appointmentsData.indexOf(b));
}

// Single place that decides which rows the schedule table shows, and what
// heading goes above it: typed search > selected calendar day > everything.
function applyScheduleFilters() {
    const searchEl = document.getElementById('scheduleSearch');
    const query = searchEl ? searchEl.value.trim() : '';

    // Everyone-view and search show ONE row per patient (open their profile
    // for every visit). A picked calendar day shows every appointment that
    // day, so nobody scheduled for it gets hidden. The status tabs (Pending /
    // Completed / Canceled) narrow the appointments BEFORE that per-patient
    // step, so each patient is shown by an appointment that matches the tab.
    const statusMatches = (item, f) => {
        const st = (item.status || '').toLowerCase();
        const canceled = /^cancel/.test(st);
        if (f === 'canceled') return canceled;
        if (f === 'completed') return st === 'completed';
        if (f === 'pending') return !canceled && st !== 'completed';
        return true;
    };

    const rowsFor = (f) => {
        if (query) {
            return collapseToOnePerPatient(appointmentsData.filter(item => statusMatches(item, f) && matchesScheduleSearch(item, query)));
        } else if (selectedFilterDate) {
            return appointmentsData.filter(item => statusMatches(item, f) && item.date === selectedFilterDate);
        }
        return collapseToOnePerPatient(appointmentsData.filter(item => statusMatches(item, f)));
    };

    const activeFilter = document.querySelector('#scheduleFilterTabs .patient-filter-tab.active')?.dataset.filter || 'all';
    const rows = rowsFor(activeFilter);

    // Counts on the tabs = how many rows each tab would show right now.
    const setCount = (id, f) => { const el = document.getElementById(id); if (el) el.textContent = rowsFor(f).length; };
    setCount('sfCountAll', 'all');
    setCount('sfCountPending', 'pending');
    setCount('sfCountCompleted', 'completed');
    setCount('sfCountCanceled', 'canceled');

    const titleElem = document.getElementById('selectedDateTitle');
    const subtitleElem = document.getElementById('selectedDateSubtitle');
    const clearBtn = document.getElementById('clearDateFilterBtn');

    if (query) {
        if (titleElem) titleElem.textContent = 'Search Results';
        if (subtitleElem) subtitleElem.textContent = `${rows.length} patient${rows.length === 1 ? '' : 's'} matching "${query}"`;
        if (clearBtn) clearBtn.style.display = 'none';
    } else if (selectedFilterDate) {
        if (titleElem) titleElem.textContent = `Appointments for ${formatLongDate(selectedFilterDate)}`;
        if (subtitleElem) subtitleElem.textContent = 'Showing patients scheduled for this date';
        if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
        if (titleElem) titleElem.textContent = 'All Scheduled Appointments';
        if (subtitleElem) subtitleElem.textContent = 'One row per patient \u2014 open a profile to see every visit. Click a day above to filter by date.';
        if (clearBtn) clearBtn.style.display = 'none';
    }

    renderTableRows(rows);
}

function initScheduleSearch() {
    const searchEl = document.getElementById('scheduleSearch');
    if (!searchEl) return;

    searchEl.addEventListener('input', () => {
        if (searchEl.value.trim() && selectedFilterDate) {
            selectedFilterDate = null;
            renderCalendar();
        }
        applyScheduleFilters();
    });

    document.querySelectorAll('#scheduleFilterTabs .patient-filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#scheduleFilterTabs .patient-filter-tab')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyScheduleFilters();
        });
    });
}

/* =========================================
   5. SCHEDULE & DASHBOARD TABLES
========================================= */
// One date format for the whole app: "2026-10-06" -> "October 6, 2026".
// Parsed by hand (not with new Date(string)) so the day never shifts by timezone.
const LONG_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function formatLongDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
    if (!m) return dateStr ? String(dateStr) : 'N/A';
    return `${LONG_MONTH_NAMES[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}
const formatDashboardDate = formatLongDate;

// Timestamps (staff sign-in / removal): "October 6, 2026, 1:30 PM"
function formatLongDateTime(value) {
    const d = new Date(value);
    if (isNaN(d)) return '\u2014';
    return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderDashboardTodayTable(todaysData) {
    const tbody = document.querySelector('#dashboardTodayTable tbody');
    if (!tbody) return;

    if (!todaysData || todaysData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted, #94a3b8); padding: 18px;">No appointments scheduled for today.</td></tr>`;
        return;
    }

    tbody.innerHTML = todaysData.map(item => `
        <tr>
            <td>${formatDashboardDate(item.date)}</td>
            <td>${formatTimeDisplay(item.time)}</td>
            <td>${item.client || item.clientName || 'N/A'}</td>
            <td>${item.service || item.treatment || 'N/A'}</td>
            <td>${getStatusBadge(item.status)}</td>
        </tr>
    `).join('');
}

function renderTableRows(data) {
    const tbody = document.querySelector('#scheduleTable tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted, #94a3b8); padding: 24px;">No appointments found.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map((item) => {
        const origIndex = appointmentsData.findIndex(a => a === item);

        // Completed and already-canceled appointments can't be canceled again —
        // render a disabled, non-clickable Cancel button for those instead.
        const statusKey = (item.status || '').toLowerCase();
        const isFinalStatus = statusKey === 'completed' || statusKey === 'canceled' || statusKey === 'cancelled';
        // A canceled appointment can't be edited either.
        const isCanceledRow = statusKey === 'canceled' || statusKey === 'cancelled';
        const editButtonHTML = isCanceledRow
            ? `<button class="btn-icon btn-edit" disabled title="Canceled appointments can't be edited">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>`
            : `<button class="btn-icon btn-edit" onclick="editAppointment(${origIndex})" title="Edit Appointment">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>`;
        const cancelButtonHTML = isFinalStatus
            ? `<button class="btn-icon btn-cancel" disabled title="${statusKey === 'completed' ? 'Completed appointments can\'t be canceled' : 'This appointment is already canceled'}">
                    <i class="fa-solid fa-circle-xmark"></i>
                </button>`
            : `<button class="btn-icon btn-cancel" onclick="cancelAppointment(${origIndex})" title="Cancel Appointment">
                    <i class="fa-solid fa-circle-xmark"></i>
                </button>`;

        return `
            <tr>
                <td>${formatTimeDisplay(item.time)}</td>
                <td>${item.client || item.clientName || 'N/A'}${visitCountPill(item)}</td>
                <td>${item.service || item.treatment || 'N/A'}</td>
                <td>${getStatusBadge(item.status)}</td>
                <td>${formatLongDate(item.date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" onclick="viewPatientProfile(${origIndex})" title="View Patient Profile">
                            <i class="fa-solid fa-id-card"></i>
                        </button>
                        <button class="btn-icon btn-rebook" onclick="rebookAppointment(${origIndex})" title="Rebook (new appointment for this patient)">
                            <i class="fa-solid fa-calendar-plus"></i>
                        </button>
                        ${editButtonHTML}
                        ${cancelButtonHTML}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Small "3 visits" tag shown next to a patient who has come more than once
function visitCountPill(item) {
    const visits = getPatientHistory(item.client || item.clientName).length;
    return visits > 1 ? `<span class="visit-pill">${visits} visits</span>` : '';
}

function getStatusBadge(status) {
    const s = (status || 'pending').toLowerCase().trim();
    return `<span class="badge badge-${s}">${s}</span>`;
}

// Turns a stored 24-hour time ("22:00:00" or "22:00") into an easy-to-read
// 12-hour display ("10:00 PM"). Display-only — never used for comparisons,
// sorting, or anything sent back to Supabase, which all keep using the
// original 24-hour string.
function formatTimeDisplay(timeStr) {
    if (!timeStr) return 'N/A';

    const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return timeStr;

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${hours}:${minutes} ${period}`;
}

async function markCompleted(index) {
    const target = appointmentsData[index];
    if (!target) return;

    const previousStatus = target.status;
    target.status = 'completed';

    if (supabaseClient && target.id) {
        const { error } = await supabaseClient.from('appointments').update({ status: 'completed' }).eq('id', target.id);
        if (error) {
            console.error('Supabase update failed:', error);
            target.status = previousStatus; // revert the optimistic change
            showNotification(`Failed to update status: ${error.message}`, 'error');
            return;
        }
    } else {
        localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
    }

    await fetchDashboardData();
}

async function deleteAppointment(index) {
    const target = appointmentsData[index];
    if (!target) return;

    const paidAmount = target.status === 'completed' ? (parseFloat(target.price) || 0) : 0;
    let message = `Are you sure you want to delete the appointment for ${target.client || 'this patient'}?`;
    if (paidAmount > 0) {
        message += paymentsAvailable
            ? `\n\nIts payment of ${formatPeso(paidAmount)} stays in the patient's payment record and in your revenue.`
            : `\n\nWARNING: its payment of ${formatPeso(paidAmount)} will be removed from this patient's braces plan and from your revenue (the payments table is not set up yet).`;
    }

    if (confirm(message)) {
        if (supabaseClient && target.id) {
            // Save the payment first. If that fails, don't delete: the money record would be lost.
            if (paidAmount > 0 && paymentsAvailable) {
                const saved = await recordPayment(target);
                if (!saved) {
                    showNotification('Could not save the payment record, so the appointment was not deleted.', 'error');
                    return;
                }
            }
            const { error } = await supabaseClient.from('appointments').delete().eq('id', target.id);
            if (error) {
                console.error('Supabase delete failed:', error);
                showNotification(`Failed to delete: ${error.message}`, 'error');
                return;
            }
            appointmentsData.splice(index, 1);
        } else {
            appointmentsData.splice(index, 1);
            localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
        }

        await fetchDashboardData();
    }
}

/* =========================================
   5b. TOOTH NUMBER SELECTION (FDI notation)
   FDI two-digit system, standard in PH dental practice: quadrant (1-4) +
   position from the midline (1-8). Wisdom teeth are always position 8
   (18/28/38/48), so Wisdom Tooth Removal narrows the list to just those four.
========================================= */
const FDI_QUADRANTS = [
    { label: 'Upper Right', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
    { label: 'Upper Left', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
    { label: 'Lower Left', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
    { label: 'Lower Right', teeth: [41, 42, 43, 44, 45, 46, 47, 48] }
];

const FDI_POSITION_NAMES = {
    1: 'Central Incisor', 2: 'Lateral Incisor', 3: 'Canine',
    4: '1st Premolar', 5: '2nd Premolar', 6: '1st Molar',
    7: '2nd Molar', 8: '3rd Molar (Wisdom)'
};

function populateToothOptions(selectEl, wisdomOnly) {
    const previousValue = selectEl.value;
    selectEl.innerHTML = '<option value="">Select Tooth...</option>';

    FDI_QUADRANTS.forEach(quadrant => {
        const teeth = wisdomOnly ? quadrant.teeth.filter(t => t % 10 === 8) : quadrant.teeth;
        if (!teeth.length) return;

        const group = document.createElement('optgroup');
        group.label = quadrant.label;

        teeth.forEach(toothNum => {
            const positionName = FDI_POSITION_NAMES[toothNum % 10] || '';
            const opt = document.createElement('option');
            opt.value = String(toothNum);
            opt.textContent = `${toothNum} — ${positionName}`;
            group.appendChild(opt);
        });

        selectEl.appendChild(group);
    });

    const stillValid = Array.from(selectEl.options).some(o => o.value === previousValue);
    if (stillValid) selectEl.value = previousValue;
}

function updateConditionalTreatmentFields() {
    const treatmentSelect = document.getElementById('treatment');
    if (!treatmentSelect) return; // not on this page

    const toothGroup = document.getElementById('toothNumberGroup');
    const toothSelect = document.getElementById('toothNumber');
    const otherGroup = document.getElementById('otherTreatmentGroup');
    const otherInput = document.getElementById('otherTreatment');

    const val = treatmentSelect.value;
    const toothTreatments = ['Pasta', 'Extraction', 'Wisdom Tooth Removal'];
    const needsTooth = toothTreatments.includes(val);
    const needsOther = val === 'Others';

    if (toothGroup && toothSelect) {
        toothGroup.style.display = needsTooth ? 'flex' : 'none';
        toothSelect.required = needsTooth;
        if (needsTooth) {
            populateToothOptions(toothSelect, val === 'Wisdom Tooth Removal');
        } else {
            toothSelect.value = '';
        }
    }

    if (otherGroup && otherInput) {
        otherGroup.style.display = needsOther ? 'flex' : 'none';
        otherInput.required = needsOther;
        if (!needsOther) otherInput.value = '';
    }

    refreshBracesPlanFields();
}

/* =========================================
   6. FORM SUBMISSION HANDLER (FIXED)
========================================= */
function setupFormSubmission() {
    const form = document.getElementById('appointmentForm');
    const addBtn = document.getElementById('addAppointment');

    // Exit immediately if not on the appointment form/dashboard page
    if (!form && !addBtn) return;

    const treatmentSelect = document.getElementById('treatment');
    if (treatmentSelect) {
        treatmentSelect.addEventListener('change', updateConditionalTreatmentFields);
        updateConditionalTreatmentFields(); // set correct initial hidden/shown state
    }

    // Re-check for an existing braces plan as the patient name is typed
    const clientNameForBraces = document.getElementById('clientName');
    if (clientNameForBraces) {
        clientNameForBraces.addEventListener('input', refreshBracesPlanFields);
    }

    // Birthday is now three bounded <select>s (Month/Day/Year) instead of a
    // native date input — a browser date field lets the year segment accept
    // extra digits (e.g. "999999") while typing, before rejecting it on
    // submit. A dropdown makes an out-of-range value impossible to enter.
    const birthdayHiddenEl = document.getElementById('birthday');
    const birthdayMonthEl = document.getElementById('birthdayMonth');
    const birthdayDayEl = document.getElementById('birthdayDay');
    const birthdayYearEl = document.getElementById('birthdayYear');

    if (birthdayMonthEl && birthdayDayEl && birthdayYearEl && birthdayHiddenEl) {
        const pad2Local = n => String(n).padStart(2, '0');

        if (birthdayMonthEl.options.length === 1) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            monthNames.forEach((name, i) => {
                const opt = document.createElement('option');
                opt.value = pad2Local(i + 1);
                opt.textContent = name;
                birthdayMonthEl.appendChild(opt);
            });
        }

        if (birthdayDayEl.options.length === 1) {
            for (let d = 1; d <= 31; d++) {
                const opt = document.createElement('option');
                opt.value = pad2Local(d);
                opt.textContent = String(d);
                birthdayDayEl.appendChild(opt);
            }
        }

        if (birthdayYearEl.options.length === 1) {
            const currentYear = new Date().getFullYear();
            for (let y = currentYear; y >= 1900; y--) {
                const opt = document.createElement('option');
                opt.value = String(y);
                opt.textContent = String(y);
                birthdayYearEl.appendChild(opt);
            }
        }

        const composeBirthdayFromSelects = () => {
            const m = birthdayMonthEl.value;
            const d = birthdayDayEl.value;
            const y = birthdayYearEl.value;
            birthdayHiddenEl.value = (m && d && y) ? `${y}-${m}-${d}` : '';
        };

        [birthdayMonthEl, birthdayDayEl, birthdayYearEl].forEach(el => {
            el.addEventListener('change', composeBirthdayFromSelects);
        });

        // Exposed so the Edit/Rebook prefill code (below) can push an
        // existing "YYYY-MM-DD" value back into the three dropdowns.
        window.populateBirthdaySelects = (isoDate) => {
            const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
            birthdayYearEl.value = match ? match[1] : '';
            birthdayMonthEl.value = match ? match[2] : '';
            birthdayDayEl.value = match ? match[3] : '';
            composeBirthdayFromSelects();
        };
    }

    /* =========================================
       EDIT MODE
       Arriving here via appointment.html?edit=<id> (the Edit button on the
       Schedule page) pre-fills the form from that existing appointment and
       switches submission from "insert a new row" to "update that row".
    ========================================= */
    let editingAppointmentId = null;
    let editingOriginal = null;

    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId) {
        const existing = appointmentsData.find(a => String(a.id) === String(editId));

        if (existing && /^cancel/i.test(existing.status || '')) {
            showNotification("Canceled appointments can't be edited.", 'error');
            setTimeout(() => { window.location.href = 'history.html'; }, 1200);
        } else if (existing) {
            editingAppointmentId = existing.id;
            editingOriginal = existing;
            window.currentEditingAppointmentId = existing.id;

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val ?? '';
            };

            setVal('clientName', existing.client);
            setVal('phone', existing.phone);
            setVal('gender', existing.gender);
            setVal('birthday', existing.birthday);
            if (window.populateBirthdaySelects) window.populateBirthdaySelects(existing.birthday);
            setVal('address', existing.address);
            setVal('date', existing.date);
            setVal('time', existing.time);

            // If the stored service text isn't one of the built-in dropdown
            // options, it was originally entered via "Others" — route it
            // back into the Others field instead of leaving Service blank.
            if (treatmentSelect) {
                const knownServices = Array.from(treatmentSelect.options).map(o => o.value);
                treatmentSelect.value = knownServices.includes(existing.service) ? existing.service : 'Others';
            }

            updateConditionalTreatmentFields();

            if (treatmentSelect?.value === 'Others') {
                setVal('otherTreatment', existing.service);
            }
            if (existing.tooth_number) {
                setVal('toothNumber', existing.tooth_number);
            }

            const formTitle = document.getElementById('formCardTitle');
            if (formTitle) formTitle.textContent = 'Edit Appointment';

            const submitBtn = document.getElementById('addAppointmentBtn');
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Appointment';
        } else {
            showNotification('Could not find that appointment to edit.', 'error');
        }
    }

    /* =========================================
       REBOOK MODE
       Arriving via appointment.html?rebook=<id> (the Rebook button on the
       Schedule page) fills in the patient's details from that earlier
       appointment but leaves the date, time and tooth number blank. Saving
       creates a brand-new appointment; the old record is never touched.
    ========================================= */
    const rebookId = new URLSearchParams(window.location.search).get('rebook');
    if (rebookId && !editId) {
        const previous = appointmentsData.find(a => String(a.id) === String(rebookId));

        if (previous) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val ?? '';
            };

            setVal('clientName', previous.client);
            setVal('phone', previous.phone);
            setVal('gender', previous.gender);
            setVal('birthday', previous.birthday);
            if (window.populateBirthdaySelects) window.populateBirthdaySelects(previous.birthday);
            setVal('address', previous.address);

            if (treatmentSelect) {
                const knownServices = Array.from(treatmentSelect.options).map(o => o.value);
                treatmentSelect.value = knownServices.includes(previous.service) ? previous.service : 'Others';
            }
            updateConditionalTreatmentFields();
            if (treatmentSelect?.value === 'Others') {
                setVal('otherTreatment', previous.service);
            }

            // A rebook is for the SAME patient, so their personal details can't be
            // changed here (only the date, time and service). Fields that are empty
            // on the old record stay editable so the form can still be completed.
            const lockField = (el) => {
                if (!el || !el.value) return;
                if (el.tagName === 'SELECT') el.disabled = true; else el.readOnly = true;
                el.classList.add('rebook-locked');
                el.title = 'Patient details can\u2019t be changed when rebooking';
            };
            ['clientName', 'phone', 'gender', 'birthdayMonth', 'birthdayDay', 'birthdayYear', 'address']
                .forEach(id => lockField(document.getElementById(id)));

            const formTitle = document.getElementById('formCardTitle');
            if (formTitle) {
                formTitle.textContent = 'Rebook Appointment';

                const banner = document.createElement('div');
                banner.className = 'rebook-banner';
                banner.innerHTML = '<i class="fa-solid fa-rotate-right"></i><span></span>';
                banner.querySelector('span').textContent =
                    `Rebooking ${previous.client || 'patient'} \u2014 last visit: ${previous.service || 'N/A'} on ${formatLongDate(previous.date)}. ` +
                    `Patient details are locked \u2014 choose a new date and time.`;
                formTitle.closest('.card-title')?.after(banner);
            }

            // Quick-pick buttons for common follow-up gaps, counted from today
            const dateInputForRebook = document.getElementById('date');
            const dateGroup = dateInputForRebook?.closest('.input-field-group');
            if (dateInputForRebook && dateGroup) {
                const pad = n => String(n).padStart(2, '0');
                const addMonths = (d, n) => {
                    const day = d.getDate();
                    d.setDate(1);
                    d.setMonth(d.getMonth() + n);
                    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                    d.setDate(Math.min(day, lastDay));
                };

                const picks = [
                    ['In 1 week',   d => d.setDate(d.getDate() + 7)],
                    ['In 2 weeks',  d => d.setDate(d.getDate() + 14)],
                    ['In 1 month',  d => addMonths(d, 1)],
                    ['In 6 months', d => addMonths(d, 6)]
                ];

                const row = document.createElement('div');
                row.className = 'rebook-quickpick';
                row.innerHTML = '<span class="rebook-quickpick-label">Quick pick:</span>';

                picks.forEach(([label, shift]) => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'rebook-chip';
                    chip.textContent = label;
                    chip.addEventListener('click', () => {
                        const d = new Date();
                        shift(d);
                        dateInputForRebook.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        dateInputForRebook.dispatchEvent(new Event('input', { bubbles: true }));
                        dateInputForRebook.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                    row.appendChild(chip);
                });

                dateGroup.appendChild(row);
                dateInputForRebook.focus();
            }
        } else {
            showNotification('Could not find that appointment to rebook.', 'error');
        }
    }

    /* =========================================
       NO BOOKING IN THE PAST
       Local (not UTC) "today", so the cutoff flips at the clinic's midnight.
       The date input's min greys out past days in the picker. When editing
       an old appointment, its own existing date is allowed so the form
       doesn't reject a record just for being old.
    ========================================= */
    const pad2 = n => String(n).padStart(2, '0');
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    };

    const dateInputEl = document.getElementById('date');
    if (dateInputEl) {
        const today = getLocalToday();
        dateInputEl.min = (editingOriginal && editingOriginal.date && editingOriginal.date < today)
            ? editingOriginal.date
            : today;
    }


    const handleSubmission = async (e) => {
        if (e) e.preventDefault();

        const clientVal = document.getElementById('clientName')?.value?.trim();
        const phoneVal = document.getElementById('phone')?.value?.trim();
        const genderVal = document.getElementById('gender')?.value;
        const birthdayVal = document.getElementById('birthday')?.value;
        const addressVal = document.getElementById('address')?.value?.trim();
        const serviceVal = document.getElementById('treatment')?.value || document.getElementById('service')?.value;
        const toothVal = document.getElementById('toothNumber')?.value || '';
        const otherTreatmentVal = document.getElementById('otherTreatment')?.value?.trim() || '';
        const dateVal = document.getElementById('appointmentDate')?.value || document.getElementById('date')?.value;
        const timeVal = document.getElementById('appointmentTime')?.value || document.getElementById('time')?.value;

        if (!clientVal || !dateVal || !timeVal) {
            showNotification('Please fill out Patient Name, Appointment Date, and Time.', 'error');
            return;
        }

        if (!/^09\d{9}$/.test(phoneVal || '')) {
            showNotification('Mobile number must start with 09 and have 11 digits (e.g. 09123456789).', 'error');
            return;
        }

        if (birthdayVal) {
            const today = getLocalToday();
            if (birthdayVal > today || birthdayVal < '1900-01-01') {
                showNotification('Please enter a valid birthday.', 'error');
                return;
            }
        }

        // Block past dates (and already-passed times today). Skipped when
        // editing an appointment whose date/time isn't being changed.
        const scheduleUnchanged = editingOriginal &&
            editingOriginal.date === dateVal &&
            (editingOriginal.time || '').slice(0, 5) === timeVal.slice(0, 5);

        if (!scheduleUnchanged) {
            const todayStr = getLocalToday();
            const nowTime = `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`;

            if (dateVal < todayStr) {
                showNotification('You cannot book an appointment on a past date.', 'error');
                return;
            }
            if (dateVal === todayStr && timeVal.slice(0, 5) < nowTime) {
                showNotification('That time has already passed today. Please choose a later time.', 'error');
                return;
            }
        }

        const toothTreatments = ['Pasta', 'Extraction', 'Wisdom Tooth Removal'];
        if (toothTreatments.includes(serviceVal) && !toothVal) {
            showNotification('Please select which tooth this treatment is for.', 'error');
            return;
        }

        if (serviceVal === 'Others' && !otherTreatmentVal) {
            showNotification('Please specify the treatment for "Others".', 'error');
            return;
        }

        // Braces installment plan
        const isBracesBooking = isBracesService(serviceVal);
        let bracesTotalVal = 0;
        let bracesPerVisitVal = 0;
        if (isBracesBooking) {
            bracesTotalVal = parseFloat(document.getElementById('bracesTotal')?.value) || 0;
            bracesPerVisitVal = parseFloat(document.getElementById('bracesPerVisit')?.value) || 0;

            if (bracesTotalVal <= 0 || bracesPerVisitVal <= 0) {
                showNotification('Please enter the total braces bill and the payment per adjustment visit.', 'error');
                return;
            }
            if (bracesPerVisitVal > bracesTotalVal) {
                showNotification('The payment per visit cannot be more than the total braces bill.', 'error');
                return;
            }
        }

        // Check for existing appointment at the same date AND time. Times are
        // normalized to HH:MM before comparing, because Supabase hands back
        // "01:00:00" (with seconds) while the time input only ever gives
        // "01:00" — comparing the raw strings would never match. Canceled
        // appointments don't hold onto their slot, and the appointment being
        // edited is excluded so keeping its own time isn't flagged as a
        // conflict with itself.
        const normalizeTime = (t) => (t || '').slice(0, 5);
        const hasTimeConflict = appointmentsData.some(
            appointment =>
                appointment.date === dateVal &&
                normalizeTime(appointment.time) === normalizeTime(timeVal) &&
                appointment.status !== 'canceled' &&
                appointment.status !== 'cancelled' &&
                String(appointment.id) !== String(editingAppointmentId)
        );

        if (hasTimeConflict) {
            showNotification(`Conflict Alert: There is already an appointment scheduled on ${dateVal} at ${timeVal}!`, 'error');
            return;
        }

        // Daily limit: canceled appointments don't count, and the appointment
        // being edited is excluded so keeping its own date isn't blocked.
        const bookedThatDay = appointmentsData.filter(
            appointment =>
                appointment.date === dateVal &&
                appointment.status !== 'canceled' &&
                appointment.status !== 'cancelled' &&
                String(appointment.id) !== String(editingAppointmentId)
        ).length;

        if (bookedThatDay >= DAILY_MAX_SLOTS) {
            showNotification(`${dateVal} is fully booked (${DAILY_MAX_SLOTS} appointments). Please choose another date.`, 'error');
            return;
        }

        const finalService = serviceVal === 'Others' ? otherTreatmentVal : (serviceVal || 'Dental Consultation');

        if (editingAppointmentId) {
            // UPDATE an existing appointment. Status/items_used/price are left
            // untouched — editing the schedule details of an already-billed
            // appointment shouldn't wipe out its billing.
            const updatedFields = {
                client: clientVal,
                phone: phoneVal || '',
                gender: genderVal || '',
                birthday: birthdayVal || '',
                address: addressVal || '',
                service: finalService,
                tooth_number: toothVal || '',
                date: dateVal,
                time: timeVal
            };
            if (isBracesBooking || (editingOriginal && parseFloat(editingOriginal.braces_total) > 0)) {
                updatedFields.braces_total = isBracesBooking ? bracesTotalVal : 0;
                updatedFields.braces_per_visit = isBracesBooking ? bracesPerVisitVal : 0;
            }

            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('appointments')
                    .update(updatedFields)
                    .eq('id', editingAppointmentId);

                if (error) {
                    console.error('Supabase update failed:', error);
                    showNotification(`Failed to update appointment: ${error.message}`, 'error');
                    return;
                }
            } else {
                const target = appointmentsData.find(a => String(a.id) === String(editingAppointmentId));
                if (target) Object.assign(target, updatedFields);
                localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
            }

            showNotification('Appointment updated successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'history.html';
            }, 900);
            return;
        }

        const newRecord = {
            id: Date.now(),
            client: clientVal,
            phone: phoneVal || '',
            gender: genderVal || '',
            birthday: birthdayVal || '',
            address: addressVal || '',
            service: finalService,
            tooth_number: toothVal || '',
            date: dateVal,
            time: timeVal,
            status: 'pending',
            items_used: '',
            price: 0
        };
        if (isBracesBooking) {
            newRecord.braces_total = bracesTotalVal;
            newRecord.braces_per_visit = bracesPerVisitVal;
        }

        if (supabaseClient) {
            const { id, ...supabaseData } = newRecord;
            const { error } = await supabaseClient.from('appointments').insert([supabaseData]);
            if (error) {
                console.error('Supabase insert failed:', error);
                showNotification(`Failed to save to database: ${error.message}`, 'error');
                return;
            }
        } else {
            appointmentsData.push(newRecord);
            localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
        }

        if (form) form.reset();
        // form.reset() puts the three birthday <select>s back to their blank
        // placeholder option, but doesn't fire 'change' — sync the hidden
        // field manually so a leftover value can't sneak into the next save.
        if (birthdayHiddenEl) birthdayHiddenEl.value = '';
        updateConditionalTreatmentFields(); // re-hide the conditional fields after reset
        await fetchDashboardData();
        showNotification('Appointment successfully added!', 'success');
    };

    if (form) {
        form.addEventListener('submit', handleSubmission);
    } else if (addBtn) {
        addBtn.addEventListener('click', handleSubmission);
    }

    // Mobile Number — only allow digits, and only allow a number that
    // starts with "09" (PH mobile format), as the person types.
    const phoneInputEl = document.getElementById('phone');
    if (phoneInputEl) {
        phoneInputEl.addEventListener('input', () => {
            let digits = phoneInputEl.value.replace(/\D/g, '');
            if (digits.length > 0 && digits[0] !== '0') digits = '';
            if (digits.length > 1 && digits[1] !== '9') digits = digits.slice(0, 1);
            phoneInputEl.value = digits.slice(0, 11);
        });
    }
}

/* =========================================
   7. DYNAMIC CHARTS & REAL-TIME WEEKLY TRACKING
========================================= */
function initCharts() {
    const weeklyCanvas = document.getElementById('weeklyChart');
    const treatmentsCanvas = document.getElementById('treatmentsChart');

    if (typeof Chart === 'undefined') return;

    if (weeklyChartInstance) weeklyChartInstance.destroy();
    if (treatmentsChartInstance) treatmentsChartInstance.destroy();

    // 1. Calculate Current Week Dates (Mon - Sat) for Auto-Reset
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    const weeklyCounts = [0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 6; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dateStr = getLocalDateString(dayDate);

        weeklyCounts[i] = appointmentsData.filter(app => app.date === dateStr).length;
    }

    // 2. Calculate Live Treatments Distribution
    const treatmentLabels = [
        'Dental Consultation',
        'Cleaning',
        'Pasta',
        'Extraction',
        'Braces',
        'Wisdom Tooth Removal',
        'Teeth Whitening',
        'Veneers',
        'Dentures',
        'Dental Crown/Fixed Bridge',
        'Root Canal Treatment'
    ];

    const treatmentCounts = treatmentLabels.map(serviceName => {
        return appointmentsData.filter(app => (app.service || app.treatment) === serviceName).length;
    });

    // 3. Render Weekly Appointments Bar Chart
    if (weeklyCanvas) {
        weeklyChartInstance = new Chart(weeklyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'Appointments',
                    data: weeklyCounts,
                    backgroundColor: '#0E7C66',
                    borderRadius: 4,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 }
                    }
                }
            }
        });
    }

    // 4. Render Treatments Overview Doughnut Chart
    if (treatmentsCanvas) {
        treatmentsChartInstance = new Chart(treatmentsCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: treatmentLabels,
                datasets: [{
                    data: treatmentCounts,
                    backgroundColor: [
                        '#0E7C66', '#2F9E85', '#5FBBA6', '#4A7A8C', '#7BA098',
                        '#B4860B', '#16302C', '#8FA39C', '#0B5F4F', '#C9D6D1', '#6B4A9E'
                    ],
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#16302C', boxWidth: 10, padding: 12, font: { size: 11 } }
                    }
                }
            }
        });
    }
}

/* =========================================
   8. MODALS & PRESCRIPTION HANDLERS
========================================= */
function initModal() {
    const modal = document.getElementById('appointmentModal');
    const rxModal = document.getElementById('prescriptionModal');
    const openBtns = document.querySelectorAll('.open-modal-btn');
    const closeBtns = document.querySelectorAll('.close-modal-btn');

    openBtns.forEach(btn => btn.addEventListener('click', () => {
        if (modal) modal.style.display = 'block';
    }));

    closeBtns.forEach(btn => btn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
    }));

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === rxModal) rxModal.style.display = 'none';
    });
}

function openPrescriptionModal(index) {
    const item = appointmentsData[index];
    if (!item) return;

    // Auto-fill patient details into modal fields
    const nameElem = document.getElementById('rxPatientName');
    const dateElem = document.getElementById('rxDate');
    const ageElem = document.getElementById('rxAge');
    const sexElem = document.getElementById('rxSex');
    const addressElem = document.getElementById('rxAddress');

    if (nameElem) nameElem.value = item.client || item.clientName || '';
    if (dateElem) dateElem.value = item.date || getLocalDateString(new Date());
    if (ageElem) ageElem.value = item.age || '';
    if (sexElem && (item.gender || item.sex)) sexElem.value = item.gender || item.sex;
    if (addressElem) addressElem.value = item.address || '';

    // Open prescription modal
    const modal = document.getElementById('prescriptionModal');
    if (modal) modal.style.display = 'block';
}

function closePrescriptionModal() {
    const modal = document.getElementById('prescriptionModal');
    if (modal) modal.style.display = 'none';
}

function initSearchAndFilter() {
    const searchInput = document.getElementById('searchAppointment');
    const statusFilter = document.getElementById('statusFilter');

    const applyFilters = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const status = statusFilter ? statusFilter.value.toLowerCase() : 'all';

        const filtered = appointmentsData.filter(item => {
            const matchesQuery = (item.client || '').toLowerCase().includes(query) || 
                                 (item.service || item.treatment || '').toLowerCase().includes(query);
            const matchesStatus = status === 'all' || (item.status || 'pending').toLowerCase() === status;
            return matchesQuery && matchesStatus;
        });

        renderTableRows(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
}

/* =========================================
   9. NOTIFICATION SYSTEM
========================================= */
function showNotification(message, type = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: #fff;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#0284c7'};
        transition: opacity 0.3s ease;
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
// 1. View Patient Profile Handler
// One rule for "same patient": same name (ignoring case and extra spaces).
// The patient profile and the one-row-per-patient schedule table both use
// it, so the two always agree.
function getPatientGroupKey(item) {
    return String((item && (item.client || item.clientName)) || '')
        .trim().toLowerCase().replace(/\s+/g, ' ');
}

function getPatientHistory(client) {
    const key = getPatientGroupKey({ client });
    if (!key) return [];
    return appointmentsData
        .filter(a => getPatientGroupKey(a) === key)
        .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
}

function getPatientInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function viewPatientProfile(index) {
    const target = appointmentsData[index];
    if (!target) {
        showNotification('Patient profile not found.', 'error');
        return;
    }

    const history = getPatientHistory(target.client);
    const completedCount = history.filter(a => a.status === 'completed').length;
    const canceledCount = history.filter(a => a.status === 'canceled' || a.status === 'cancelled').length;
    const totalBilled = history
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);

    // Visits currently listed in the open profile (used by selectProfileVisit)
    profileHistoryList = history;

    const historyRowsHTML = history.map((a, i) => {
        const serviceLabel = a.service || a.treatment || 'N/A';
        const serviceWithTooth = a.tooth_number ? `${serviceLabel} (Tooth #${a.tooth_number})` : serviceLabel;
        return `
        <div class="profile-history-row ${a === target ? 'is-current' : ''}" data-visit-index="${i}"
             role="button" tabindex="0" title="Show this visit above"
             onclick="selectProfileVisit(${i})"
             onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectProfileVisit(${i}); }">
            <div class="profile-history-date">
                <strong>${formatLongDate(a.date)}</strong>
                <span>${formatTimeDisplay(a.time)}</span>
            </div>
            <div class="profile-history-service">${serviceWithTooth}</div>
            <div>${getStatusBadge(a.status)}</div>
            <div class="profile-history-price">\u20b1${(parseFloat(a.price) || 0).toFixed(2)}</div>
        </div>
    `;
    }).join('');

    const modalHTML = `
        <div class="modal-overlay active" id="patientProfileOverlay" onclick="if(event.target===this) closePatientProfileModal()">
            <div class="modal-card profile-modal-card">
                <div class="modal-header">
                    <div class="profile-identity">
                        <div class="profile-avatar">${getPatientInitials(target.client)}</div>
                        <div>
                            <h2>${target.client || 'N/A'}</h2>
                            <p class="profile-phone"><i class="fa-solid fa-phone"></i> ${target.phone || 'No phone on file'}</p>
                        </div>
                    </div>
                    <button class="close-modal-btn" onclick="closePatientProfileModal()">&times;</button>
                </div>

                <div class="profile-stats">
                    <div class="profile-stat">
                        <span class="profile-stat-label">Total Visits</span>
                        <span class="profile-stat-value">${history.length}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-label">Completed</span>
                        <span class="profile-stat-value">${completedCount}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-label">Canceled</span>
                        <span class="profile-stat-value">${canceledCount}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-label">Lifetime Billed</span>
                        <span class="profile-stat-value">₱${totalBilled.toFixed(2)}</span>
                    </div>
                </div>

                <div class="profile-section" id="profileThisAppointment">
                    <h3 class="profile-section-title">This Appointment</h3>
                    <div id="profileAppointmentBody">${buildThisAppointmentHTML(target)}</div>
                </div>

                <div class="profile-section">
                    <h3 class="profile-section-title">Appointment History (${history.length})</h3>
                    <p class="profile-history-hint">Click a visit to show its details in This Appointment above.</p>
                    <div class="profile-history-list">
                        ${historyRowsHTML || '<p class="profile-empty">No other appointments on record.</p>'}
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" onclick="viewMedicalHistory('${escapeAttr(target.client)}', '${escapeAttr(target.phone)}')"><i class="fa-solid fa-file-medical"></i> Medical History</button>
                    <button class="btn-secondary" onclick="closePatientProfileModal()">Close</button>
                </div>
            </div>
        </div>
    `;

    closePatientProfileModal();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function escapeProfileHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Age of the patient on a given date (the visit date), from a YYYY-MM-DD birthday
function getAgeAtDate(birthday, onDate) {
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday || '');
    if (!b) return null;

    const ref = /^(\d{4})-(\d{2})-(\d{2})/.exec(onDate || '');
    const now = new Date();
    const ry = ref ? +ref[1] : now.getFullYear();
    const rm = ref ? +ref[2] : now.getMonth() + 1;
    const rd = ref ? +ref[3] : now.getDate();

    let age = ry - +b[1];
    if (rm < +b[2] || (rm === +b[2] && rd < +b[3])) age--;
    return age >= 0 ? age : null;
}

// Visits currently listed in the open patient profile (newest first)
let profileHistoryList = [];

// The date / time / service / status / items / price block of the profile.
// Built from whichever visit is currently selected.
function buildThisAppointmentHTML(a) {
    const esc = escapeProfileHTML;
    const itemsUsed = (a.items_used || '').trim();
    const price = (parseFloat(a.price) || 0).toFixed(2);

    return `
        <div class="profile-detail-grid">
            <div><span class="profile-detail-label">Date</span><span>${esc(formatLongDate(a.date))}</span></div>
            <div><span class="profile-detail-label">Time</span><span>${esc(formatTimeDisplay(a.time))}</span></div>
            <div><span class="profile-detail-label">Service</span><span>${esc(a.service || a.treatment || 'N/A')}</span></div>
            <div><span class="profile-detail-label">Status</span>${getStatusBadge(a.status)}</div>
            ${a.tooth_number ? `<div><span class="profile-detail-label">Tooth</span><span>#${esc(a.tooth_number)}</span></div>` : ''}
        </div>
        <div class="profile-items-used">
            <span class="profile-detail-label">Items Used</span>
            <p>${itemsUsed ? esc(itemsUsed).replace(/\n/g, '<br>') : 'No items recorded.'}</p>
        </div>
        <div class="profile-price-row">
            <span class="profile-detail-label">Price</span>
            <span class="profile-price-value">\u20b1${price}</span>
        </div>
        ${buildBracesPlanHTML(a)}
    `;
}

// Braces payment plan summary shown in the patient profile
function buildBracesPlanHTML(a) {
    if (!isBracesService(a.service || a.treatment)) return '';
    const summary = getBracesSummary(a.client);
    if (!summary) return '';

    const keptCount = getKeptBracesPaymentCount(a.client);
    const caption = summary.balance > 0
        ? `${summary.percent.toFixed(0)}% paid &middot; about ${summary.visitsLeft} adjustment visit${summary.visitsLeft === 1 ? '' : 's'} left`
        : 'Fully paid';

    return `
        <div class="braces-profile-plan">
            <p class="visit-detail-heading">Braces Payment Plan</p>
            <div class="visit-detail-grid">
                <div><span class="profile-detail-label">Total Bill</span><span>${formatPeso(summary.total)}</span></div>
                <div><span class="profile-detail-label">Per Adjustment</span><span>${formatPeso(summary.perVisit)}</span></div>
                <div><span class="profile-detail-label">Paid So Far</span><span>${formatPeso(summary.paid)}</span></div>
                <div><span class="profile-detail-label">Balance</span><span>${formatPeso(summary.balance)}</span></div>
            </div>
            <div class="braces-progress"><div class="braces-progress-bar" style="width: ${summary.percent}%"></div></div>
            <div class="braces-progress-caption">${caption}</div>
            ${keptCount ? `<div class="braces-progress-caption" style="margin-top: 4px; opacity: 0.85;">Includes ${keptCount} payment${keptCount === 1 ? '' : 's'} from deleted visit${keptCount === 1 ? '' : 's'}.</div>` : ''}
        </div>
    `;
}

// Clicking a row in Appointment History: the layout stays exactly the same —
// only the This Appointment info above changes to that visit, and the
// highlight moves to the row that was clicked.
function selectProfileVisit(i) {
    const visit = profileHistoryList[i];
    const body = document.getElementById('profileAppointmentBody');
    if (!visit || !body) return;

    document.querySelectorAll('#patientProfileOverlay .profile-history-row').forEach(row => {
        row.classList.toggle('is-current', Number(row.dataset.visitIndex) === i);
    });

    body.innerHTML = buildThisAppointmentHTML(visit);

    const section = document.getElementById('profileThisAppointment');
    if (section) {
        section.classList.remove('is-updated');
        void section.offsetWidth; // restart the highlight animation
        section.classList.add('is-updated');
        section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function closePatientProfileModal() {
    const existing = document.getElementById('patientProfileOverlay');
    if (existing) existing.remove();
}

// 2. Edit Appointment Handler
function editAppointment(index) {
    const target = appointmentsData[index];
    if (!target) return;

    if (/^cancel/i.test(target.status || '')) {
        showNotification("Canceled appointments can't be edited.", 'error');
        return;
    }

    // the booking form on history.html reads this id to load the record into the form
    window.location.href = `history.html?edit=${target.id || ''}#bookAppointment`;
}

// Rebook: opens the booking form with this patient's details already filled
// in; only the date and time are left for staff to choose.
function rebookAppointment(index) {
    const target = appointmentsData[index];
    if (!target) return;

    window.location.href = `history.html?rebook=${target.id || ''}#bookAppointment`;
}

// 3. Cancel Appointment Handler
async function cancelAppointment(index) {
    const target = appointmentsData[index];
    if (!target) return;

    const statusKey = (target.status || '').toLowerCase();
    if (statusKey === 'completed' || statusKey === 'canceled' || statusKey === 'cancelled') {
        showNotification('This appointment is already ' + statusKey + ' and can\'t be canceled.', 'error');
        return;
    }

    const confirmCancel = confirm(`Cancel the appointment for ${target.client || 'this patient'}?`);
    if (!confirmCancel) return;

    try {
        target.status = 'canceled';

        if (supabaseClient && target.id) {
            const { error } = await supabaseClient
                .from('appointments')
                .update({ status: 'canceled' })
                .eq('id', target.id);

            if (error) throw error;
        } else {
            localStorage.setItem('dental_appointments', JSON.stringify(appointmentsData));
        }

        await fetchDashboardData();
    } catch (err) {
        alert('Failed to cancel appointment: ' + err.message);
    }
}

/* =========================================
   MEDICAL HISTORY
   One record per patient, keyed by (client_name, phone) — filling the form
   again for a returning patient updates their existing record rather than
   creating a new one each visit. Requires a "medical_history" table in
   Supabase with a unique constraint on (client_name, phone).
========================================= */
function escapeAttr(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getMedicalHistoryFieldMap() {
    return {
        civil_status: 'mhCivilStatus',
        occupation: 'mhOccupation',
        religion: 'mhReligion',
        nationality: 'mhNationality',
        referred_by: 'mhReferredBy',
        height: 'mhHeight',
        weight: 'mhWeight',
        good_health: 'mhGoodHealth',
        under_treatment: 'mhUnderTreatment',
        under_treatment_details: 'mhUnderTreatmentDetails',
        had_illness_surgery: 'mhIllnessSurgery',
        illness_surgery_details: 'mhIllnessSurgeryDetails',
        been_hospitalized: 'mhHospitalized',
        hospitalized_details: 'mhHospitalizedDetails',
        taking_medication: 'mhMedication',
        medication_details: 'mhMedicationDetails',
        uses_tobacco: 'mhTobacco',
        uses_alcohol_drugs: 'mhAlcoholDrugs',
        bleeding_time: 'mhBleedingTime',
        blood_type: 'mhBloodType',
        blood_pressure: 'mhBloodPressure',
        is_pregnant: 'mhPregnant',
        is_nursing: 'mhNursing',
        taking_birth_control: 'mhBirthControl',
        allergy_other: 'allergyOtherText',
        conditions_other: 'conditionsOtherText'
    };
}

/* "If so..." detail boxes: only usable while the matching question is "Yes".
   Choosing "No" (or leaving it blank) clears and locks the box. */
const MH_YES_NO_DETAIL_PAIRS = [
    ['mhUnderTreatment', 'mhUnderTreatmentDetails'],
    ['mhIllnessSurgery', 'mhIllnessSurgeryDetails'],
    ['mhHospitalized', 'mhHospitalizedDetails'],
    ['mhMedication', 'mhMedicationDetails']
];

function syncMedicalDetailFields() {
    MH_YES_NO_DETAIL_PAIRS.forEach(([selectId, inputId]) => {
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);
        if (!select || !input) return;
        const isYes = select.value === 'Yes';
        if (!isYes) {
            input.value = '';
            input.classList.remove('mh-invalid');
        }
        input.disabled = !isYes;
        input.placeholder = isYes ? '' : 'Select "Yes" above to fill this in';
    });
}

document.addEventListener('change', (e) => {
    if (MH_YES_NO_DETAIL_PAIRS.some(([selectId]) => selectId === e.target.id)) {
        syncMedicalDetailFields();
        const pair = MH_YES_NO_DETAIL_PAIRS.find(([selectId]) => selectId === e.target.id);
        if (e.target.value === 'Yes') document.getElementById(pair[1])?.focus();
    }
});

function resetMedicalHistoryForm() {
    Object.values(getMedicalHistoryFieldMap()).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['allergyLocalAnesthetic', 'allergyPenicillin', 'allergySulfurDrugs', 'allergyAspirin', 'allergyLatex', 'allergyOtherCheck', 'conditionsOtherCheck', 'mhConsentConfirmed']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = false;
        });

    document.querySelectorAll('.mh-condition').forEach(cb => { cb.checked = false; });
    syncMedicalDetailFields();
}

function fillMedicalHistoryForm(record) {
    resetMedicalHistoryForm();
    if (!record) return;

    Object.entries(getMedicalHistoryFieldMap()).forEach(([column, id]) => {
        const el = document.getElementById(id);
        if (el && record[column] !== undefined && record[column] !== null) {
            el.value = record[column];
        }
    });

    syncMedicalDetailFields();

    if (record.allergy_local_anesthetic) document.getElementById('allergyLocalAnesthetic').checked = true;
    if (record.allergy_penicillin) document.getElementById('allergyPenicillin').checked = true;
    if (record.allergy_sulfur_drugs) document.getElementById('allergySulfurDrugs').checked = true;
    if (record.allergy_aspirin) document.getElementById('allergyAspirin').checked = true;
    if (record.allergy_latex) document.getElementById('allergyLatex').checked = true;
    if (record.allergy_other) document.getElementById('allergyOtherCheck').checked = true;
    if (record.consent_confirmed) document.getElementById('mhConsentConfirmed').checked = true;

    const conditions = Array.isArray(record.conditions) ? record.conditions : [];
    document.querySelectorAll('.mh-condition').forEach(cb => {
        cb.checked = conditions.includes(cb.value);
    });
    if (record.conditions_other) {
        document.getElementById('conditionsOtherCheck').checked = true;
    }
}

/* "For Women Only" section: visible only when Gender = Female.
   Hiding it clears its answers so stale values are never saved. */
function syncWomenOnlySection() {
    const section = document.getElementById('mhWomenOnlySection');
    if (!section) return;
    const isFemale = (document.getElementById('gender')?.value || '').toLowerCase() === 'female';
    section.style.display = isFemale ? '' : 'none';
    if (!isFemale) {
        ['mhPregnant', 'mhNursing', 'mhBirthControl'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
}

document.addEventListener('change', (e) => {
    if (e.target.id === 'gender') syncWomenOnlySection();
});

async function openMedicalHistoryForm() {
    const clientName = document.getElementById('clientName')?.value?.trim();
    const phone = document.getElementById('phone')?.value?.trim();

    if (!clientName || !phone) {
        showNotification('Please fill in the Patient Name and Mobile Number first.', 'error');
        return;
    }

    const nameLabel = document.getElementById('mhPatientNameLabel');
    if (nameLabel) nameLabel.textContent = clientName;

    resetMedicalHistoryForm();

    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('medical_history')
            .select('*')
            .eq('client_name', clientName)
            .eq('phone', phone)
            .maybeSingle();

        if (error) {
            console.error('Failed to load medical history:', error);
        } else if (data) {
            fillMedicalHistoryForm(data);
        }
    }

    syncWomenOnlySection();

    const overlay = document.getElementById('medicalHistoryOverlay');
    if (overlay) overlay.classList.add('active');
}

function closeMedicalHistoryForm() {
    const overlay = document.getElementById('medicalHistoryOverlay');
    if (overlay) overlay.classList.remove('active');
}

async function saveMedicalHistory() {
    const clientName = document.getElementById('clientName')?.value?.trim();
    const phone = document.getElementById('phone')?.value?.trim();

    if (!clientName || !phone) {
        showNotification('Please fill in the Patient Name and Mobile Number first.', 'error');
        return;
    }

    if (!supabaseClient) {
        showNotification('Medical history requires a live Supabase connection.', 'error');
        return;
    }

    const val = (id) => document.getElementById(id)?.value?.trim() || null;
    const checked = (id) => !!document.getElementById(id)?.checked;
    const conditions = Array.from(document.querySelectorAll('.mh-condition:checked')).map(cb => cb.value);

    // Every "Yes" (or ticked "Other") needs its detail filled in before saving.
    const requiredDetails = [
        { when: () => val('mhUnderTreatment') === 'Yes', field: 'mhUnderTreatmentDetails', label: 'Medical treatment (condition being treated)' },
        { when: () => val('mhIllnessSurgery') === 'Yes', field: 'mhIllnessSurgeryDetails', label: 'Serious illness / surgery' },
        { when: () => val('mhHospitalized') === 'Yes', field: 'mhHospitalizedDetails', label: 'Hospitalized' },
        { when: () => val('mhMedication') === 'Yes', field: 'mhMedicationDetails', label: 'Medication' },
        { when: () => checked('allergyOtherCheck'), field: 'allergyOtherText', label: 'Other allergy' },
        { when: () => checked('conditionsOtherCheck'), field: 'conditionsOtherText', label: 'Other condition' }
    ];

    document.querySelectorAll('#medicalHistoryOverlay .mh-invalid')
        .forEach(el => el.classList.remove('mh-invalid'));

    const missing = requiredDetails.filter(r => r.when() && !val(r.field));
    if (missing.length) {
        missing.forEach(r => {
            const el = document.getElementById(r.field);
            if (!el) return;
            el.classList.add('mh-invalid');
            el.addEventListener('input', () => el.classList.remove('mh-invalid'), { once: true });
        });
        const first = document.getElementById(missing[0].field);
        if (first) {
            first.scrollIntoView({ block: 'center', behavior: 'smooth' });
            first.focus({ preventScroll: true });
        }
        showNotification(`Please fill in the details before saving: ${missing.map(r => r.label).join(', ')}.`, 'error');
        return;
    }

    const payload = {
        client_name: clientName,
        phone: phone,
        height: val('mhHeight'),
        weight: val('mhWeight'),
        civil_status: val('mhCivilStatus'),
        occupation: val('mhOccupation'),
        religion: val('mhReligion'),
        nationality: val('mhNationality'),
        referred_by: val('mhReferredBy'),
        good_health: val('mhGoodHealth'),
        under_treatment: val('mhUnderTreatment'),
        under_treatment_details: val('mhUnderTreatmentDetails'),
        had_illness_surgery: val('mhIllnessSurgery'),
        illness_surgery_details: val('mhIllnessSurgeryDetails'),
        been_hospitalized: val('mhHospitalized'),
        hospitalized_details: val('mhHospitalizedDetails'),
        taking_medication: val('mhMedication'),
        medication_details: val('mhMedicationDetails'),
        uses_tobacco: val('mhTobacco'),
        uses_alcohol_drugs: val('mhAlcoholDrugs'),
        allergy_local_anesthetic: checked('allergyLocalAnesthetic'),
        allergy_penicillin: checked('allergyPenicillin'),
        allergy_sulfur_drugs: checked('allergySulfurDrugs'),
        allergy_aspirin: checked('allergyAspirin'),
        allergy_latex: checked('allergyLatex'),
        allergy_other: checked('allergyOtherCheck') ? (val('allergyOtherText') || 'Yes') : null,
        bleeding_time: val('mhBleedingTime'),
        is_pregnant: val('mhPregnant'),
        is_nursing: val('mhNursing'),
        taking_birth_control: val('mhBirthControl'),
        blood_type: val('mhBloodType'),
        blood_pressure: val('mhBloodPressure'),
        conditions: conditions,
        conditions_other: checked('conditionsOtherCheck') ? (val('conditionsOtherText') || 'Yes') : null,
        consent_confirmed: checked('mhConsentConfirmed'),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
        .from('medical_history')
        .upsert(payload, { onConflict: 'client_name,phone' });

    if (error) {
        console.error('Failed to save medical history:', error);
        showNotification(`Failed to save medical history: ${error.message}`, 'error');
        return;
    }

    showNotification('Medical history saved.', 'success');
    closeMedicalHistoryForm();
}

/* ---- Read-only view, opened from the Patient Profile modal ---- */
async function viewMedicalHistory(clientName, phone) {
    if (!supabaseClient) {
        showNotification('Medical history requires a live Supabase connection.', 'error');
        return;
    }

    const { data, error } = await supabaseClient
        .from('medical_history')
        .select('*')
        .eq('client_name', clientName)
        .eq('phone', phone)
        .maybeSingle();

    if (error) {
        console.error('Failed to load medical history:', error);
        showNotification('Failed to load medical history.', 'error');
        return;
    }

    let bodyHTML;
    if (!data) {
        bodyHTML = `<div class="mh-view-empty"><i class="fa-solid fa-file-circle-question" style="font-size:28px; margin-bottom:10px; display:block;"></i><p>No medical history on file yet for this patient.</p></div>`;
    } else {
        const allergyChips = [];
        if (data.allergy_local_anesthetic) allergyChips.push('Local Anesthetic (Lidocaine)');
        if (data.allergy_penicillin) allergyChips.push('Penicillin, Antibiotics');
        if (data.allergy_sulfur_drugs) allergyChips.push('Sulfur Drugs');
        if (data.allergy_aspirin) allergyChips.push('Aspirin');
        if (data.allergy_latex) allergyChips.push('Latex');
        if (data.allergy_other) allergyChips.push(`Other: ${data.allergy_other}`);

        const conditions = Array.isArray(data.conditions) ? [...data.conditions] : [];
        if (data.conditions_other) conditions.push(`Other: ${data.conditions_other}`);

        bodyHTML = `
            <div class="profile-section">
                <h3 class="profile-section-title">Patient Information</h3>
                <div class="profile-detail-grid">
                    <div><span class="profile-detail-label">Height</span><span>${data.height || '—'}</span></div>
                    <div><span class="profile-detail-label">Weight</span><span>${data.weight || '—'}</span></div>
                    <div><span class="profile-detail-label">Civil Status</span><span>${data.civil_status || '—'}</span></div>
                    <div><span class="profile-detail-label">Occupation</span><span>${data.occupation || '—'}</span></div>
                    <div><span class="profile-detail-label">Religion</span><span>${data.religion || '—'}</span></div>
                    <div><span class="profile-detail-label">Nationality</span><span>${data.nationality || '—'}</span></div>
                    <div><span class="profile-detail-label">Referred By</span><span>${data.referred_by || '—'}</span></div>
                    <div><span class="profile-detail-label">Blood Type</span><span>${data.blood_type || '—'}</span></div>
                    <div><span class="profile-detail-label">Blood Pressure</span><span>${data.blood_pressure || '—'}</span></div>
                </div>
            </div>

            <div class="profile-section">
                <h3 class="profile-section-title">Medical History</h3>
                <div class="profile-detail-grid">
                    <div><span class="profile-detail-label">In good health?</span><span>${data.good_health || '—'}</span></div>
                    <div><span class="profile-detail-label">Under medical treatment?</span><span>${data.under_treatment || '—'}${data.under_treatment_details ? ` (${data.under_treatment_details})` : ''}</span></div>
                    <div><span class="profile-detail-label">Serious illness/surgery?</span><span>${data.had_illness_surgery || '—'}${data.illness_surgery_details ? ` (${data.illness_surgery_details})` : ''}</span></div>
                    <div><span class="profile-detail-label">Ever hospitalized?</span><span>${data.been_hospitalized || '—'}${data.hospitalized_details ? ` (${data.hospitalized_details})` : ''}</span></div>
                    <div><span class="profile-detail-label">Taking medication?</span><span>${data.taking_medication || '—'}${data.medication_details ? ` (${data.medication_details})` : ''}</span></div>
                    <div><span class="profile-detail-label">Uses tobacco?</span><span>${data.uses_tobacco || '—'}</span></div>
                    <div><span class="profile-detail-label">Uses alcohol/drugs?</span><span>${data.uses_alcohol_drugs || '—'}</span></div>
                    <div><span class="profile-detail-label">Bleeding Time</span><span>${data.bleeding_time || '—'}</span></div>
                </div>
            </div>

            <div class="profile-section">
                <h3 class="profile-section-title">Allergies</h3>
                ${allergyChips.length ? `<div class="mh-view-chip-list">${allergyChips.map(a => `<span class="mh-view-chip">${a}</span>`).join('')}</div>` : '<p class="profile-empty">No known allergies on file.</p>'}
            </div>

            <div class="profile-section">
                <h3 class="profile-section-title">Existing / Past Conditions</h3>
                ${conditions.length ? `<div class="mh-view-chip-list">${conditions.map(c => `<span class="mh-view-chip">${c}</span>`).join('')}</div>` : '<p class="profile-empty">No conditions on file.</p>'}
            </div>

            <div class="profile-section">
                <h3 class="profile-section-title">For Women Only</h3>
                <div class="profile-detail-grid">
                    <div><span class="profile-detail-label">Pregnant?</span><span>${data.is_pregnant || '—'}</span></div>
                    <div><span class="profile-detail-label">Nursing?</span><span>${data.is_nursing || '—'}</span></div>
                    <div><span class="profile-detail-label">Birth control?</span><span>${data.taking_birth_control || '—'}</span></div>
                </div>
            </div>
        `;
    }

    const modalHTML = `
        <div class="modal-overlay active" id="medicalHistoryViewOverlay" onclick="if(event.target===this) closeMedicalHistoryView()">
            <div class="modal-card profile-modal-card">
                <div class="modal-header">
                    <h2><i class="fa-solid fa-file-medical"></i> Medical History — ${clientName}</h2>
                    <button class="close-modal-btn" onclick="closeMedicalHistoryView()">&times;</button>
                </div>
                ${bodyHTML}
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeMedicalHistoryView()">Close</button>
                </div>
            </div>
        </div>
    `;

    closeMedicalHistoryView();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeMedicalHistoryView() {
    const existing = document.getElementById('medicalHistoryViewOverlay');
    if (existing) existing.remove();
}

/* =========================================
   1b. STAFF MANAGEMENT (staff.html, admin only)
   Lists every non-admin account that has been through approval, with its
   last login, and lets the admin permanently remove an account (e.g. when a
   staff member leaves the clinic). Both actions go through database
   functions (admin_list_staff / admin_delete_staff) that re-check the
   caller is an admin on the server, because the browser is not allowed to
   read login timestamps or delete login accounts directly.
========================================= */
/* =========================================
   SUPER ADMIN: reset an admin / dentist password
   Admins and dentists can't use "Forgot Password?" - only the super admin
   can set a new password for them (database function super_admin_set_password).
========================================= */
/* =========================================
   DATA BACKUP (staff.html, admin only)
   Downloads every clinic table as one JSON file you can keep on a flash
   drive / Google Drive. This is your own copy, separate from Supabase's
   automatic backups (which depend on the plan).
   Logins and passwords live in Supabase Auth and are NOT in the file;
   the staff list in it has usernames, roles and status only.
========================================= */
const BACKUP_TABLES = [
    { name: 'appointments',          label: 'Appointments',            order: 'id' },
    { name: 'medical_history',       label: 'Medical histories',       order: null },
    { name: 'payments',              label: 'Payment ledger',          order: 'id' },
    { name: 'document_history',      label: 'Prescription & certificate history', order: 'id' },
    { name: 'clinic_settings',       label: 'Clinic settings',         order: null },
    { name: 'profiles',              label: 'Staff accounts (no passwords)', order: null },
    { name: 'staff_removal_history', label: 'Staff removal history',   order: null }
];
const BACKUP_KEY = 'dental_last_backup';
const BACKUP_WARN_DAYS = 7;

// All rows of one table, 1000 at a time
async function fetchAllRowsForBackup(table, orderCol) {
    const PAGE = 1000;
    let rows = [];
    for (let from = 0; ; from += PAGE) {
        let query = supabaseClient.from(table).select('*');
        if (orderCol) query = query.order(orderCol, { ascending: true });
        let { data, error } = await query.range(from, from + PAGE - 1);
        if (error && orderCol) {   // that column doesn't exist: retry without ordering
            ({ data, error } = await supabaseClient.from(table).select('*').range(from, from + PAGE - 1));
        }
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < PAGE) break;
    }
    return rows;
}

function refreshBackupStatus() {
    const el = document.getElementById('backupStatus');
    if (!el) return;
    let last = null;
    try { last = JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch (e) { /* ignore */ }

    if (!last || !last.at) {
        el.className = 'backup-status backup-status-warn';
        el.textContent = 'No backup has been downloaded from this computer yet.';
        return;
    }
    const days = Math.floor((Date.now() - new Date(last.at).getTime()) / 86400000);
    const when = formatLongDateTime(last.at);
    if (days >= BACKUP_WARN_DAYS) {
        el.className = 'backup-status backup-status-warn';
        el.textContent = `Last backup: ${when} (${days} days ago) \u2014 time to download a new one.`;
    } else {
        el.className = 'backup-status backup-status-ok';
        el.textContent = `Last backup: ${when}${days === 0 ? ' (today)' : ` (${days} day${days === 1 ? '' : 's'} ago)`}.`;
    }
}

function initBackupSection() {
    const section = document.getElementById('backupSection');
    if (!section) return;
    section.style.display = '';
    refreshBackupStatus();
}

async function downloadBackup() {
    if (!supabaseClient) {
        showNotification('Backup needs a live Supabase connection.', 'error');
        return;
    }
    const btn = document.getElementById('backupBtn');
    const resultBody = document.querySelector('#backupResultTable tbody');
    const resultWrap = document.getElementById('backupResultWrap');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Backing up\u2026'; }
    if (resultBody) resultBody.innerHTML = '';

    const backup = {
        app: 'Oralux Dental Clinic',
        format: 1,
        created_at: new Date().toISOString(),
        created_by: (await getMyProfile())?.username || 'unknown',
        tables: {}
    };
    let totalRows = 0;
    let failed = 0;

    for (const t of BACKUP_TABLES) {
        let status, count = 0;
        try {
            const rows = await fetchAllRowsForBackup(t.name, t.order);
            backup.tables[t.name] = rows;
            count = rows.length;
            totalRows += count;
            status = 'Saved';
        } catch (err) {
            failed++;
            status = 'Skipped: ' + (err.message || 'could not be read');
            console.warn(`Backup: ${t.name} skipped:`, err);
        }
        if (resultBody) {
            const tr = resultBody.insertRow();
            tr.insertCell().textContent = t.label;
            tr.insertCell().textContent = status === 'Saved' ? count : '\u2014';
            const cell = tr.insertCell();
            cell.textContent = status;
            cell.style.color = status === 'Saved' ? '#0B5F4F' : '#B3463C';
        }
    }
    if (resultWrap) resultWrap.style.display = '';

    const stamp = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fileName = `oralux-dental-backup-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.json`;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: backup.created_at, rows: totalRows })); } catch (e) { /* ignore */ }
    refreshBackupStatus();

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-download"></i> Download Backup'; }
    showNotification(
        failed
            ? `Backup downloaded (${totalRows} records). ${failed} table(s) were skipped - see the list.`
            : `Backup downloaded: ${totalRows} records saved to ${fileName}.`,
        failed ? 'error' : 'success'
    );
}

let adminResetTarget = null;

async function loadSuperAdminSection() {
    const section = document.getElementById('superAdminSection');
    const tbody = document.querySelector('#adminAccountsTable tbody');
    if (!section || !tbody || !supabaseClient) return;

    const accountType = await getMyAccountType();
    if (accountType !== 'super_admin') return;   // everyone else never sees this panel

    section.style.display = '';
    const { data, error } = await supabaseClient.rpc('super_admin_list_admins');
    if (error) {
        console.error('Failed to load admin accounts:', error);
        tbody.innerHTML = `<tr><td colspan="5">Couldn't load admin accounts. Run super_admin_setup.sql in Supabase first.</td></tr>`;
        return;
    }
    renderAdminAccounts(data || []);
}

function renderAdminAccounts(rows) {
    const tbody = document.querySelector('#adminAccountsTable tbody');
    const badge = document.getElementById('adminAccountsCount');
    if (!tbody) return;
    if (badge) badge.textContent = rows.length;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: var(--text-muted, #888);">No admin or dentist accounts yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    rows.forEach(acc => {
        const row = tbody.insertRow();
        row.insertCell().textContent = acc.username || '(no username)';
        row.insertCell().textContent = acc.email || '\u2014';

        const typeCell = row.insertCell();
        const tag = document.createElement('span');
        tag.className = 'request-tag';
        tag.style.marginLeft = '0';
        tag.textContent = ACCOUNT_TYPE_LABELS[acc.account_type] || 'Administrator';
        typeCell.appendChild(tag);

        row.insertCell().textContent = acc.last_sign_in_at ? formatLongDateTime(acc.last_sign_in_at) : 'Never logged in';

        const actionCell = row.insertCell();
        const btn = document.createElement('button');
        btn.className = 'btn-icon btn-view';
        btn.style.cssText = 'width:auto; padding:6px 12px;';
        btn.innerHTML = '<i class="fa-solid fa-key"></i> Reset Password';
        btn.onclick = () => openAdminResetModal(acc);
        actionCell.appendChild(btn);
    });
}

function openAdminResetModal(acc) {
    adminResetTarget = acc;
    document.getElementById('adminResetMessage').textContent =
        `Set a new password for ${acc.username || acc.email}. They will be signed out everywhere and can log in with it right away.`;
    ['admin-reset-password', 'admin-reset-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.type = 'password'; }
    });
    document.querySelectorAll('#adminResetOverlay .pw-toggle').forEach(b => { b.innerHTML = '<i class="fa-regular fa-eye"></i>'; });
    updatePasswordChecklist('admin-reset-password', 'adminResetRules');
    document.getElementById('adminResetOverlay').classList.add('active');
}

function closeAdminResetModal() {
    document.getElementById('adminResetOverlay')?.classList.remove('active');
    adminResetTarget = null;
}

async function confirmAdminReset() {
    if (!adminResetTarget || !supabaseClient) return;
    const pw = document.getElementById('admin-reset-password').value.trim();
    const confirmPw = document.getElementById('admin-reset-confirm').value.trim();

    const problem = passwordErrorMessage(pw);
    if (problem) { showNotification(problem, 'error'); return; }
    if (pw !== confirmPw) { showNotification('Passwords do not match.', 'error'); return; }

    const btn = document.getElementById('adminResetConfirmBtn');
    if (btn) btn.disabled = true;
    const { error } = await supabaseClient.rpc('super_admin_set_password', {
        target_id: adminResetTarget.id,
        new_password: pw
    });
    if (btn) btn.disabled = false;

    if (error) {
        console.error('Password reset failed:', error);
        showNotification(`Failed to reset password: ${error.message}`, 'error');
        return;
    }
    showNotification(`Password updated for ${adminResetTarget.username || adminResetTarget.email}.`, 'success');
    closeAdminResetModal();
}

async function loadStaffManagement() {
    const section = document.getElementById('staffManagementSection');
    const tbody = document.querySelector('#staffTable tbody');
    if (!section || !tbody || !supabaseClient) return;

    const { data, error } = await supabaseClient.rpc('admin_list_staff');

    if (error) {
        console.error('Failed to load staff:', error);
        section.style.display = '';
        tbody.innerHTML = `<tr><td colspan="5">Couldn't load staff accounts.</td></tr>`;
        return;
    }

    section.style.display = '';
    renderStaffList(data || []);
    loadStaffHistory();
}

function renderStaffList(rows) {
    const tbody = document.querySelector('#staffTable tbody');
    const badge = document.getElementById('staffCount');
    if (!tbody) return;

    if (badge) badge.textContent = rows.length;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: var(--text-muted, #888);">No staff accounts yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    rows.forEach(staff => {
        const row = tbody.insertRow();

        row.insertCell().textContent = staff.username || '(no username)';
        row.insertCell().textContent = staff.email || '—';

        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        const isActive = staff.status === 'approved';
        statusBadge.className = `badge ${isActive ? 'badge-completed' : 'badge-canceled'}`;
        statusBadge.textContent = isActive ? 'Active' : 'Declined';
        statusCell.appendChild(statusBadge);

        row.insertCell().textContent = staff.last_sign_in_at
            ? formatLongDateTime(staff.last_sign_in_at)
            : 'Never logged in';

        const actionCell = row.insertCell();
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'btn-icon btn-cancel';
        removeBtn.style.cssText = 'width:auto; padding:6px 12px;';
        removeBtn.onclick = () => openRemoveStaffModal(staff);
        actionCell.appendChild(removeBtn);
    });
}

/* =========================================
   1c. STAFF REMOVAL HISTORY (staff.html, admin only)
   Removing a staff member no longer just deletes them: the database
   function admin_delete_staff writes a permanent record (who, when, why,
   last login) into staff_removal_history before deleting the login.
   That table is read-only from the browser, so history can't be edited.
========================================= */
let staffRemovalTarget = null;
let staffHistoryRows = [];
let staffHistorySearchBound = false;

function openRemoveStaffModal(staff) {
    staffRemovalTarget = staff;
    const label = staff.username || staff.email || 'this account';
    const msg = document.getElementById('removeStaffMessage');
    if (msg) {
        msg.textContent = `Remove "${label}"? They will no longer be able to sign in. ` +
            `The removal is saved to Removal History with your name and the date.`;
    }
    const reason = document.getElementById('removeStaffReason');
    if (reason) reason.value = '';
    const btn = document.getElementById('removeStaffConfirmBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Remove'; }
    document.getElementById('removeStaffOverlay')?.classList.add('active');
}

function closeRemoveStaffModal() {
    document.getElementById('removeStaffOverlay')?.classList.remove('active');
    staffRemovalTarget = null;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeRemoveStaffModal();
});
document.getElementById('removeStaffOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'removeStaffOverlay') closeRemoveStaffModal();
});

async function confirmRemoveStaff() {
    if (!staffRemovalTarget) return;
    const btn = document.getElementById('removeStaffConfirmBtn');
    const reason = (document.getElementById('removeStaffReason')?.value || '').trim();

    if (btn) { btn.disabled = true; btn.textContent = 'Removing...'; }

    const { error } = await supabaseClient.rpc('admin_delete_staff', {
        target_id: staffRemovalTarget.id,
        removal_reason: reason || null
    });

    if (error) {
        console.error('Failed to delete staff:', error);
        showNotification(`Couldn't remove account: ${error.message}`, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Remove'; }
        return;
    }

    closeRemoveStaffModal();
    showNotification('Staff account removed and saved to history.', 'success');
    await loadStaffManagement(); // also refreshes the history table
}

async function loadStaffHistory() {
    const section = document.getElementById('staffHistorySection');
    const tbody = document.querySelector('#staffHistoryTable tbody');
    if (!section || !tbody || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('staff_removal_history')
        .select('id, username, email, removed_by_name, removed_at, reason, last_sign_in_at')
        .order('removed_at', { ascending: false });

    section.style.display = '';

    if (error) {
        console.error('Failed to load removal history:', error);
        tbody.innerHTML = `<tr><td colspan="5">Couldn't load removal history.</td></tr>`;
        return;
    }

    staffHistoryRows = data || [];

    if (!staffHistorySearchBound) {
        staffHistorySearchBound = true;
        document.getElementById('staffHistorySearch')?.addEventListener('input', applyStaffHistoryFilter);
        document.getElementById('exportStaffHistoryBtn')?.addEventListener('click', exportStaffHistoryCsv);
    }
    applyStaffHistoryFilter();
}

function applyStaffHistoryFilter() {
    const q = (document.getElementById('staffHistorySearch')?.value || '').toLowerCase().trim();
    const rows = !q ? staffHistoryRows : staffHistoryRows.filter(r =>
        [r.username, r.email, r.removed_by_name, r.reason]
            .some(v => String(v || '').toLowerCase().includes(q))
    );
    renderStaffHistory(rows);
}

function renderStaffHistory(rows) {
    const tbody = document.querySelector('#staffHistoryTable tbody');
    const badge = document.getElementById('staffHistoryCount');
    if (!tbody) return;
    if (badge) badge.textContent = staffHistoryRows.length;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: var(--text-muted, #888);">${
            staffHistoryRows.length ? 'No matching records.' : 'No staff have been removed yet.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    rows.forEach(r => {
        const row = tbody.insertRow();
        row.insertCell().textContent = r.username || '(no username)';
        row.insertCell().textContent = r.email || '—';
        row.insertCell().textContent = r.removed_by_name || 'Unknown';
        row.insertCell().textContent = r.removed_at ? formatLongDateTime(r.removed_at) : '—';
        row.insertCell().textContent = r.reason || 'No reason given';
    });
}

function exportStaffHistoryCsv() {
    if (!staffHistoryRows.length) {
        showNotification('No removal history to export.', 'info');
        return;
    }
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Username', 'Email', 'Removed By', 'Date Removed', 'Last Login', 'Reason'].map(esc).join(',')];
    staffHistoryRows.forEach(r => lines.push([
        r.username, r.email, r.removed_by_name,
        r.removed_at ? new Date(r.removed_at).toLocaleString() : '',
        r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : 'Never',
        r.reason
    ].map(esc).join(',')));

    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `staff-removal-history-${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

/* =========================================
   DATE PICKER (replaces the browser calendar; week starts on Sunday)
========================================= */
/* Custom date picker for every <input type="date">.
   Why: the browser's built-in calendar popup follows the computer's regional
   settings and can start the week on Saturday. This one always runs
   Sun Mon Tue Wed Thu Fri Sat and shows dates as "October 6, 2026".

   The input keeps working like a normal date input for the rest of the code:
   .value still reads and writes "YYYY-MM-DD", and "input"/"change" events fire. */
(function () {
    'use strict';

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const pad = n => String(n).padStart(2, '0');
    const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

    function parseISO(s) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
        return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
    }
    function longDate(iso) {
        const p = parseISO(iso);
        return p ? `${MONTHS[p.m]} ${p.d}, ${p.y}` : '';
    }
    function todayISO() {
        const n = new Date();
        return toISO(n.getFullYear(), n.getMonth(), n.getDate());
    }

    let popup = null;
    let activeInput = null;
    let viewYear = 0;
    let viewMonth = 0;

    function closePopup() {
        if (popup) popup.remove();
        popup = null;
        activeInput = null;
    }

    function position() {
        if (!popup || !activeInput) return;
        const r = activeInput.getBoundingClientRect();
        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;
        let left = Math.min(r.left, window.innerWidth - pw - 8);
        left = Math.max(8, left);
        let top = r.bottom + 6;
        if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    function choose(iso) {
        const input = activeInput;
        closePopup();
        if (!input) return;
        input.value = iso;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function render() {
        if (!popup || !activeInput) return;
        const selected = activeInput.value;
        const min = activeInput.getAttribute('min') || '';
        const max = activeInput.getAttribute('max') || '';
        const today = todayISO();

        const first = new Date(viewYear, viewMonth, 1);
        const startOffset = first.getDay(); // 0 = Sunday, so the week starts on Sunday
        let cells = '';
        for (let i = 0; i < 42; i++) {
            const d = new Date(viewYear, viewMonth, 1 - startOffset + i);
            const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
            const cls = ['dp-day'];
            if (d.getMonth() !== viewMonth) cls.push('dp-other');
            if (iso === today) cls.push('dp-today');
            if (iso === selected) cls.push('dp-selected');
            const disabled = (min && iso < min) || (max && iso > max);
            if (disabled) cls.push('dp-disabled');
            cells += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}" ${disabled ? 'disabled' : ''}>${d.getDate()}</button>`;
        }

        popup.innerHTML = `
            <div class="dp-head">
                <button type="button" class="dp-nav" data-nav="-1" aria-label="Previous month">&#8249;</button>
                <div class="dp-title">${MONTHS[viewMonth]} ${viewYear}</div>
                <button type="button" class="dp-nav" data-nav="1" aria-label="Next month">&#8250;</button>
            </div>
            <div class="dp-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
            <div class="dp-grid">${cells}</div>
            <div class="dp-foot">
                ${activeInput.required ? '<span></span>' : '<button type="button" class="dp-link" data-act="clear">Clear</button>'}
                <button type="button" class="dp-link" data-act="today">Today</button>
            </div>`;
        position();
    }

    function openPopup(input) {
        if (activeInput === input) return;
        closePopup();
        activeInput = input;
        const base = parseISO(input.value) || parseISO(todayISO());
        viewYear = base.y;
        viewMonth = base.m;
        popup = document.createElement('div');
        popup.className = 'dp-popup';
        popup.addEventListener('mousedown', e => e.preventDefault());
        popup.addEventListener('click', e => {
            const t = e.target.closest('button');
            if (!t) return;
            if (t.dataset.nav) {
                viewMonth += parseInt(t.dataset.nav, 10);
                if (viewMonth < 0) { viewMonth = 11; viewYear--; }
                if (viewMonth > 11) { viewMonth = 0; viewYear++; }
                render();
            } else if (t.dataset.iso) {
                choose(t.dataset.iso);
            } else if (t.dataset.act === 'today') {
                const min = input.getAttribute('min') || '';
                const max = input.getAttribute('max') || '';
                const t0 = todayISO();
                if ((min && t0 < min) || (max && t0 > max)) return;
                choose(t0);
            } else if (t.dataset.act === 'clear') {
                choose('');
            }
        });
        document.body.appendChild(popup);
        render();
    }

    function enhance(input) {
        if (input.dataset.dpReady) return;
        input.dataset.dpReady = '1';

        const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        let iso = parseISO(input.value) ? input.value.slice(0, 10) : '';

        input.type = 'text';
        input.readOnly = true;
        input.autocomplete = 'off';
        input.placeholder = 'Select a date';
        input.classList.add('dp-input');

        const show = () => nativeValue.set.call(input, longDate(iso));
        Object.defineProperty(input, 'value', {
            configurable: true,
            get() { return iso; },
            set(v) { iso = parseISO(v) ? String(v).slice(0, 10) : ''; show(); }
        });
        show();

        input.addEventListener('click', () => openPopup(input));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openPopup(input);
            } else if (e.key === 'Escape') {
                closePopup();
            }
        });
        if (input.form) {
            input.form.addEventListener('reset', () => setTimeout(() => { iso = ''; show(); }, 0));
        }
    }

    function enhanceAll() {
        document.querySelectorAll('input[type="date"]').forEach(enhance);
    }

    document.addEventListener('mousedown', e => {
        if (popup && !popup.contains(e.target) && e.target !== activeInput) closePopup();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });
    window.addEventListener('resize', closePopup);
    window.addEventListener('scroll', position, true);

    // Scripts sit at the end of <body>, so the inputs already exist: convert
    // them now, before any other code fills them in. Safe to run twice.
    enhanceAll();
    document.addEventListener('DOMContentLoaded', enhanceAll);
    window.enhanceDatePicker = enhance;
})();