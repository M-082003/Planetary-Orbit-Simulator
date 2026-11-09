# Planetary Orbit Simulator

An interactive two-body orbit simulator built with HTML, CSS, and vanilla
JavaScript. It demonstrates Newtonian gravity, elliptical orbits, Kepler's laws,
and symplectic numerical integration in a responsive dark astronomy interface.

The orbital simulation and all physics run entirely in the browser and work
offline. An optional **AI Planetary Assistant** answers Turkish questions through
a local FastAPI backend and the EVREN LLM API. The browser never receives the
EVREN API key; it lives only in the backend's `.env` file.

---

## Quick start

The simulator uses native ES modules, so it must be served over HTTP (opening
`index.html` directly with `file://` will be blocked by browser module rules).

```bash
cd "Planetary -Orbit - Simulator"

# Serve the frontend on port 8000
python3 -m http.server 8000

# Or, if Node.js is installed:
npm run serve
```

Open <http://localhost:8000/>. The orbital simulation works with this server
alone.

To enable the AI assistant, also complete the backend setup below.

---

## AI Planetary Assistant (EVREN LLM)

The assistant adds a Turkish question-and-answer panel to the sidebar. It is
designed as a teaching aid for planetary motion, Newton's law of universal
gravitation, Kepler's laws, orbital eccentricity, and related physical
quantities.

### Architecture

```text
Browser (port 8000)
   │  POST /api/chat  { "message": "..." }
   ▼
FastAPI backend (port 8001)  ──  reads EVREN_LLM_API_KEY from .env
   │  EvrenLLMClient.chat("auto", ...)
   ▼
EVREN LLM gateway
```

- The browser never sees the API key.
- The backend validates the question and returns a clear Turkish error message.
- The default model is `auto`; override it with `EVREN_LLM_MODEL` if needed.
- No prompt, answer, or key is written to the logs.

### 1. Install the backend dependencies

Python 3.10 or newer is required by `evren-sdk`.

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

This installs FastAPI, Uvicorn, `evren-sdk`, and `python-dotenv`.

### 2. Create the `.env` file

```bash
cp .env.example .env
```

Edit `.env` and set your key:

```dotenv
EVREN_LLM_API_KEY=evren_llm_your_real_key_here
```

`.env` is already listed in `.gitignore`, so the key is not committed. Never put
the key in `index.html`, `js/`, `css/`, or any other frontend file.

Optional settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `EVREN_LLM_MODEL` | `auto` | EVREN model name |
| `EVREN_LLM_MAX_TOKENS` | `700` | Maximum answer length |
| `EVREN_LLM_BASE_URL` | `https://evren-llmapi.ssyz.org.tr` | Gateway URL (normally unchanged) |
| `ALLOWED_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000` | Comma-separated CORS origins |

### 3. Accept the EVREN LLM terms (one time)

EVREN requires every account to accept the current LLM terms (`v1`) before the
first completion request. A valid key still returns HTTP 403 with
`terms_not_accepted` until this is done. Read the terms, then accept them:

```bash
python -m backend.evren_terms            # print the full terms
python -m backend.evren_terms --accept   # record your acceptance
```

The helper uses the same gateway and Bearer authentication as the SDK, because
`evren-sdk` does not expose the terms endpoints. It never prints the API key.
Acceptance is stored by EVREN, so it only needs to be repeated if EVREN
publishes a new material version.

### 4. Run the backend

From the project root, with the virtual environment active:

```bash
uvicorn backend.app:app --reload --port 8001

# Or, if Node.js is installed:
npm run serve:api
```

Keep the static frontend server running on port 8000 as well, then open
<http://localhost:8000/>.

### 5. Use the assistant

1. Type a Turkish question in **AI Gezegen Asistanı**.
2. Press **Gönder** or `Ctrl/Cmd + Enter`.
3. A spinner appears while the answer is prepared; the Turkish answer then
   appears below the form.
4. Backend problems are shown in the same area as readable Turkish messages.

### API reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Readiness check; reports the model and whether a key is configured |
| `POST` | `/api/chat` | Accepts `{ "message": "..." }` and returns `{ "answer": "...", "model": "auto" }` |

