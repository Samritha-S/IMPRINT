const db = require('./db');
const emissionsEngine = require('./emissionsEngine');
const ocrService = require('./ocrService');

// Suggestions Library
const SUGGESTIONS = [
  { action_id: 'meatless_monday', action_desc: 'Replace beef/chicken with vegetables on Mondays', category: 'food', savings_kg: 8.5 },
  { action_id: 'switch_to_metro', action_desc: 'Use public transport/metro for daily commute', category: 'transport', savings_kg: 4.2 },
  { action_id: 'ac_thermostat', action_desc: 'Increase your AC temperature to 24°C', category: 'energy', savings_kg: 2.1 },
  { action_id: 'unplug_standby', action_desc: 'Turn off power strips and electronics at night', category: 'energy', savings_kg: 0.8 },
  { action_id: 'ev_charge_offpeak', action_desc: 'Charge your electric two-wheeler during off-peak night hours', category: 'energy', savings_kg: 1.2 },
  { action_id: 'cook_covered', action_desc: 'Use covers on pots/pans to reduce PNG/LPG cooking times', category: 'energy', savings_kg: 0.5 }
];

const SUGGESTION_LOCALIZATIONS = {
  en: {
    meatless_monday: 'Replace beef/chicken with vegetables on Mondays',
    switch_to_metro: 'Use public transport/metro for daily commute',
    ac_thermostat: 'Increase your AC temperature to 24°C',
    unplug_standby: 'Turn off power strips and electronics at night',
    ev_charge_offpeak: 'Charge your electric two-wheeler during off-peak night hours',
    cook_covered: 'Use covers on pots/pans to reduce PNG/LPG cooking times'
  },
};

const PIP_MESSAGES = {
  en: {
    welcome: "Pip here! Welcome to Imprint. Log your daily actions or scan a receipt so I can help track your footprint!",
    spike: (msg) => `Oh no! I noticed a sudden spike in your footprint this week. ${msg} Let's try to scale back together.`,
    higher: (percent, level) => `Hi there. Your carbon footprint is running ${percent}% higher than the local average in your ${level}. We should look at some adjustments!`,
    high_avg: (avg) => `Phew! Your weekly emissions average is ${avg} kg CO₂, which is on the higher side. Let's see where we can trim it down.`,
    happy: (avg) => `Brilliant! Your average emissions are sitting nicely at ${avg} kg CO₂/day. You're doing a fantastic job conserving energy and resources. Keep it up!`,
    weekend_food: (msg) => `Hey! I noticed that ${msg} Perhaps we can plan low-impact meals for next weekend?`,
    stable: (avg) => `Pip here! Your carbon footprint is stable at ${avg} kg CO₂/day. Checking out your logs, we have some easy opportunities to do even better!`,
    spike_pattern: (pct) => `Your average footprint spiked by ${pct}% this week compared to last.`,
    weekend_food_pattern: (pct) => `Your food carbon footprint is ${pct}% higher on weekends.`
  },
};

