/*
 * FlowPeople auth client. Talks to YOUR backend through the endpoints in
 * auth-config.js. There is no mock authentication and no stored credentials:
 *  - every decision about who the user is comes from the server (/me),
 *  - the session lives in an httpOnly cookie that this script cannot read,
 *  - passwords are sent only over the request body and never stored or logged.
 * Client-side validation is for user experience only. The server must repeat it.
 */
(function () {
  'use strict';

  /* ---------- config ---------- */
  var DEFAULTS = window.FLOWPEOPLE_AUTH_CONFIG || {};
  var CONFIG = {
    apiBase: DEFAULTS.apiBase || '',
    endpoints: DEFAULTS.endpoints || {},
    csrf: DEFAULTS.csrf || { endpoint: null, header: 'X-CSRF-Token' },
    routes: DEFAULTS.routes || {},
    roleHome: DEFAULTS.roleHome || {},
    passwordMinLength: DEFAULTS.passwordMinLength || 10
  };

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function params() { return new URLSearchParams(window.location.search); }
  function route(name) { return CONFIG.routes[name] || '/'; }

  // Only same-site relative paths. Blocks open redirects like //evil.com or /\evil.com.
  function safeNext(n) {
    if (typeof n !== 'string' || n.length > 2000) return null;
    if (n.charAt(0) !== '/' || n.charAt(1) === '/' || n.charAt(1) === '\\') return null;
    if (/[\u0000-\u001f\u007f]/.test(n)) return null;
    return n;
  }

  var PENDING_KEY = 'fp_pending_email'; // email only, never a password or token
  function setPendingEmail(e) { try { sessionStorage.setItem(PENDING_KEY, e); } catch (x) {} }
  function getPendingEmail() { try { return sessionStorage.getItem(PENDING_KEY) || ''; } catch (x) { return ''; } }

  /* ---------- network ---------- */
  var csrfToken = null;
  async function getCsrf() {
    if (!CONFIG.csrf.endpoint) return null;
    if (csrfToken) return csrfToken;
    try {
      var r = await fetch(CONFIG.apiBase + CONFIG.csrf.endpoint, { credentials: 'include', cache: 'no-store' });
      if (r.ok) { var j = await r.json(); csrfToken = j.csrfToken || null; }
    } catch (e) { /* handled when the real request fails */ }
    return csrfToken;
  }

  async function request(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var headers = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') {
      var t = await getCsrf();
      if (t) headers[CONFIG.csrf.header] = t;
    }
    try {
      var res = await fetch(CONFIG.apiBase + path, {
        method: method,
        credentials: 'include',
        cache: 'no-store',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
      var text = await res.text(), data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data: data, retryAfter: res.headers.get('Retry-After') };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    }
  }

  /* ---------- UI helpers ---------- */
  function setAlert(id, type, text, link) {
    var el = $(id); if (!el) return;
    el.className = 'alert ' + type + ' show';
    var msg = el.querySelector('.amsg');
    msg.textContent = text + (link ? ' ' : '');
    if (link) {
      var a = document.createElement('a');
      a.href = link.href; a.textContent = link.label;
      msg.appendChild(a);
    }
  }
  function clearAlert(id) { var el = $(id); if (el) el.className = 'alert'; }

  function setLoading(btn, on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function fieldError(name, msg) {
    var input = $(name), err = $(name + '-err');
    if (!input) return;
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      if (err) { err.textContent = msg; err.classList.add('show'); }
    } else {
      input.removeAttribute('aria-invalid');
      if (err) { err.textContent = ''; err.classList.remove('show'); }
    }
  }
  function clearFieldErrors(names) { names.forEach(function (n) { fieldError(n, ''); }); }
  function focusFirstInvalid(form) {
    var bad = form.querySelector('[aria-invalid="true"]'); if (bad) bad.focus();
  }
  function liveClear(names) {
    names.forEach(function (n) {
      var i = $(n); if (!i) return;
      i.addEventListener('input', function () { fieldError(n, ''); });
      i.addEventListener('change', function () { fieldError(n, ''); });
    });
  }

  function wireRoutes() {
    document.querySelectorAll('[data-route]').forEach(function (a) {
      var name = a.getAttribute('data-route');
      var href = route(name);
      if (name === 'login' && a.hasAttribute('data-keep-next')) {
        var n = safeNext(params().get('next'));
        if (n) href += '?next=' + encodeURIComponent(n);
      }
      a.setAttribute('href', href);
      if (name === 'terms' || name === 'privacy') { a.target = '_blank'; a.rel = 'noopener'; }
    });
  }

  function wirePasswordToggles() {
    document.querySelectorAll('.toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = $(btn.getAttribute('data-for'));
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.querySelector('.eye-on').hidden = show;
        btn.querySelector('.eye-off').hidden = !show;
      });
    });
  }

  /* ---------- validation ---------- */
  var V = {
    email: function (v) {
      v = (v || '').trim();
      if (!v) return 'Enter your email address.';
      if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address.';
      return '';
    },
    fullName: function (v) {
      v = (v || '').trim();
      if (v.length < 2) return 'Enter your full name.';
      if (v.length > 100 || !/\p{L}/u.test(v)) return 'Enter a valid name.';
      return '';
    },
    phone: function (v) {
      v = (v || '').replace(/[\s\-().]/g, '');
      if (!v) return 'Enter your phone number.';
      if (!/^\+?[0-9]{7,15}$/.test(v)) return 'Enter a valid phone number, for example +91 98765 43210.';
      return '';
    },
    org: function (v) {
      v = (v || '').trim();
      if (v.length < 2) return 'Enter your organization name.';
      if (v.length > 120) return 'Organization name is too long.';
      return '';
    },
    passwordRules: function (v) {
      v = v || '';
      return {
        len: v.length >= CONFIG.passwordMinLength,
        upper: /[A-Z]/.test(v),
        lower: /[a-z]/.test(v),
        digit: /[0-9]/.test(v)
      };
    },
    password: function (v) {
      if (!v) return 'Create a password.';
      var r = V.passwordRules(v);
      if (!(r.len && r.upper && r.lower && r.digit)) return 'Password does not meet all the requirements.';
      if (v.length > 128) return 'Password is too long (128 characters maximum).';
      return '';
    },
    confirm: function (pw, c) {
      if (!c) return 'Re-enter your password.';
      if (pw !== c) return 'Passwords do not match.';
      return '';
    }
  };

  function wireStrength(inputId) {
    var input = $(inputId), meter = $('meter'), rules = $('rules');
    if (!input || !meter) return;
    function update() {
      var v = input.value, r = V.passwordRules(v);
      if (rules) rules.querySelectorAll('li').forEach(function (li) {
        li.classList.toggle('ok', !!r[li.getAttribute('data-rule')]);
      });
      var score = 0;
      if (v) {
        score = (r.len ? 1 : 0) + (r.upper && r.lower ? 1 : 0) + (r.digit ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) || v.length >= 14 ? 1 : 0);
        if (!r.len && score > 1) score = 1;
      }
      meter.setAttribute('data-s', String(score));
    }
    input.addEventListener('input', update); update();
  }

  /* ---------- roles and redirects ---------- */
  function userFrom(data) { return data ? (data.user || data) : null; }

  // The role is whatever the SERVER says. Unknown role => no destination.
  function destinationFor(user, next) {
    var role = user && user.role;
    if (!role || !Object.prototype.hasOwnProperty.call(CONFIG.roleHome, role)) return null;
    var home = CONFIG.roleHome[role];
    var n = safeNext(next);
    // Only honour ?next= when it stays inside the area this role is sent to.
    if (n && (n === home || n.indexOf(home + '/') === 0 || n.indexOf(home + '?') === 0)) return n;
    return home;
  }

  async function logout() {
    await request(CONFIG.endpoints.logout, { method: 'POST' });
  }

  function redirectToLogin(reason) {
    var here = safeNext(location.pathname + location.search);
    var url = route('login') + '?reason=' + encodeURIComponent(reason || 'session_expired');
    if (here && location.pathname !== route('login')) url += '&next=' + encodeURIComponent(here);
    location.replace(url);
  }

  // For the rest of your app: fetch() that sends the session cookie and sends the
  // user to /login with a clear message when the session has expired.
  function appFetch(url, opts) {
    opts = Object.assign({ credentials: 'include' }, opts || {});
    return fetch(url, opts).then(function (res) {
      if (res.status === 401) redirectToLogin('session_expired');
      return res;
    });
  }

  async function sendToPortal(next, alertId) {
    var me = await request(CONFIG.endpoints.me);
    if (!me.ok) {
      setAlert(alertId, 'error', 'We signed you in but could not confirm your session. Please try again.');
      return false;
    }
    var dest = destinationFor(userFrom(me.data), next);
    if (!dest) {
      await logout(); // do not leave a session open that has nowhere to go
      setAlert(alertId, 'error', 'Your account is not assigned to a portal yet. Please contact your organization administrator.');
      return false;
    }
    location.replace(dest);
    return true;
  }

  function retryText(r) {
    var s = parseInt(r.retryAfter, 10);
    if (!isNaN(s) && s > 0) return s >= 90 ? ' Try again in ' + Math.ceil(s / 60) + ' minutes.' : ' Try again in ' + s + ' seconds.';
    return ' Please wait a few minutes and try again.';
  }
  function networkMsg() { return 'We could not reach FlowPeople. Check your internet connection and try again.'; }
  function serverMsg() { return 'Something went wrong on our side. Please try again in a moment.'; }

  /* ---------- LOGIN ---------- */
  function initLogin() {
    var q = params(), form = $('form'), btn = $('submit');
    var next = q.get('next');

    if (q.get('reason') === 'session_expired') setAlert('alert', 'warn', 'Your session has expired. Please sign in again to continue.');
    else if (q.get('reset') === '1') setAlert('alert', 'success', 'Your password was updated. Sign in with your new password.');
    else if (q.get('verified') === '1') setAlert('alert', 'success', 'Your email is verified. Sign in to get started.');
    else if (q.get('loggedout') === '1') setAlert('alert', 'info', 'You have been signed out.');

    // If a valid session already exists, go straight to the right portal.
    request(CONFIG.endpoints.me).then(function (me) {
      if (!me.ok) return;
      var dest = destinationFor(userFrom(me.data), next);
      if (dest) location.replace(dest);
    });

    liveClear(['email', 'password']);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      clearAlert('alert'); clearFieldErrors(['email', 'password']);
      var email = $('email').value.trim(), pw = $('password').value;
      var eErr = V.email(email), pErr = pw ? '' : 'Enter your password.';
      fieldError('email', eErr); fieldError('password', pErr);
      if (eErr || pErr) { focusFirstInvalid(form); return; }

      setLoading(btn, true);
      var r = await request(CONFIG.endpoints.login, {
        method: 'POST',
        body: { email: email.toLowerCase(), password: pw, rememberMe: $('remember').checked }
      });

      if (r.ok) {
        $('password').value = '';
        var done = await sendToPortal(next, 'alert');
        if (!done) setLoading(btn, false);
        return; // on success the page navigates away
      }
      setLoading(btn, false);
      var code = r.data && r.data.code;
      if (r.status === 0) setAlert('alert', 'error', networkMsg());
      else if (r.status === 401 || r.status === 400) {
        // Same message for unknown email and wrong password, so accounts cannot be probed.
        setAlert('alert', 'error', 'Incorrect email or password.');
        $('password').value = ''; $('password').focus();
      } else if (r.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email.toLowerCase());
        setAlert('alert', 'warn', 'Please verify your email before signing in.', { href: route('verify') + '?sent=1', label: 'Resend verification email' });
      } else if (r.status === 403) setAlert('alert', 'error', 'This account cannot sign in right now. Contact your administrator.');
      else if (r.status === 423) setAlert('alert', 'error', 'This account is temporarily locked after too many attempts.' + retryText(r));
      else if (r.status === 429) setAlert('alert', 'error', 'Too many sign-in attempts.' + retryText(r));
      else if (r.status === 422 && r.data && r.data.errors) {
        Object.keys(r.data.errors).forEach(function (k) { if ($(k)) fieldError(k, String(r.data.errors[k])); });
        focusFirstInvalid(form);
      } else setAlert('alert', 'error', serverMsg());
    });
  }

  /* ---------- SIGNUP ---------- */
  function initSignup() {
    var form = $('form'), btn = $('submit');
    var names = ['fullName', 'email', 'phone', 'organizationName', 'password', 'confirmPassword', 'terms'];
    wireStrength('password'); liveClear(names);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      clearAlert('alert'); clearFieldErrors(names);
      var d = {
        fullName: $('fullName').value.trim(), email: $('email').value.trim().toLowerCase(),
        phone: $('phone').value.replace(/[\s\-().]/g, ''), organizationName: $('organizationName').value.trim(),
        password: $('password').value, confirm: $('confirmPassword').value
      };
      var errs = {
        fullName: V.fullName(d.fullName), email: V.email(d.email), phone: V.phone(d.phone),
        organizationName: V.org(d.organizationName), password: V.password(d.password),
        confirmPassword: V.confirm(d.password, d.confirm),
        terms: $('terms').checked ? '' : 'You must accept the Terms and Privacy Policy to continue.'
      };
      var any = false;
      Object.keys(errs).forEach(function (k) { fieldError(k, errs[k]); if (errs[k]) any = true; });
      if (any) { focusFirstInvalid(form); return; }

      setLoading(btn, true);
      // Public signup sends identity and organization details only.
      // It never sends a role or permissions; the server decides those
      // (a new public account becomes the Organization Owner of its own new organization).
      var r = await request(CONFIG.endpoints.signup, {
        method: 'POST',
        body: { fullName: d.fullName, email: d.email, phone: d.phone, organizationName: d.organizationName, password: d.password, acceptedTerms: true }
      });
      if (r.ok) {
        setPendingEmail(d.email);
        $('password').value = ''; $('confirmPassword').value = '';
        location.assign(route('verify') + '?sent=1');
        return;
      }
      setLoading(btn, false);
      if (r.status === 0) setAlert('alert', 'error', networkMsg());
      else if (r.status === 409) {
        fieldError('email', 'An account with this email already exists.');
        setAlert('alert', 'warn', 'This email is already registered.', { href: route('login'), label: 'Sign in instead' });
        $('email').focus();
      } else if (r.status === 422 && r.data && r.data.errors) {
        Object.keys(r.data.errors).forEach(function (k) { if ($(k)) fieldError(k, String(r.data.errors[k])); });
        focusFirstInvalid(form);
      } else if (r.status === 429) setAlert('alert', 'error', 'Too many sign-up attempts.' + retryText(r));
      else setAlert('alert', 'error', serverMsg());
    });
  }

  /* ---------- FORGOT PASSWORD ---------- */
  function initForgot() {
    var form = $('form'), btn = $('submit');
    liveClear(['email']);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      clearAlert('alert'); fieldError('email', '');
      var email = $('email').value.trim(), err = V.email(email);
      fieldError('email', err); if (err) { $('email').focus(); return; }
      setLoading(btn, true);
      var r = await request(CONFIG.endpoints.forgot, { method: 'POST', body: { email: email.toLowerCase() } });
      setLoading(btn, false);
      if (r.ok) {
        // Same result whether or not the email exists, so accounts cannot be probed.
        $('sent-email').textContent = email;
        $('step-form').hidden = true; $('step-done').hidden = false;
      } else if (r.status === 0) setAlert('alert', 'error', networkMsg());
      else if (r.status === 429) setAlert('alert', 'error', 'Too many requests.' + retryText(r));
      else if (r.status === 422 && r.data && r.data.errors && r.data.errors.email) fieldError('email', String(r.data.errors.email));
      else setAlert('alert', 'error', serverMsg());
    });
  }

  /* ---------- RESET PASSWORD ---------- */
  function initReset() {
    var q = params(), token = q.get('token') || '';
    // Remove the token from the address bar and history as soon as we have it.
    if (token) history.replaceState(null, '', location.pathname);
    if (!token || token.length < 16 || token.length > 512) { $('step-form').hidden = true; $('step-bad').hidden = false; return; }

    var form = $('form'), btn = $('submit');
    wireStrength('password'); liveClear(['password', 'confirmPassword']);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      clearAlert('alert'); clearFieldErrors(['password', 'confirmPassword']);
      var pw = $('password').value, c = $('confirmPassword').value;
      var pe = V.password(pw), ce = V.confirm(pw, c);
      fieldError('password', pe); fieldError('confirmPassword', ce);
      if (pe || ce) { focusFirstInvalid(form); return; }
      setLoading(btn, true);
      var r = await request(CONFIG.endpoints.reset, { method: 'POST', body: { token: token, password: pw } });
      if (r.ok) { location.assign(route('login') + '?reset=1'); return; }
      setLoading(btn, false);
      if (r.status === 0) setAlert('alert', 'error', networkMsg());
      else if (r.status === 400 || r.status === 401 || r.status === 404 || r.status === 410) { $('step-form').hidden = true; $('step-bad').hidden = false; }
      else if (r.status === 422 && r.data && r.data.errors && r.data.errors.password) fieldError('password', String(r.data.errors.password));
      else if (r.status === 429) setAlert('alert', 'error', 'Too many attempts.' + retryText(r));
      else setAlert('alert', 'error', serverMsg());
    });
  }

  /* ---------- VERIFY EMAIL ---------- */
  function initVerify() {
    var q = params(), token = q.get('token') || '';
    if (token) history.replaceState(null, '', location.pathname);
    var steps = ['step-working', 'step-ok', 'step-fail', 'step-pending'];
    function show(id) {
      steps.forEach(function (s) { $(s).hidden = s !== id; });
      $('resend-block').hidden = !(id === 'step-pending' || id === 'step-fail');
    }

    var email = getPendingEmail();
    if (email) $('pending-email').textContent = email;
    else $('pending-line').textContent = 'Open the verification link we emailed you to activate your account. Need a new link? Request one below.';

    var resendBtn = $('resend'), timer = null;
    function cooldown(sec) {
      clearInterval(timer);
      resendBtn.disabled = true;
      var left = sec;
      $('resend-label').textContent = 'Resend in ' + left + 's';
      timer = setInterval(function () {
        left -= 1;
        if (left <= 0) { clearInterval(timer); resendBtn.disabled = false; $('resend-label').textContent = 'Resend verification email'; }
        else $('resend-label').textContent = 'Resend in ' + left + 's';
      }, 1000);
    }
    resendBtn.addEventListener('click', async function () {
      if (resendBtn.disabled) return;
      clearAlert('alert');
      var target = getPendingEmail();
      if (!target) { $('manual-email-wrap').hidden = false; $('manual-email').focus(); return; }
      await doResend(target);
    });
    $('manual-send').addEventListener('click', async function () {
      var v = $('manual-email').value.trim(), err = V.email(v);
      fieldError('manual-email', err); if (err) return;
      setPendingEmail(v.toLowerCase());
      await doResend(v.toLowerCase());
    });
    async function doResend(addr) {
      setLoading(resendBtn, true);
      var r = await request(CONFIG.endpoints.resend, { method: 'POST', body: { email: addr } });
      setLoading(resendBtn, false);
      if (r.ok) { setAlert('alert', 'success', 'If that account needs verification, a new email is on its way. Check your inbox and spam folder.'); cooldown(60); }
      else if (r.status === 0) setAlert('alert', 'error', networkMsg());
      else if (r.status === 429) { setAlert('alert', 'error', 'Please wait before requesting another email.' + retryText(r)); cooldown(60); }
      else setAlert('alert', 'error', serverMsg());
    }

    if (q.get('sent') === '1' && !token) cooldown(30);

    if (token) {
      show('step-working');
      request(CONFIG.endpoints.verify, { method: 'POST', body: { token: token } }).then(function (r) {
        if (r.ok) { show('step-ok'); setTimeout(function () { location.assign(route('login') + '?verified=1'); }, 2500); }
        else if (r.status === 0) { show('step-fail'); $('fail-text').textContent = networkMsg(); }
        else { show('step-fail'); $('fail-text').textContent = 'This verification link is invalid or has expired. Request a new one below.'; }
      });
    } else show('step-pending');
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    wireRoutes(); wirePasswordToggles();
    var page = document.body.getAttribute('data-page');
    var inits = { login: initLogin, signup: initSignup, forgot: initForgot, reset: initReset, verify: initVerify };
    if (inits[page]) inits[page]();
  });

  // Small public API for the rest of the app.
  window.FlowAuth = { fetch: appFetch, logout: logout, redirectToLogin: redirectToLogin, _safeNext: safeNext, _destinationFor: destinationFor };
})();