Example:

```bash
curl -s http://127.0.0.1:8001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Kepler ikinci yasası neyi söyler?"}'
```

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `AI asistanı yapılandırılmamış` | Add `EVREN_LLM_API_KEY` to `.env` and restart Uvicorn |
| `Asistan sunucusuna ulaşılamadı` | Start the backend on port 8001 |
| `EVREN LLM kullanım şartları henüz kabul edilmemiş` | Run `python -m backend.evren_terms --accept`, then restart the backend |
| `EVREN API anahtarı doğrulanamadı` | Check that the key is valid, starts with `evren_llm_`, and has no extra spaces |
| `EVREN kredi bakiyesi yetersiz` | Check the remaining credits/quota in your EVREN account |
| `EVREN istek sınırına ulaşıldı` | Wait for the retry period or check your EVREN quota |
| CORS error in the browser | Add the frontend origin to `ALLOWED_ORIGINS` and restart the backend |

---

## Instructor requirement checklist

The 10 requirements below use the instructor's exact wording. Every item is
implemented and was exercised in the running application.

| # | Requirement | Status | Exact source file(s) | How it is implemented |
| --- | --- | --- | --- | --- |
| 1 | Draw the Sun and a planet in a 2D coordinate system | Implemented | `js/renderer.js` (`_drawSun`, `_drawPlanet`, `_toScreen`, `_computeCamera`); `index.html` canvas | The canvas renderer maps SI positions to a 2D screen with a uniform scale. The Sun is drawn at the focus `(0, 0)`; the planet is drawn from the live `(x, y)` state. |
| 2 | Simulate an elliptical planetary orbit | Implemented | `js/physics/integrator.js`, `js/physics/orbit.js`, `js/simulation.js`, `js/renderer.js` (`_drawOrbit`) | Newtonian gravity advances the planet with Velocity Verlet. `ellipsePath()` supplies the ellipse geometry, and `_drawOrbit()` renders it with the Sun at one focus. |
| 3 | Allow the user to change orbital eccentricity using a slider | Implemented | `index.html` (`#eccentricity`); `js/ui.js`; `js/simulation.js` (`setEccentricity`); `js/physics/constants.js` | The range slider spans `0.00–0.90` in `0.01` steps with default `0.50`. Its `input` handler calls `setEccentricity()`, which restarts at perihelion while keeping `a = 1 AU`. |
| 4 | Show instantaneous velocity and acceleration vectors | Implemented | `js/renderer.js` (`_drawVectors`); `js/config.js`; `index.html` (`#show-vectors`) | Two arrows originate at the planet: velocity from `(vx, vy)` and acceleration from `(ax, ay)`, both live from the simulation snapshot. Arrow lengths are display-scaled and capped; true magnitudes appear in the data panel. |
| 5 | Mark perihelion and aphelion | Implemented | `js/renderer.js` (`_drawApsides`, `_drawMajorAxis`); `js/physics/orbit.js` (`periapsis`, `apoapsis`) | Markers are placed at `r_p = a(1−e)` on the `+x` axis and `r_a = a(1+e)` on the `−x` axis, each labelled with its distance. At `e = 0` the interface correctly states that the apsides are undefined. |
| 6 | Display orbital period and semi-major axis | Implemented | `index.html` (header `#header-period`; Orbital Data `#data-a`, `#data-period`); `js/ui.js` | The header shows the period. The Orbital Data panel shows semi-major axis in AU and metres and period in days and years. Both are updated from the simulation snapshot. |
| 7 | Visualize Kepler's Second Law with equal areas swept during equal time intervals | Implemented | `js/sweeps.js`; `js/renderer.js` (`_drawWedges`); `js/physics/orbit.js` (Kepler solver) | One period is divided into 16 equal time intervals. Each wedge boundary comes from the exact Keplerian solution at `t_k = kT/16`, and the filled wedge follows the true elliptical arc. The current wedge is highlighted as the planet moves. |
| 8 | Include play/pause and simulation speed controls | Implemented | `index.html` (`#play-pause`, `#speed`); `js/ui.js`; `js/simulation.js` (`toggle`, `setSpeed`) | The Play/Pause button and `Space` key toggle time advancement. A logarithmic slider sets `0.1–365` simulated days per real second, with `30 d/s` as the default. |
| 9 | Use Newton's law of universal gravitation to calculate acceleration | Implemented | `js/physics/integrator.js` (`accelerationAt`, `velocityVerletStep`); `js/physics/constants.js` (`G`, `M_SUN`, `MU`) | `accelerationAt()` evaluates `a = −G M☉ r / r³ = −μ r / r³` at the current position; Velocity Verlet uses that acceleration for every step. It was checked against an independent evaluation at five positions. |
| 10 | Display the mathematical equations used in the simulation | Implemented | `index.html` (Physics & Equations panel, lines 192–282) | The panel shows 15 equations: gravitation, acceleration, ellipse equation, apsides, eccentricity, vis-viva, perihelion speed, specific energy, Kepler's third law, angular momentum, Kepler's second law, equal-area relation, and both Velocity Verlet updates. |

