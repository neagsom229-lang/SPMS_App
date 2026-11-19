// backend/scripts/e2e-ports.js
//
// Single source of truth for the Playwright server ports. playwright.config.js,
// e2e-servers.js, e2e-setup.js and the specs all read this file, so a custom
// E2E_BACKEND_PORT/E2E_FRONTEND_PORT cannot drift between the built bundle,
// the CORS allow-list and the API URLs the tests call.
//
// The backend default is 5055, not 5050: pgAdmin 4 (installed with the native
// PostgreSQL Windows package) listens on 127.0.0.1:5050 by default and answers
// /health with its own HTML 401 page, which makes the e2e backend unusable.
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 5055);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4173);

const API_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const API_URL = `${API_ORIGIN}/api`;
const WEB = `http://127.0.0.1:${FRONTEND_PORT}`;

module.exports = { BACKEND_PORT, FRONTEND_PORT, API_ORIGIN, API_URL, WEB };
