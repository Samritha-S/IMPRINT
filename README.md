# Imprint - Carbon Footprint Tracker with Agentic AI

Imprint — a carbon footprint tracker for India. Pip the duckling reads your bills, tracks your habits, and nudges real change. 🦆🌱


Imprint is a full-stack sustainability and carbon footprint awareness platform built for the consumer vertical. It allows users to track their everyday carbon output through automated bill/receipt scanning, manual logs, and localized community comparisons. An interactive agent companion, **Pip**, provides reasoning, patterns analysis, and direct ecological feedback.

---

## 1. Chosen Vertical: Consumer Sustainability & Action

Imprint is a consumer-focused sustainability platform designed to democratize carbon footprint tracking. Carbon calculations are traditionally complex and hidden. Imprint changes this by:
* **Interactive Gamification**: Leveraging local, localized, and national leaderboards (down to the local "Ward" level) to encourage healthy, low-emission competition.
* **Low Friction OCR Inputs**: Enabling users to scan utility bills and grocery receipts to immediately populate daily metrics.
* **Agentic Support**: Providing a friendly, proactive mascot ("Pip") that guides users away from high emissions using actionable daily advice.

---

## 2. Approach and Logic: Agentic AI Architecture

Imprint's core intelligence lies in its dual-path agent loop managed by the **Pip** mascot persona. The agent acts on the following tool-based reasoning loop to evaluate daily footprints and generate interactive notifications:

### Dual Reasoning Paths:
1. **Claude LLM Tool-Calling (Online Path)**: If an `ANTHROPIC_API_KEY` is provided in the `.env` file, the backend dynamically queries Claude using a structured tool-calling definition. Claude analyzes user details, patterns, and coordinates and then makes decision calls to emit dynamic feedback.
2. **Deterministic Engine (Offline Fallback Path)**: If no API key is present, the app falls back onto a localized rule-based engine (`agentService.js`) matching user averages, recent daily changes, and location metrics to output deterministic Pip messages and actions.

### Available Agent Tools:
* `getEmissionsSummary`: Fetches aggregated and category-specific (food, transportation, utilities) stats for a user.
* `compareToNeighbourhood`: Queries local averages to establish relative standings (e.g. "Your footprint is 25% higher than the local average in Indiranagar").
* `detectPattern`: Reviews historical daily logs to find trends (e.g. sudden weekend spikes, consecutive high-emission days).
* `suggestAction`: Generates high-impact actionable tasks (e.g. adjusting thermostat temperature or swapping car commutes for bicycling) with quantified $CO_2$ savings.
* `runProjection`: Models the long-term impact of proposed actions.
* `parseScan`: Integrates text extractions from bill and receipt images.
* `recordFeedback`: Tracks whether users dismiss or accept recommendations, allowing the system to refine future prompts.

---

## 3. How the Solution Works

The user journey in Imprint consists of:
1. **Onboarding**: Users complete a lightweight setup including name, diet preferences (vegan, vegetarian, omnivore, carnivore), commute modes (foot, EV, public transit, petrol car), and a cascading location selector (State → City → Ward/Locality).
2. **Dashboard**: Features "This Week at a Glance", the **Habits History** stacked area chart modeling daily $CO_2$ output over the last 30 days (separated into transport, food, electricity, and gas/fuel), and the localized "Neighbourhood Pulse" leaderboard.
3. **Scanner Hub**: Allows users to upload bills (electricity, LPG, CNG, petrol/diesel) or grocery receipts. OCR (powered client/server side by Tesseract.js) extracts figures, computes emission values using unified coefficients, and appends them to today's log.
4. **10-Yr Curve (Projection Engine)**: Projecting user footprints out for a decade under "Business-As-Usual" vs. "Target Mitigation" paths.
5. **Imprint Feed**: A centralized card stack where Pip presents insights. Users can **Accept** (reducing baseline future projections) or **Dismiss** cards.
6. **Profile Editing**: A fully editable user profile accessible from the tab or sidebar. Updating diet, commute, or location updates baseline formulations and dynamically recalculates community averages without wiping historical log data.

---

## 4. Assumptions & Coefficients

### Data Coefficients & Citations:
* **Food**: Calculated per kilogram based on FAO & Open Food Facts data. Beef ($27.0\text{ kg }CO_2/\text{kg}$), chicken ($6.9\text{ kg }CO_2/\text{kg}$), vegetables ($0.8\text{ kg }CO_2/\text{kg}$).
* **Electricity**: Based on the Indian grid average ($0.82\text{ kg }CO_2/\text{kWh}$) to reflect the regional context.
* **Transport**: Coefficients adapted from IPCC and UK DEFRA standards: Petrol Car ($0.22\text{ kg }CO_2/\text{km}$), EV ($0.05\text{ kg }CO_2/\text{km}$), Public Metro/Bus ($0.08\text{ kg }CO_2/\text{km}$).

### Tech Stack Choices:
* **SQLite Database**: Used for the prototype to allow zero-configuration setup and portable sqlite testing out of the box, rather than requiring local Postgres instances.
* **Tesseract.js OCR**: Enables client-side processing of receipt images and text extraction without heavy server dependencies.
* **Cascading Locations**: Seeded with real locations and wards covering major Indian metros (Mumbai, Bengaluru, Pune, Delhi, Chennai, Hyderabad, etc.).

---

## 5. Setup and Run Instructions

Make sure Node.js is installed on your machine.

1. **Install all dependencies** (root, client, and server packages):
   ```bash
   npm run install-all
   ```
2. **Seed the database** (creates a fresh SQLite database and populates 90 days of tracking data for 200 mock users to populate the leaderboards):
   ```bash
   npm run seed
   ```
3. **Start the applications concurrently** (compiles the Vite production client and starts the Express backend on port 5000 and Vite preview on port 3000):
   ```bash
   npm start
   ```
4. **Open your browser** to **`http://localhost:3000`** and log in with:
   * **Username**: `pip`
   * **Password**: `password123`