**Result: 10 of 10 implemented; none missing and none partially implemented.**

### Supporting delivery requirements

| Requirement | Implementation |
| --- | --- |
| Sun as the central mass | `M_SUN = 1.98847e30 kg`, `MU = G · M_SUN` in `js/physics/constants.js` |
| Semi-major axis fixed at 1 AU | `A_FIXED` in `js/physics/constants.js`; no control changes it |
| SI units internally | State, forces, and diagnostics use metres, seconds, and kilograms |
| Initial conditions at perihelion | `initialState()` sets `r = a(1−e)` with tangential velocity |
| Initial speed from vis-viva | `perihelionSpeed()` uses `v = √(μ(2/r − 1/a))` |
| Period from Kepler's third law | `orbitalPeriod()` uses `T = 2π√(a³/μ)` |
| Responsive dark astronomy theme | `css/styles.css` |
| Offline core simulation | Physics and simulation assets are local; the optional AI assistant uses a local backend |

---

## Physics model

The Sun is fixed at the origin. The planet moves in the `xy` plane with
perihelion on the `+x` axis and counter-clockwise motion. The planet's mass is
neglected, so this is the ideal Kepler two-body problem with a fixed central
mass.

### Constants

| Symbol | Value | Meaning |
| --- | --- | --- |
| `G` | `6.67430e-11 m³ kg⁻¹ s⁻²` | Newtonian gravitational constant |
| `M☉` | `1.98847e30 kg` | Solar mass |
| `μ` | `G · M☉ ≈ 1.32712e20 m³ s⁻²` | Solar gravitational parameter |
| `a` | `1 AU = 1.495978707e11 m` | Fixed semi-major axis |
| `e` | `0.50` default | Eccentricity |
| `T` | `≈ 365.25 d` | Orbital period from Kepler's third law |
| `Δt` | `T / 32768 ≈ 963 s` | Fixed integration step |

### Gravity and acceleration

Newton's universal law of gravitation is

```text
F = G M☉ m / r²
```

Per unit mass, the planet's acceleration is

```text
a = −G M☉ r / r³ = −μ r / r³
```

The acceleration always points toward the Sun. The code evaluates this once per
step, at the new position.

### Orbit geometry

```text
r(ν) = a(1 − e²) / (1 + e cos ν)
r_p  = a(1 − e)
r_a  = a(1 + e)
e    = (r_a − r_p) / (r_a + r_p)
b    = a √(1 − e²)
```

The Sun sits at one focus of the ellipse, not at its geometric centre. The
camera centres on the ellipse so the whole orbit stays visible at high
eccentricity, which makes the focus offset obvious.

### Launch conditions and energy

At perihelion the velocity is purely tangential. The vis-viva equation gives

```text
v = √( μ(2/r − 1/a) )
v_p = √( μ(1 + e) / (a(1 − e)) )
```

The specific orbital energy and angular momentum are

```text
ε = v²/2 − μ/r = −μ/(2a)
h = |r × v| = √( μ a(1 − e²) )
```

Both are constants of the ideal orbit and are monitored in the interface.

### Kepler's laws