// Define Agent Tools (functions callable by the agent or deterministic parser)
const tools = {
  /**
   * Retrieves summary carbon footprint data for a user over a specific period.
   * Calculates averages and category breakdown (food, transport, energy).
   * 
   * @param {number} userId - The user's database ID
   * @param {string} period - The time frame ('day', 'week', or 'month')
   * @returns {object} Summary object containing stats and logs array
   */
  getEmissionsSummary(userId, period = 'week') {
    // Pull logs in the period
    let days = 7;
    if (period === 'month') days = 30;
    if (period === 'day') days = 1;

    const logs = db.prepare(`
      SELECT * FROM daily_logs 
      WHERE user_id = ? 
      ORDER BY log_date DESC 
      LIMIT ?
    `).all(userId, days);

    if (logs.length === 0) return { count: 0, average: 0, total: 0, logs: [] };

    const totalFood = logs.reduce((sum, row) => sum + row.food_kg, 0);
    const totalTransport = logs.reduce((sum, row) => sum + row.transport_kg, 0);
    const totalEnergy = logs.reduce((sum, row) => sum + row.energy_kg, 0);
    const total = logs.reduce((sum, row) => sum + row.total_kg, 0);

    return {
      count: logs.length,
      average: Number((total / logs.length).toFixed(2)),
      total: Number(total.toFixed(2)),
      breakdown: {
        food: Number(totalFood.toFixed(2)),
        transport: Number(totalTransport.toFixed(2)),
        energy: Number(totalEnergy.toFixed(2))
      },
      logs
    };
  },

  /**
   * Compares the user's average carbon footprint against local peers at ward, city, or state level.
   * Fallback hierarchy is implemented if sample size is insufficient.
   * 
   * @param {number} userId - The user's database ID
   * @param {string} level - Location comparison level ('ward', 'city', or 'state')
   * @returns {object} Comparison results including average footprint, peer averages, and difference
   */
  compareToNeighbourhood(userId, level = 'ward') {
    const user = db.prepare('SELECT state, city, ward FROM users WHERE id = ?').get(userId);
    if (!user) return { message: 'User not found' };

    // Get user average
    const userStats = db.prepare('SELECT AVG(total_kg) as avg_co2 FROM daily_logs WHERE user_id = ?').get(userId);
    const userAvg = userStats ? (userStats.avg_co2 || 0) : 0;

    let query = '';
    let params = [];

    if (level === 'ward') {
      // Find ward average, fallback to city if < 3 users in ward
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE state = ? AND city = ? AND ward = ?').get(user.state, user.city, user.ward);
      if (countRow && countRow.cnt >= 3) {
        query = 'SELECT AVG(total_kg) as avg_co2, COUNT(DISTINCT user_id) as cnt FROM daily_logs JOIN users ON daily_logs.user_id = users.id WHERE state = ? AND city = ? AND ward = ?';
        params = [user.state, user.city, user.ward];
      } else {
        // Fallback to city
        level = 'city';
      }
    }

    if (level === 'city') {
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE state = ? AND city = ?').get(user.state, user.city);
      if (countRow && countRow.cnt >= 3) {
        query = 'SELECT AVG(total_kg) as avg_co2, COUNT(DISTINCT user_id) as cnt FROM daily_logs JOIN users ON daily_logs.user_id = users.id WHERE state = ? AND city = ?';
        params = [user.state, user.city];
      } else {
        // Fallback to state
        level = 'state';
      }
    }

    if (level === 'state') {
      query = 'SELECT AVG(total_kg) as avg_co2, COUNT(DISTINCT user_id) as cnt FROM daily_logs JOIN users ON daily_logs.user_id = users.id WHERE state = ?';
      params = [user.state];
    }

    const row = db.prepare(query).get(...params);
    const peerAvg = row ? (row.avg_co2 || 0) : 5.0;
    const diff = userAvg - peerAvg;
    const percent = peerAvg > 0 ? (diff / peerAvg) * 100 : 0;

    return {
      level,
      userAvg: Number(userAvg.toFixed(2)),
      peerAvg: Number(peerAvg.toFixed(2)),
      difference_kg: Number(diff.toFixed(2)),
      percentage: Number(percent.toFixed(1)),
      fallbackUsed: level !== 'ward',
      sampleSize: row ? row.cnt : 0
    };
  },

  /**
   * Analyzes historical daily logs of a user to identify behavioral patterns.
   * Detects sudden spikes in emissions, high commute emissions, or weekend food spikes.
   * 
   * @param {number} userId - The user's database ID
   * @returns {object} Patterns array with structural descriptions and percentage differences
   */
  detectPattern(userId) {
    const logs = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 30').all(userId);
    const patterns = [];

    if (logs.length < 5) return { patterns: [] };

    // 1. Check for weekend food spikes (Saturday & Sunday vs Weekdays)
    let weekendFoodSum = 0, weekendCount = 0;
    let weekdayFoodSum = 0, weekdayCount = 0;

    logs.forEach(log => {
      const day = new Date(log.log_date).getDay(); // 0 is Sunday, 6 is Saturday
      if (day === 0 || day === 6) {
        weekendFoodSum += log.food_kg;
        weekendCount++;
      } else {
        weekdayFoodSum += log.food_kg;
        weekdayCount++;
      }
    });

    const weekendAvg = weekendCount > 0 ? weekendFoodSum / weekendCount : 0;
    const weekdayAvg = weekdayCount > 0 ? weekdayFoodSum / weekdayCount : 0;

    if (weekendAvg > weekdayAvg * 1.3 && weekendAvg > 3.0) {
      patterns.push({
        type: 'weekend_food_spike',
        message: `Your food carbon footprint is ${Math.round((weekendAvg / weekdayAvg - 1) * 100)}% higher on weekends.`,
        data: { weekendAvg, weekdayAvg }
      });
    }

    // 2. Check for overall high transport emissions
    const totalTransport = logs.reduce((sum, log) => sum + log.transport_kg, 0);
    const totalEmissions = logs.reduce((sum, log) => sum + log.total_kg, 0);
    if (totalTransport > totalEmissions * 0.4 && totalTransport > 20) {
      patterns.push({
        type: 'high_commute',
        message: 'Transport accounts for a high proportion of your carbon footprint.',
        data: { transportPct: Math.round((totalTransport / totalEmissions) * 100) }
      });
    }

    // 3. Compare last week to prior week to detect a sudden spike
    const last7 = logs.slice(0, 7);
    const prior7 = logs.slice(7, 14);
    if (last7.length === 7 && prior7.length === 7) {
      const last7Avg = last7.reduce((sum, l) => sum + l.total_kg, 0) / 7;
      const prior7Avg = prior7.reduce((sum, l) => sum + l.total_kg, 0) / 7;
      if (last7Avg > prior7Avg * 1.25) {
        patterns.push({
          type: 'sudden_spike',
          message: `Your average footprint spiked by ${Math.round((last7Avg / prior7Avg - 1) * 100)}% this week compared to last.`,
          data: { last7Avg, prior7Avg }
        });
      }
    }

    return { patterns };
  },

  /**
   * Suggests a tailored carbon mitigation action based on user history and preferences.
   * Leverages localization templates to return recommendations in the user's preferred language.
   * 
   * @param {number} userId - The user's database ID
   * @param {object} context - Execution context containing primary spike details or category preferences
   * @returns {object} Action recommendation containing action_id, localized action_desc, and estimated savings
   */
  suggestAction(userId, context = {}) {
    const lang = 'en';

    // Fetch user feedback to avoid suggesting dismissed/already accepted actions
    const pastFeedback = db.prepare('SELECT action_id, accepted FROM agent_feedback WHERE user_id = ?').all(userId);
    const dismissed = pastFeedback.filter(f => f.accepted === 0).map(f => f.action_id);
    
    // Choose suggestions based on context patterns
    let candidates = SUGGESTIONS.filter(s => !dismissed.includes(s.action_id));
    if (candidates.length === 0) candidates = SUGGESTIONS; // fallback to complete list

    let selected = candidates[0];

    // Match based on category context
    if (context.primarySpike === 'food') {
      const foodOpts = candidates.filter(s => s.category === 'food');
      if (foodOpts.length > 0) selected = foodOpts[0];
    } else if (context.primarySpike === 'transport') {
      const transOpts = candidates.filter(s => s.category === 'transport');
      if (transOpts.length > 0) selected = transOpts[0];
    } else if (context.primarySpike === 'energy') {
      const energyOpts = candidates.filter(s => s.category === 'energy');
      if (energyOpts.length > 0) selected = energyOpts[0];
    }

    // Localize description
    const localizedDesc = SUGGESTION_LOCALIZATIONS[lang]?.[selected.action_id] || selected.action_desc;
    return {
      ...selected,
      action_desc: localizedDesc
    };
  },

  /**
   * Simulates a 10-year projection of carbon emissions based on hypothetical reduction scenarios.
   * Scenarios include electric vehicle adoption, vegetarian diet shift, and flight reduction.
   * 
   * @param {number} userId - The user's database ID
   * @param {object} scenario - User-controlled sliders representing target shifts (0 to 1)
   * @returns {object} Object containing a 10-year array of dataPoints with baseline vs optimized totals
   */
  runProjection(userId, scenario = {}) {
    // Simulate 10-year projection curves
    // scenario: { evAdoption: float (0 to 1), vegDietShift: float (0 to 1), flightReduction: float (0 to 1) }
    const ev = scenario.evAdoption || 0;
    const veg = scenario.vegDietShift || 0;
    const flights = scenario.flightReduction || 0;

    // Get current annual emission estimation
    const summary = tools.getEmissionsSummary(userId, 'month');
    let annualBase = (summary.average || 5.0) * 365;

    const dataPoints = [];
    for (let year = 0; year <= 10; year++) {
      // Baseline increases slowly due to national grid intensity adjustments
      const baseline = annualBase * (1 + year * 0.01);
      
      // Calculate mitigation
      // EV mitigates up to 35% of commute/transport emissions
      // Diet shift mitigates up to 40% of food emissions
      // Flight reduction mitigates general lifestyle emissions
      const foodMitigation = veg * 0.40 * (summary.breakdown?.food || 2.0) * 365;
      const transMitigation = ev * 0.50 * (summary.breakdown?.transport || 1.5) * 365;
      const energyMitigation = flights * 0.20 * (summary.breakdown?.energy || 1.5) * 365;

      const mitigation = (foodMitigation + transMitigation + energyMitigation) * (year / 10.0);
      const optimized = Math.max(200, baseline - mitigation);

      // Trees saved estimation
      const co2Saved = baseline - optimized;
      const treesSaved = Math.round(co2Saved / emissionsEngine.TREE_ABSORPTION_KG);

      dataPoints.push({
        year,
        baseline: Math.round(baseline),
        optimized: Math.round(optimized),
        treesSaved
      });
    }

    return { dataPoints };
  },

  /**
   * Records user feedback (accepted or dismissed) for a suggested action.
   * Persists the outcome to agent memory.
   * 
   * @param {number} userId - The user's database ID
   * @param {string} actionId - The ID of the action suggested
   * @param {boolean} accepted - True if user accepts the suggestion, false if dismissed
   * @returns {object} Status object indicating success
   */
  recordFeedback(userId, actionId, accepted) {
    db.prepare(`
      INSERT INTO agent_feedback (user_id, action_id, accepted)
      VALUES (?, ?, ?)
    `).run(userId, actionId, accepted ? 1 : 0);

    // Save/update memory of this feedback
    db.prepare(`
      INSERT INTO agent_memory (user_id, key_pattern, value, last_surfaced, status)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(user_id, key_pattern) DO UPDATE SET 
        value = excluded.value, 
        last_surfaced = excluded.last_surfaced,
        status = excluded.status
    `).run(
      userId,
      `action_feedback_${actionId}`,
      JSON.stringify({ accepted, timestamp: new Date().toISOString() }),
      accepted ? 'resolved' : 'dismissed'
    );

    return { success: true };
  }
};

