/*
 * FlowPeople auth configuration. This is the ONLY file you should need to edit
 * to connect these pages to your existing authentication backend.
 *
 * Nothing here is a credential. Sessions must be httpOnly, Secure, SameSite
 * cookies set by your server; these pages never read or store tokens.
 */
window.FLOWPEOPLE_AUTH_CONFIG = {
  // Base URL of your API. Leave '' if the API is on the same origin (recommended,
  // because cookies and CSRF protection are simplest that way).
  apiBase: '',

  // Endpoints. Change these to match your backend.
  endpoints: {
    me:     '/api/auth/me',                 // GET  -> { user: { role, permissions, ... } }, 401 if no session
    login:  '/api/auth/login',              // POST { email, password, rememberMe }
    logout: '/api/auth/logout',             // POST
    signup: '/api/auth/signup',             // POST { fullName, email, phone, organizationName, password, acceptedTerms }
    forgot: '/api/auth/forgot-password',    // POST { email }
    reset:  '/api/auth/reset-password',     // POST { token, password }
    verify: '/api/auth/verify-email',       // POST { token }
    resend: '/api/auth/resend-verification' // POST { email }
  },

  // Optional CSRF. If your backend issues a CSRF token, set the endpoint that
  // returns { csrfToken: '...' } and the header name it expects.
  csrf: { endpoint: null, header: 'X-CSRF-Token' },

  // Page routes used for links between the auth pages.
  routes: {
    login: '/login',
    signup: '/signup',
    forgot: '/forgot-password',
    reset: '/reset-password',
    verify: '/verify-email',
    terms: '/terms',
    privacy: '/privacy',
    home: '/'
  },

  // Where each role lands after login. The role comes from the SERVER's /me
  // response, never from the browser. Set these to your real portal routes.
  roleHome: {
    platform_owner:     '/superadmin',
    organization_owner: '/org/dashboard',
    hr_admin:           '/hr/dashboard',
    manager:            '/manager',
    employee:           '/employee'
  },

  // Password rules shown to the user. Your server must enforce the same rules.
  passwordMinLength: 10
};