```text
T² = 4π² a³ / μ          (third law)
dA/dt = h/2 = constant    (second law)
A(Δt) = h Δt / 2
```

One period is divided into 16 equal time intervals. Each wedge is filled along
the true elliptical arc, so the coloured regions are the actual swept areas.
They are equal even though the perihelion wedge is much wider in angle than the
aphelion wedge.

### Velocity Verlet

For each fixed step:

```text
a_n     = −μ r_n / |r_n|³
r_n+1   = r_n + v_n Δt + ½ a_n Δt²
a_n+1   = −μ r_n+1 / |r_n+1|³
v_n+1   = v_n + ½(a_n + a_n+1) Δt
```

Velocity Verlet is second-order, symplectic, and time-reversible. For a bound
orbit its energy error stays bounded and oscillatory instead of growing
linearly, and for a central force angular momentum is conserved to round-off.
The previous acceleration is cached in the state so each step needs only one new
acceleration evaluation.

The simulation clock uses `requestAnimationFrame` plus a fixed-step accumulator,
so the orbit is independent of display frame rate. Large frame gaps are clamped,
and the number of steps per frame is capped so a slow browser slows the
simulation instead of freezing.

---

## Interface

### Controls

- **Pause / Play** — start or stop the simulation (the `Space` key also works
  when focus is not in a form control).
- **Reset** — return the planet to perihelion at `t = 0`.
- **Eccentricity** — 0.00 to 0.90 step 0.01. Changing it restarts at perihelion
  while keeping `a = 1 AU`, so the period stays fixed.
- **Simulation speed** — 0.1 to 365 simulated days per real second on a
  logarithmic slider. The default is 30 d/s, about 12 s per orbit.
- **Velocity & acceleration vectors** — show or hide the arrows.
- **Equal-time swept areas** — show or hide the Kepler's second law wedges.

At `e = 0` the orbit is circular; the interface labels perihelion and aphelion
as undefined and hides their markers.

### Orbital Data panel

Shows semi-major axis (AU and metres), eccentricity, orbital period, apsides,
current distance, speed, acceleration, true anomaly, areal velocity, area per
`T/16`, specific energy, and angular momentum. The collapsible **Numerical
health** section reports relative energy and angular-momentum error, the time
step, and steps per orbit.

### Physics & Equations panel

Contains the gravitational law, acceleration, orbit equation, apsides,
eccentricity, vis-viva, perihelion speed, specific energy, Kepler's third law,
angular momentum, Kepler's second law, equal-area relation, and both
Velocity Verlet update equations.

---

## Project structure

```text
.
├── index.html                  Application shell and all visible equations
├── css/
│   └── styles.css              Dark theme, panels, responsive breakpoints
├── js/
│   ├── main.js                 Bootstrap and animation loop
│   ├── simulation.js           State ownership, fixed-step clock, snapshots
│   ├── renderer.js             Canvas orbit, bodies, vectors, apsides, wedges
│   ├── ui.js                   DOM controls and readouts
│   ├── assistant.js            AI assistant form, fetch, loading and errors
│   ├── format.js               SI-to-display conversions and number formatting
│   ├── config.js               Display colours and vector scaling
│   ├── sweeps.js               Equal-time swept-area geometry
│   └── physics/
│       ├── constants.js        Physical constants and fixed configuration
│       ├── orbit.js            Ellipse geometry, vis-viva, Kepler solver
│       ├── integrator.js       Newtonian acceleration and Velocity Verlet
│       └── diagnostics.js      Energy, angular momentum, areal velocity
├── backend/
│   ├── __init__.py             Backend package marker
│   ├── app.py                  FastAPI chat endpoint and EVREN client
│   └── evren_terms.py          Read/accept the EVREN LLM terms (one time)
├── tests/
│   ├── orbit.test.mjs          Node tests: geometry and analytic solution
│   ├── integrator.test.mjs     Node tests: acceleration and Verlet stability
│   ├── kepler.test.mjs         Node tests: equal areas and measured period
│   ├── simulation.test.mjs     Node tests: clock, controls, state resets
│   ├── browser-tests.html      Browser test runner page
│   └── browser-suite.js        14 browser-run scientific checks
├── .env.example                Template for EVREN_LLM_API_KEY
├── .gitignore                  Ignores .env, .venv, caches, node_modules
├── requirements.txt            FastAPI, Uvicorn, evren-sdk, python-dotenv
├── package.json
└── README.md
```