// -------------------------------------------------------------
// Core Agent Reasoning Loop
// -------------------------------------------------------------

/**
 * Runs deterministic rule engine reasoning to generate Pip's feedback and suggestions.
 * Analyzes the user's weekly emissions, compares to local neighborhood baselines, and detects patterns.
 * 
 * @param {number} userId - The database ID of the user
 * @returns {object} Object containing the run_id, mood, localized message, and the suggested action
 */
function runDeterministicLoop(userId) {
  const trace = [];
  trace.push("Initializing Pip Mascot reasoning loop.");

  const localMsgs = PIP_MESSAGES.en;

  // Gather context
  const summary = tools.getEmissionsSummary(userId, 'week');
  trace.push(`Retrieved emissions summary. Avg: ${summary.average} kg/day.`);

  const compare = tools.compareToNeighbourhood(userId, 'ward');
  trace.push(`Compared to neighbourhood (${compare.level}). Diff: ${compare.difference_kg} kg.`);

  const patternData = tools.detectPattern(userId);
  trace.push(`Ran pattern detection. Found ${patternData.patterns.length} patterns.`);

  // Determine Pip's mood
  let mood = 'neutral';
  let message = '';
  let focusCategory = 'energy';

  const spike = patternData.patterns.find(p => p.type === 'sudden_spike');
  const weekendFood = patternData.patterns.find(p => p.type === 'weekend_food_spike');

  if (summary.count === 0) {
    mood = 'neutral';
    message = localMsgs.welcome;
  } else if (summary.average > 10 || compare.percentage > 20 || spike) {
    mood = 'concerned';
  } else if (summary.average < 4 || compare.percentage < -10) {
    mood = 'happy';
  }

  // Construct Pip's message
  if (mood === 'concerned') {
    if (spike) {
      const pct = Math.round((spike.data.last7Avg / spike.data.prior7Avg - 1) * 100);
      message = localMsgs.spike(localMsgs.spike_pattern(pct));
      focusCategory = 'energy';
    } else if (compare.percentage > 20) {
      message = localMsgs.higher(Math.round(compare.percentage), compare.level);
    } else {
      message = localMsgs.high_avg(summary.average);
    }
  } else if (mood === 'happy') {
    message = localMsgs.happy(summary.average);
  } else {
    // Neutral
    if (weekendFood) {
      const pct = Math.round((weekendFood.data.weekendAvg / weekendFood.data.weekdayAvg - 1) * 100);
      message = localMsgs.weekend_food(localMsgs.weekend_food_pattern(pct));
      focusCategory = 'food';
    } else {
      message = localMsgs.stable(summary.average || 5.0);
    }
  }

  // Get suggestion
  const action = tools.suggestAction(userId, { primarySpike: focusCategory });
  trace.push(`Selected suggested action: ${action.action_id}.`);

  // Write trace and output to database
  const runInfo = db.prepare(`
    INSERT INTO agent_runs (user_id, tools_called, reasoning_trace, mood, message, suggested_action)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    JSON.stringify(['getEmissionsSummary', 'compareToNeighbourhood', 'detectPattern', 'suggestAction']),
    trace.join('\n'),
    mood,
    message,
    JSON.stringify(action)
  );

  return {
    run_id: runInfo.lastInsertRowid,
    mood,
    message,
    suggested_action: action
  };
}

/**
 * Runs Claude API tool-calling agentic loop.
 * Passes the user's data context to an LLM via tool declarations,
 * executes requested tools locally, and prompts the LLM to formulate a localized response.
 * 
 * @param {number} userId - The database ID of the user
 * @param {string} apiKey - The Anthropic API key
 * @returns {Promise<object>} Object containing the mood, localized message, and suggested action
 */
async function runClaudeLoop(userId, apiKey) {
  // Let's implement real Anthropic API call with tool calling.
  // Standard format: System prompt describing Pip, and available tools.
  // We feed it to Claude, get tool calls back, execute them locally, return results to Claude, and get final response.
  try {
    const systemPrompt = `You are Pip, a cute, friendly, and helpful duckling mascot. Your mood is determined by emissions data.
IMPORTANT: You must write the "message" and "action_desc" strictly in English. Ensure Pip's tone is natural and conversational.
Your output must be a JSON object containing:
- "mood": "happy" | "neutral" | "concerned"
- "message": A personalized message from Pip explaining his reasoning in English
- "suggested_action": A JSON object containing { "action_id": string, "action_desc": string, "savings_kg": number }

You have access to the following tools:
1. getEmissionsSummary(userId, period)
2. compareToNeighbourhood(userId, level)
3. detectPattern(userId)
4. suggestAction(userId, context)

Always use these tools to inspect the user's data before making a recommendation.
Format your final response strictly as a JSON object, with no conversational prefix/suffix.`;

    const trace = ["Initializing Claude API Tool-calling loop."];

    // First request to Claude: ask it to decide which tools to call
    const payload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: "user", content: `Please review the carbon footprint data for user ID ${userId} and provide a personalized message and action.` }
      ],
      tools: [
        {
          name: "getEmissionsSummary",
          description: "Retrieve aggregated daily carbon emission summaries for a user.",
          input_schema: {
            type: "object",
            properties: {
              userId: { type: "integer", description: "The user's ID" },
              period: { type: "string", enum: ["day", "week", "month"], description: "Time period" }
            },
            required: ["userId"]
          }
        },
        {
          name: "compareToNeighbourhood",
          description: "Compare user emissions to ward/city/state aggregates.",
          input_schema: {
            type: "object",
            properties: {
              userId: { type: "integer" },
              level: { type: "string", enum: ["ward", "city", "state"] }
            },
            required: ["userId"]
          }
        },
        {
          name: "detectPattern",
          description: "Check for patterns, spikes, or weekend anomalies in emissions history.",
          input_schema: {
            type: "object",
            properties: { userId: { type: "integer" } },
            required: ["userId"]
          }
        },
        {
          name: "suggestAction",
          description: "Select custom carbon-saving recommendations based on user spikes.",
          input_schema: {
            type: "object",
            properties: {
              userId: { type: "integer" },
              context: { type: "object" }
            },
            required: ["userId"]
          }
        }
      ]
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const firstRes = await response.json();
    trace.push("Claude made tool request.");

    // Parse tool calls and run them
    const toolCalls = firstRes.content.filter(c => c.type === 'tool_use');
    const toolResults = [];

    for (const toolCall of toolCalls) {
      const { name, input, id } = toolCall;
      trace.push(`Tool Invoked: ${name}`);
      let resultData;
      if (name === 'getEmissionsSummary') {
        resultData = tools.getEmissionsSummary(input.userId || userId, input.period);
      } else if (name === 'compareToNeighbourhood') {
        resultData = tools.compareToNeighbourhood(input.userId || userId, input.level);
      } else if (name === 'detectPattern') {
        resultData = tools.detectPattern(input.userId || userId);
      } else if (name === 'suggestAction') {
        resultData = tools.suggestAction(input.userId || userId, input.context);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: id,
        content: JSON.stringify(resultData)
      });
    }

    // Call Claude back with tool results
    const followUpPayload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: "user", content: `Please review the carbon footprint data for user ID ${userId} and provide a personalized message and action.` },
        { role: "assistant", content: firstRes.content },
        { role: "user", content: toolResults }
      ]
    };

    const secondResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(followUpPayload)
    });

    if (!secondResponse.ok) {
      throw new Error(`Anthropic follow-up API error: ${secondResponse.statusText}`);
    }

    const finalRes = await secondResponse.json();
    const finalContentText = finalRes.content[0].text;
    trace.push("Claude produced final output.");

    // Parse output
    const jsonOutput = JSON.parse(finalContentText.replace(/```json/g, '').replace(/```/g, '').trim());

    // Record the run trace
    db.prepare(`
      INSERT INTO agent_runs (user_id, tools_called, reasoning_trace, mood, message, suggested_action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      JSON.stringify(toolCalls.map(tc => tc.name)),
      trace.join('\n'),
      jsonOutput.mood,
      jsonOutput.message,
      JSON.stringify(jsonOutput.suggested_action)
    );

    return {
      mood: jsonOutput.mood || 'neutral',
      message: jsonOutput.message || '',
      suggested_action: jsonOutput.suggested_action || null
    };

  } catch (err) {
    console.error("Claude API run failed, falling back to deterministic path:", err);
    return runDeterministicLoop(userId);
  }
}

/**
 * Executes a reasoning run for a user based on configuration.
 * Selects between the Claude API agentic loop (if an API key is present)
 * or falls back to the deterministic local engine.
 * 
 * @param {number} userId - The database ID of the user
 * @returns {Promise<object>} The results of the reasoning cycle
 */
async function runAgentCycle(userId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.trim().length > 0 && apiKey !== 'YOUR_ANTHROPIC_API_KEY') {
    return await runClaudeLoop(userId, apiKey);
  } else {
    return runDeterministicLoop(userId);
  }
}

module.exports = {
  tools,
  runAgentCycle,
  runDeterministicLoop,
  runClaudeLoop
};