---

## Testing

### Browser test suite

Open <http://localhost:8000/tests/browser-tests.html> after starting the local
server. It runs 14 checks covering:

- the period at 1 AU,
- apsides and perihelion speed,
- energy and angular-momentum conservation of the analytic orbit,
- the Kepler equation solver at `e = 0.9`,
- the magnitude and direction of Newtonian acceleration,
- circular and high-eccentricity Velocity Verlet stability,
- second-order convergence,
- equal theoretical and drawn wedge areas,
- wedge-index wrapping,
- fixed `a` and `T` when eccentricity changes,
- frame-rate independence of the fixed-step clock,
- the default perihelion initial condition.

The page reports `14/14 tests passed` and sets `document.body.dataset.status`
to `pass` or `fail`. The same result is available as
`window.__TEST_RESULTS__`.

### Node test suite

If Node.js 18 or newer is installed:

```bash
npm test
```

This runs the four `node:test` files in `tests/`. The browser suite exists
because this project was also validated in an environment without Node; the Node
tests are retained for reproducibility.

### Backend smoke test

With the backend running on port 8001:

```bash
curl -s http://127.0.0.1:8001/api/health
```

Without a configured key, `configured` is `false` and `/api/chat` returns HTTP
503 with a Turkish setup message. With a valid key in `.env`, ask a question:

```bash
curl -s http://127.0.0.1:8001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Yörünge dışmerkezliği nedir?"}'
```

The response is JSON: `{"answer": "...", "model": "auto"}`.

### Verified in this environment

- Browser suite: **14/14 passed**, no console errors, after the assistant panel
  was added.
- The assistant panel renders, accepts Turkish text, shows the loading spinner,
  and reports a readable Turkish error when the backend has no API key.
- The orbit simulation's physics, calculations, and controls are unchanged.
- Backend import, `/api/health`, the missing-key `/api/chat` path, and the
  missing-terms `403` mapping were exercised locally.
- A live EVREN request succeeded with the `auto` model after the account
  accepted the LLM terms (`v1`): the gateway listed 15 models and returned a
  Turkish Kepler answer. The response carried an EVREN request ID.
- The temporary invalid-key `502` and unaccepted-terms `403` states produced
  readable Turkish messages; no key, prompt, or answer was logged.
- No horizontal overflow at viewport widths **1400, 1000, 900, 680, and 400 px**.
- Two-column layout above 980 px, single-column below 980 px, two-column panel
  grid from 700–980 px, and single-column buttons below 420 px.
- Sun, planet, orbit, wedges, velocity arrow, acceleration arrow, apsides, and
  labels all render on the canvas.
- Pause/play, reset, `Space` toggle, eccentricity at 0.00 and 0.90, speed
  extremes, and both display toggles work.
- The orbit app requests only local files. If the assistant is used, the browser
  additionally calls the local backend on `127.0.0.1:8001`; only the backend
  contacts the EVREN gateway.

---

## Assumptions and limitations

- Ideal two-body Kepler problem with the Sun fixed at a focus.
- Planet mass is neglected; general relativity, perturbations, and radiation
  pressure are not modelled.
- Motion is confined to a 2D plane.
- Body sizes are exaggerated so they remain visible; orbital distances are to
  scale.
- The displayed period is about 365.25 days rather than exactly 365.256 days
  because `G` and `M☉` are rounded CODATA/IAU values. The simulation and the
  interface use the same constants, so they remain internally consistent.
- Vector arrow lengths are display-scaled and capped for readability. The true
  magnitudes are always shown numerically in the Orbital Data panel. The
  acceleration arrow is also capped to stay short of the Sun.
- AI assistant answers are generated by an external language model and may
  contain mistakes. They are educational guidance, not a substitute for the
  simulator's numeric results or the displayed equations.

---

## Privacy and offline use

The orbital simulation is fully offline. It has no analytics, no remote fonts, no
CDN, and no hardcoded credential. Without the AI panel, the page requests only
its own local HTML, CSS, JavaScript, and test files.

The optional AI assistant adds one controlled network path:

1. The browser sends the question to the local FastAPI backend at
   `127.0.0.1:8001`.
2. The backend sends the question and system instruction to the EVREN LLM
   gateway using `EvrenLLMClient`.
3. The answer returns to the browser as JSON.

`EVREN_LLM_API_KEY` is read only by the backend from `.env`. It is never included
in frontend files, API responses, or logs. The backend logs only error categories,
never the key, the question, or the answer. The frontend's CORS allow-list is
limited to the local app origins by default. EVREN processes the submitted
question according to its own service terms.

---

## Final compliance audit

This section records the final requirement-by-requirement verification. A
requirement is marked **verified** only where the implementation was inspected
and its behaviour was measured in the running application.

### Detailed model verification

| # | Requirement | Status | Implementation | How it was verified | Remaining limitation |
| --- | --- | --- | --- | --- | --- |
| 1 | Semi-major axis fixed at 1 AU | Verified | `A_FIXED = AU` in `js/physics/constants.js`; no UI control modifies it | Runtime check: `A_FIXED === AU === 1.495978707e11 m`; changing eccentricity leaves `a` and `T` unchanged | None for the ideal model |
| 2 | Default eccentricity 0.50, range 0.00–0.90 | Verified | `E_DEFAULT`, `E_MIN`, `E_MAX` in `constants.js`; slider in `index.html` | Read `E_DEFAULT = 0.5`, `E_MIN = 0`, `E_MAX = 0.9`; slider reports `min=0`, `max=0.9`, `step=0.01`, default value `0.5`; boundary values exercised | None |
| 3 | Sun as the central mass | Verified | `M_SUN` and `MU = G · M_SUN` in `constants.js`; Sun fixed at the focus | `MU === G × M_SUN`; orbit geometry places the Sun at one focus | Planet mass neglected; no barycentric wobble |
| 4 | SI units internally | Verified | `js/physics/constants.js`, `js/physics/integrator.js`, `js/simulation.js`, `js/physics/diagnostics.js` | Snapshot state is in metres and m/s; energy in J/kg; angular momentum in m²/s; Python recomputation of every constant matched | AU, days, and km/s appear only at the display boundary |
| 5 | Newtonian acceleration | Verified | `accelerationAt()` in `js/physics/integrator.js` | Compared with the independently evaluated `−μr/r³` at five positions: component error `0`, magnitude error ≤ `1.31e−16`, inward dot product `−1` | Point-mass, non-relativistic gravity only |
| 6 | Velocity Verlet integration | Verified | `velocityVerletStep()` in `js/physics/integrator.js`; fixed-step clock in `simulation.js` | One step matched an independently coded update exactly (position, velocity, acceleration relative error `0`); convergence ratio `4.000007` (second order); 20-orbit energy error `9.99e−8` | Symplectic, but still a finite-step approximation of the true orbit |
| 7 | Perihelion start with vis-viva speed | Verified | `initialState()` and `perihelionSpeed()` in `js/physics/orbit.js` | Default state: `r = 0.500 AU`, purely tangential `v = 51.589 km/s`; matches `√(μ(1+e)/(a(1−e)))` | Circular case (`e = 0`) has no unique perihelion |
| 8 | Period from Kepler's third law | Verified | `orbitalPeriod()` in `js/physics/orbit.js` | `T = 2π√(a³/μ) = 365.2513758445 d`; fixed `Δt = T/32768 = 963.065151 s`; period unchanged when `e` changes | Not exactly 365.256 d because `G` and `M☉` are rounded |
| 9 | Kepler's Second Law visualization | Verified | `js/sweeps.js`, drawn in `js/renderer.js` | 16 equal-time wedges; theoretical area spread `0`; drawn polygon area spread `1.66e−5` (`e = 0.5`) and `8.86e−5` (`e = 0.9`); total wedge area equals ellipse area to `~1e−16`; angular width ratio `2.75` at `e = 0.5` and `6.01` at `e = 0.9`; wedge index returns `0, 8, 0, 4` at `t = 0, T/2, T, 1.25T` | Polygon approximation of the true arc, so drawn areas differ by a tiny amount |
| 10 | Play/pause and speed controls | Verified | `js/simulation.js` and `js/ui.js` | Play/pause button and `Space` toggle verified; speed slider spans `0.1–365 d/s` with default `30 d/s`; fixed-step accumulator made frame-rate independent in tests | Step count per frame is capped, so a very slow frame slows simulated time |

### Presentation and delivery requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| 2D scene with Sun, planet, orbit, vectors, apsides | Verified | All elements render on the canvas; enabling wedges/vectors changed `650,738` pixels; apsides and labels present |
| Orbital data and displayed equations | Verified | Orbital Data panel reports `a`, `e`, `T`, apsides, `r`, `v`, acceleration, true anomaly, areal velocity, wedge area, energy, and `h`; 15 equations extracted from the interface match the implemented formulas |
| Comments explaining physics and integration | Verified | `integrator.js`, `sweeps.js`, `constants.js`, `orbit.js`, and `simulation.js` document the equations, SI units, symplectic properties, fixed-step clock, and swept-area method |
| Dark, responsive interface | Verified | Dark theme in `css/styles.css`; no horizontal overflow at 1400, 1000, 900, 680, and 400 px |
| Offline simulation; optional AI via local backend | Verified | Physics assets and tests are local; the AI panel calls only `127.0.0.1:8001`; the key stays in the backend `.env` |
| Local server with native ES modules | Verified | `python3 -m http.server 8000`; app and test page both return HTTP 200 |

### Independently recomputed SI values

| Quantity | Value |
| --- | --- |
| `μ = G · M☉` | `1.3271645321e20 m³ s⁻²` |
| Period `T` | `31557718.872966 s = 365.251375845 d` |
| Fixed step `Δt` | `963.065151 s` |
| Perihelion `r_p` | `0.500 AU` |
| Aphelion `r_a` | `1.500 AU` |
| Perihelion speed `v_p` | `51.589380 km/s` |
| Acceleration at perihelion | `2.3721051373e−2 m/s²` |
| Specific energy `ε` | `−4.435773470e8 J/kg` |
| Angular momentum `h` | `3.858830666e15 m²/s` |
| Areal velocity `h/2` | `1.929415333e15 m²/s = 0.007448840 AU²/d` |
| Area per `T/16` wedge | `0.170043690 AU²` |
| Ellipse area | `2.720699046 AU²` |

`16 × wedge area` equals the ellipse area to the displayed precision.

### Numerical verification summary

- Acceleration matches `−μr/r³` at all five test positions, with magnitude error
  at or below `1.31e−16` and direction exactly inward.
- A single Velocity Verlet step reproduces the written update formula exactly.
- Halving `Δt` reduces position error by `4.000007`, confirming second order.
- Over 20 orbits at `e = 0.5`: maximum relative energy error `9.99e−8`, maximum
  relative angular-momentum error `4.12e−14`; all states finite.
- Over 5 orbits at `e = 0.9`: maximum relative energy error `9.17e−5`, maximum
  relative angular-momentum error `2.52e−14`; all states finite.
- One-orbit closure: position relative error `1.65e−6`, energy relative error
  `5.37e−15`.
- Kepler's second law: equal time intervals, equal theoretical areas, drawn
  areas equal to within `1.66e−5` (`e = 0.5`) and `8.86e−5` (`e = 0.9`), with a
  large angular-width ratio at high eccentricity.
- Browser regression suite: **14/14 passed**, no console errors, after the final
  documentation and fallback-value corrections.

### Audit limitations

- The Node test suite could not be executed in this environment because Node.js
  is not installed; the browser suite was run instead.
- Rendering was verified by canvas pixel analysis and manual interface testing,
  not by visual screenshot review.
- The model is the ideal two-body problem: no planet mass, 2D only, no general
  relativity, perturbations, or radiation pressure, and exaggerated body sizes.
- Vector arrow lengths are display-scaled and capped; the numeric panel always
  reports the true magnitudes.
