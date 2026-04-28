/**
 * Asymmetry Pipeline HTTP API for Google Apps Script Web Apps.
 *
 * External flow:
 * Hermes/OpenClaw -> HTTP POST -> doPost(e) -> runAsymmetryPipeline(inputs) -> JSON
 *
 * Deploy as a Web App with access set to Anyone or Anyone with the link, depending
 * on your private URL/security model.
 */

var SECTION_ALIASES = {
  "pain": "pain",
  "pains": "pain",
  "problems": "pain",
  "challenges": "pain",
  "inefficiency": "inefficiency",
  "inefficiencies": "inefficiency",
  "waste": "inefficiency",
  "constraints": "constraint",
  "constraint": "constraint",
  "limitations": "constraint",
  "unmet demand": "unmet_demand",
  "demand": "unmet_demand",
  "customer demand": "unmet_demand",
  "market demand": "unmet_demand"
};

var CATEGORY_KEYWORDS = {
  "pain": [
    "pain", "problem", "challenge", "friction", "issue", "bottleneck",
    "delay", "slow", "churn", "complaint", "error", "failure", "burden",
    "costly", "expensive", "manual", "rework", "backlog"
  ],
  "inefficiency": [
    "inefficiency", "inefficient", "waste", "duplicate", "duplicative",
    "fragmented", "silo", "silos", "spreadsheet", "manual", "re-enter",
    "reenter", "rework", "redundant", "handoff", "underutilized",
    "idle", "low utilization"
  ],
  "constraint": [
    "constraint", "limited", "limit", "shortage", "compliance",
    "regulatory", "regulation", "budget", "capacity", "legacy",
    "dependency", "procurement", "approval", "approvals", "labor",
    "capital", "vendor"
  ],
  "unmet_demand": [
    "unmet", "demand", "want", "wants", "need", "needs", "requested",
    "waitlist", "backlog", "underserved", "gap", "lack", "shortage",
    "willing to pay", "faster", "real-time", "automation"
  ]
};

var ALL_KEYWORDS = buildAllKeywords_();

var STOPWORDS = toSet_([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "have", "in", "into", "is", "it", "its", "of", "on", "or", "that",
  "the", "their", "to", "with", "when", "while", "across", "causing",
  "make", "makes", "using", "use", "uses", "teams", "staff", "customers",
  "customer", "want", "wants", "need", "needs"
]);

var PATTERN_RULES = [
  {
    key: "manual_workflow_rework",
    pattern: "Manual workflow and rework burden",
    tokens: [
      "manual", "spreadsheet", "spreadsheets", "rework", "re-enter",
      "reenter", "handoff", "calls", "approval", "approvals"
    ],
    opportunity: "Workflow Automation Layer",
    description: "Automate recurring manual work and exception routing for {industries}."
  },
  {
    key: "fragmented_systems_data",
    pattern: "Fragmented systems and data silos",
    tokens: [
      "fragmented", "silo", "silos", "disconnected", "portal", "portals",
      "systems", "integration", "data"
    ],
    opportunity: "Cross-System Data Unification Layer",
    description: "Unify fragmented operational data and expose a single action layer for {industries}."
  },
  {
    key: "capacity_shortage",
    pattern: "Demand exceeds operational capacity",
    tokens: [
      "shortage", "capacity", "backlog", "waitlist", "delayed", "delays",
      "bottleneck", "limited", "underutilized"
    ],
    opportunity: "Capacity Orchestration Marketplace",
    description: "Match constrained supply, overloaded work queues, and unmet demand across {industries}."
  },
  {
    key: "compliance_drag",
    pattern: "Compliance and regulatory drag",
    tokens: [
      "compliance", "regulatory", "regulation", "audit", "reviews",
      "review", "approval", "approvals"
    ],
    opportunity: "Compliance Evidence Automation",
    description: "Automate evidence collection, review workflows, and audit-ready records for {industries}."
  },
  {
    key: "cost_margin_pressure",
    pattern: "Cost pressure and margin leakage",
    tokens: ["cost", "costly", "expensive", "margin", "pricing", "waste", "leakage", "budget"],
    opportunity: "Margin Leakage Intelligence",
    description: "Detect avoidable cost, wasted effort, and margin leakage in recurring operations for {industries}."
  },
  {
    key: "labor_constraint",
    pattern: "Labor capacity constraints",
    tokens: ["labor", "staffing", "hiring", "driver", "drivers", "shortage", "operator", "operators"],
    opportunity: "Labor Leverage Operating System",
    description: "Increase throughput per operator by automating repetitive coordination work for {industries}."
  },
  {
    key: "legacy_tooling",
    pattern: "Legacy tooling constraints",
    tokens: ["legacy", "old", "outdated", "procurement", "vendor", "dependency", "tooling"],
    opportunity: "Legacy Modernization Adapter",
    description: "Wrap legacy systems with a modern workflow and data-access layer for {industries}."
  },
  {
    key: "quality_reliability",
    pattern: "Quality and reliability breakdowns",
    tokens: ["error", "errors", "failure", "failures", "quality", "complaint", "complaints", "reliability"],
    opportunity: "Quality Assurance Copilot",
    description: "Prevent recurring errors and quality breakdowns with guided checks for {industries}."
  },
  {
    key: "customer_experience_friction",
    pattern: "Customer experience friction",
    tokens: ["churn", "complaint", "complaints", "scheduling", "appointment", "appointments", "delay", "delays", "faster"],
    opportunity: "Customer Friction Triage System",
    description: "Triage the recurring service failures that create delays, churn, and unmet demand in {industries}."
  }
];

var INTENSITY_MARKERS = [
  "acute", "backlog", "critical", "expensive", "high", "major", "severe",
  "shortage", "urgent", "waitlist", "willing to pay"
];

/**
 * HTTP POST entrypoint for Apps Script Web App calls.
 *
 * Expected body:
 * {
 *   "action": "run_asymmetry_pipeline",
 *   "inputs": [{"industry": "Healthcare", "content": "..."}]
 * }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== "string" || !e.postData.contents.trim()) {
      throw new Error("Missing JSON request body");
    }

    var request = JSON.parse(e.postData.contents);
    var action = request.action;

    if (action === "run_asymmetry_pipeline") {
      var inputs = extractInputs_(request);
      var output = runAsymmetryPipeline(inputs);
      return jsonResponse_({
        success: true,
        data: output
      });
    }

    throw new Error("Unsupported action: " + String(action || ""));
  } catch (err) {
    return jsonResponse_({
      success: false,
      error: errorMessage_(err)
    });
  }
}

/**
 * Optional health/schema endpoint. It has no UI dependency.
 */
function doGet(e) {
  return jsonResponse_({
    success: true,
    data: {
      service: "asymmetry_pipeline",
      actions: ["run_asymmetry_pipeline"],
      request_shape: {
        action: "run_asymmetry_pipeline",
        inputs: [
          {
            industry: "string",
            content: "raw GPT output text"
          }
        ]
      }
    }
  });
}

/**
 * Core callable pipeline.
 *
 * The returned output is deterministic and depends only on industry_outputs.
 * Persistence is a non-blocking side effect for time-series intelligence.
 */
function runAsymmetryPipeline(industry_outputs) {
  var validatedInputs = validateIndustryOutputs_(industry_outputs);
  var signals = extractSignals_(validatedInputs);

  try {
    storeSignals(signals);
  } catch (err) {
    console.log("Signal persistence skipped: " + errorMessage_(err));
  }

  var patterns = clusterPatterns_(signals);
  var opportunities = synthesizeOpportunities_(patterns, signals);
  var rankedOpportunities = rankOpportunities_(opportunities);
  var topFeasibilityMemos = buildMemos_(rankedOpportunities.slice(0, 3), opportunities);

  return {
    signals: signals,
    patterns: patterns,
    opportunities: opportunities,
    ranked_opportunities: rankedOpportunities,
    top_feasibility_memos: topFeasibilityMemos
  };
}

/**
 * Optional persistence layer. Set Script Property ASYMMETRY_STORE_SIGNALS=false
 * to disable. Set ASYMMETRY_SPREADSHEET_ID to persist in a standalone script;
 * otherwise a container-bound script will use its active spreadsheet.
 */
function storeSignals(signals) {
  if (!signals || !signals.length) {
    return {
      stored: 0
    };
  }

  var props = PropertiesService.getScriptProperties();
  var enabledValue = String(props.getProperty("ASYMMETRY_STORE_SIGNALS") || "true").toLowerCase();
  if (enabledValue === "false") {
    return {
      stored: 0,
      skipped: true,
      reason: "ASYMMETRY_STORE_SIGNALS=false"
    };
  }

  var spreadsheet = getAsymmetrySpreadsheet_(props);
  if (!spreadsheet) {
    return {
      stored: 0,
      skipped: true,
      reason: "No spreadsheet available"
    };
  }

  var sheet = spreadsheet.getSheetByName("Signals") || spreadsheet.insertSheet("Signals");
  ensureSignalsHeader_(sheet);

  var timestamp = new Date().toISOString();
  var runId = Utilities.getUuid();
  var rows = signals.map(function(signal) {
    return [
      timestamp,
      runId,
      signal.signal_id,
      signal.industry,
      signal.signal,
      signal.evidence,
      signal.strength_score
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return {
    stored: rows.length,
    run_id: runId
  };
}

function validateIndustryOutputs_(industryOutputs) {
  if (!Array.isArray(industryOutputs)) {
    throw new Error("inputs must be an array of {industry, content} objects");
  }

  return industryOutputs.map(function(item, index) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("inputs[" + index + "] must be an object");
    }
    if (typeof item.industry !== "string" || !item.industry.trim()) {
      throw new Error("inputs[" + index + "].industry must be a non-empty string");
    }
    if (typeof item.content !== "string") {
      throw new Error("inputs[" + index + "].content must be a string");
    }
    return {
      industry: item.industry.trim(),
      content: item.content
    };
  });
}

function extractSignals_(industryOutputs) {
  var signals = [];
  var seen = {};
  var nextId = 1;

  industryOutputs.forEach(function(item) {
    var candidates = candidateUnits_(item.content);
    candidates.forEach(function(candidate) {
      var categories = matchedCategories_(candidate.evidence, candidate.section);
      if (!categories.length) {
        return;
      }

      var signalText = normalizeSignal_(candidate.evidence);
      if (!signalText) {
        return;
      }

      var dedupeKey = item.industry.toLowerCase() + "|" + dedupeText_(signalText);
      if (seen[dedupeKey]) {
        return;
      }
      seen[dedupeKey] = true;

      signals.push({
        signal_id: "sig_" + padNumber_(nextId, 3),
        signal: signalText,
        industry: item.industry,
        evidence: candidate.evidence,
        strength_score: strengthScore_(candidate.evidence, categories, candidate.section)
      });
      nextId += 1;
    });
  });

  return signals;
}

function candidateUnits_(content) {
  var currentSection = null;
  var candidates = [];
  var lines = String(content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  lines.forEach(function(rawLine) {
    var cleanedLine = stripBullet_(rawLine);
    if (!cleanedLine) {
      return;
    }

    var heading = sectionHeading_(cleanedLine);
    if (heading) {
      currentSection = heading;
      splitSentences_(headingRemainder_(cleanedLine)).forEach(function(sentence) {
        candidates.push({
          evidence: sentence,
          section: currentSection
        });
      });
      return;
    }

    splitSentences_(cleanedLine).forEach(function(sentence) {
      if (isSectionHeadingOnly_(sentence)) {
        var nestedHeading = sectionHeading_(sentence);
        if (nestedHeading) {
          currentSection = nestedHeading;
        }
        return;
      }
      candidates.push({
        evidence: sentence,
        section: currentSection
      });
    });
  });

  return candidates;
}

function clusterPatterns_(signals) {
  var grouped = {};
  var labels = {};

  signals.forEach(function(signal) {
    var patternInfo = patternForSignal_(signal);
    if (!grouped[patternInfo.key]) {
      grouped[patternInfo.key] = [];
    }
    grouped[patternInfo.key].push(signal);
    labels[patternInfo.key] = patternInfo.label;
  });

  var unsortedPatterns = Object.keys(grouped).map(function(key) {
    var groupedSignals = grouped[key];
    var industries = uniqueSorted_(groupedSignals.map(function(signal) {
      return String(signal.industry);
    }));
    var frequency = groupedSignals.length;
    var spread = industries.length;

    return {
      _key: key,
      pattern: labels[key],
      industries: industries,
      frequency: frequency,
      cross_industry_spread: spread,
      confidence: confidence_(groupedSignals, frequency, spread),
      supporting_signals: groupedSignals.map(function(signal) {
        return String(signal.signal_id);
      })
    };
  });

  unsortedPatterns.sort(function(a, b) {
    return compareMany_([
      b.frequency - a.frequency,
      b.cross_industry_spread - a.cross_industry_spread,
      b.confidence - a.confidence,
      compareStrings_(a.pattern, b.pattern)
    ]);
  });

  return unsortedPatterns.map(function(item, index) {
    return {
      pattern_id: "pat_" + padNumber_(index + 1, 3),
      pattern: item.pattern,
      industries: item.industries,
      frequency: item.frequency,
      cross_industry_spread: item.cross_industry_spread,
      confidence: item.confidence,
      supporting_signals: item.supporting_signals
    };
  });
}

function synthesizeOpportunities_(patterns, signals) {
  var signalsById = {};
  signals.forEach(function(signal) {
    signalsById[String(signal.signal_id)] = signal;
  });

  var opportunities = patterns.map(function(pattern) {
    var rule = ruleForPattern_(pattern.pattern);
    var industries = pattern.industries.slice();
    var industryText = formatIndustries_(industries);
    var name = rule ? rule.opportunity : fallbackOpportunityName_(pattern.pattern);
    var descriptionTemplate = rule ? rule.description : "Create a focused product wedge around {pattern} for {industries}.";
    var description = descriptionTemplate
      .replace("{pattern}", String(pattern.pattern).toLowerCase())
      .replace("{industries}", industryText);

    var supporting = pattern.supporting_signals
      .map(function(signalId) {
        return signalsById[signalId];
      })
      .filter(Boolean);

    var scores = scoreOpportunity_(pattern, supporting);
    var opportunityIndex = scores.demand * scores.asymmetry * scores.arbitrage * scores.optionality * scores.timing;

    return {
      name: name,
      description: description,
      underlying_pattern: pattern.pattern,
      industries_affected: industries,
      supporting_signals: pattern.supporting_signals.slice(),
      scores: scores,
      opportunity_index: opportunityIndex
    };
  });

  opportunities.sort(function(a, b) {
    return compareMany_([
      b.opportunity_index - a.opportunity_index,
      compareStrings_(a.name, b.name)
    ]);
  });

  return opportunities.map(function(opportunity, index) {
    return {
      opportunity_id: "opp_" + padNumber_(index + 1, 3),
      name: opportunity.name,
      description: opportunity.description,
      underlying_pattern: opportunity.underlying_pattern,
      industries_affected: opportunity.industries_affected,
      supporting_signals: opportunity.supporting_signals,
      scores: opportunity.scores,
      opportunity_index: opportunity.opportunity_index
    };
  });
}

function rankOpportunities_(opportunities) {
  return opportunities.map(function(opportunity, index) {
    return {
      rank: index + 1,
      opportunity_id: String(opportunity.opportunity_id),
      name: String(opportunity.name),
      opportunity_index: Number(opportunity.opportunity_index)
    };
  });
}

function buildMemos_(topRanked, opportunities) {
  var byId = {};
  opportunities.forEach(function(opportunity) {
    byId[String(opportunity.opportunity_id)] = opportunity;
  });

  return topRanked.map(function(ranked) {
    var opportunity = byId[String(ranked.opportunity_id)];
    var industries = opportunity.industries_affected.slice();
    var industryText = formatIndustries_(industries);
    var pattern = String(opportunity.underlying_pattern).toLowerCase();

    return {
      opportunity_id: opportunity.opportunity_id,
      opportunity_name: opportunity.name,
      build_approach: [
        "Start with a narrow workflow wedge for " + industryText + ".",
        "Anchor the product on the '" + pattern + "' pattern and only automate steps supported by input evidence.",
        "Ship intake, routing, exception handling, and reporting before expanding into adjacent workflows."
      ],
      defensibility: [
        "Workflow data captured from repeated resolutions.",
        "Integration depth with the operating systems and portals present in the buyer workflow.",
        "Cross-industry benchmarks from " + industries.length + " affected industry label(s)."
      ],
      risks: [
        "Evidence may reflect analyst output rather than measured buyer behavior.",
        "Incumbent systems may copy the narrow workflow once demand is proven.",
        "Integration and data-quality variance may slow deployment across affected industries."
      ],
      execution_steps: [
        "Select the highest-frequency workflow from the supporting signals.",
        "Interview operators in the affected industries.",
        "Map the current inputs, approvals, handoffs, and exceptions.",
        "Build a minimal intake, routing, and resolution prototype.",
        "Measure cycle-time reduction against the manual baseline."
      ],
      evidence_basis: opportunity.supporting_signals.slice()
    };
  });
}

function extractInputs_(request) {
  if (Array.isArray(request.inputs)) {
    return request.inputs;
  }
  if (Array.isArray(request.industry_outputs)) {
    return request.industry_outputs;
  }
  if (request.input && Array.isArray(request.input.industry_outputs)) {
    return request.input.industry_outputs;
  }
  throw new Error("Request must include inputs: [{industry, content}]");
}

function matchedCategories_(evidence, section) {
  var lowered = String(evidence || "").toLowerCase();
  var categories = {};
  if (section) {
    categories[section] = true;
  }

  Object.keys(CATEGORY_KEYWORDS).forEach(function(category) {
    var keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some(function(keyword) {
      return keywordPresent_(lowered, keyword);
    })) {
      categories[category] = true;
    }
  });

  return Object.keys(categories).sort();
}

function patternForSignal_(signal) {
  var combined = String((signal.signal || "") + " " + (signal.evidence || "")).toLowerCase();
  var tokenSet = toSet_(tokens_(combined));
  var bestRule = null;
  var bestScore = 0;

  PATTERN_RULES.forEach(function(rule) {
    var score = rule.tokens.reduce(function(count, token) {
      return count + (combined.indexOf(token) !== -1 || tokenSet[token] ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestRule = rule;
      bestScore = score;
    }
  });

  if (bestRule && bestScore > 0) {
    return {
      key: bestRule.key,
      label: bestRule.pattern
    };
  }

  var topTokens = topTokens_(combined, 4);
  if (!topTokens.length) {
    return {
      key: "uncategorized_signal",
      label: "Uncategorized input-backed signal"
    };
  }

  return {
    key: "input_terms_" + topTokens.slice(0, 3).join("_"),
    label: "Input-backed pattern: " + topTokens.slice(0, 3).join(" / ")
  };
}

function confidence_(groupedSignals, frequency, spread) {
  var totalStrength = groupedSignals.reduce(function(total, signal) {
    return total + Number(signal.strength_score || 0);
  }, 0);
  var avgStrength = totalStrength / Math.max(1, frequency);
  var value = 0.35 + Math.min(5, frequency) * 0.07 + Math.min(4, spread) * 0.08 + (avgStrength / 10.0) * 0.22;
  return Math.round(Math.min(0.99, value) * 100) / 100;
}

function scoreOpportunity_(pattern, supporting) {
  var combined = supporting.map(function(signal) {
    return String((signal.signal || "") + " " + (signal.evidence || ""));
  }).join(" ").toLowerCase();
  var tokenSet = toSet_(tokens_(combined));
  var frequency = Number(pattern.frequency || 0);
  var spread = Number(pattern.cross_industry_spread || 0);
  var avgStrength = supporting.reduce(function(total, signal) {
    return total + Number(signal.strength_score || 0);
  }, 0) / Math.max(1, supporting.length);

  var demand = 3 + avgStrength * 0.35 + Math.min(3, frequency) + Math.min(2, spread - 1);
  demand += anyBonus_(tokenSet, combined, ["demand", "unmet", "waitlist", "backlog", "shortage", "wants", "needs", "faster"], 1);

  var asymmetry = 4 + Math.min(2, spread - 1);
  asymmetry += anyBonus_(tokenSet, combined, ["manual", "spreadsheet", "fragmented", "legacy", "compliance", "disconnected"], 1);
  asymmetry += frequency >= 3 ? 1 : 0;

  var arbitrage = 3 + anyBonus_(tokenSet, combined, ["manual", "spreadsheet", "waste", "duplicate", "rework", "costly", "fragmented"], 2);
  arbitrage += Math.min(2, spread);

  var optionality = 4 + Math.min(3, spread) + Math.min(2, Math.max(0, frequency - 1));
  optionality += anyBonus_(tokenSet, combined, ["data", "systems", "automation", "platform", "portals"], 1);

  var timing = 4 + anyBonus_(tokenSet, combined, ["urgent", "shortage", "backlog", "compliance", "real-time", "delayed", "delays", "faster"], 2);
  timing += avgStrength >= 7 ? 1 : 0;
  timing += spread >= 2 ? 1 : 0;

  return {
    demand: clampScore_(roundHalfToEven_(demand)),
    asymmetry: clampScore_(roundHalfToEven_(asymmetry)),
    arbitrage: clampScore_(roundHalfToEven_(arbitrage)),
    optionality: clampScore_(roundHalfToEven_(optionality)),
    timing: clampScore_(roundHalfToEven_(timing))
  };
}

function stripBullet_(text) {
  return String(text || "")
    .trim()
    .replace(/^[-*+>]\s+/, "")
    .replace(/^\(?\d+[\).:-]\s+/, "")
    .replace(/^[A-Za-z][\).:-]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionHeading_(text) {
  var lowered = String(text || "").trim().toLowerCase().replace(/:+$/, "");
  if (Object.prototype.hasOwnProperty.call(SECTION_ALIASES, lowered)) {
    return SECTION_ALIASES[lowered];
  }

  var match = String(text || "").match(/^([A-Za-z ]{3,30})\s*:\s*(.+)$/);
  if (match) {
    var label = match[1].trim().toLowerCase();
    return SECTION_ALIASES[label] || null;
  }
  return null;
}

function headingRemainder_(text) {
  var match = String(text || "").match(/^[A-Za-z ]{3,30}\s*:\s*(.+)$/);
  return match ? match[1].trim() : "";
}

function isSectionHeadingOnly_(text) {
  var lowered = String(text || "").trim().toLowerCase().replace(/:+$/, "");
  return Object.prototype.hasOwnProperty.call(SECTION_ALIASES, lowered);
}

function splitSentences_(text) {
  var cleaned = String(text || "").trim();
  if (!cleaned) {
    return [];
  }

  var pieces = cleaned.match(/[^.!?]+[.!?]?/g) || [];
  return pieces.map(function(piece) {
    return piece.trim();
  }).filter(function(piece) {
    return wordCount_(piece) >= 3;
  });
}

function keywordPresent_(lowered, keyword) {
  if (keyword.indexOf(" ") !== -1 || keyword.indexOf("-") !== -1) {
    return lowered.indexOf(keyword) !== -1;
  }
  return new RegExp("\\b" + escapeRegex_(keyword) + "\\b").test(lowered);
}

function normalizeSignal_(evidence) {
  var text = String(evidence || "")
    .replace(/^[A-Za-z ]{3,30}\s*:\s*/, "")
    .replace(/^[ .;:\-]+|[ .;:\-]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return truncateWords_(text, 180);
}

function dedupeText_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strengthScore_(evidence, categories, section) {
  var lowered = String(evidence || "").toLowerCase();
  var keywordHits = ALL_KEYWORDS.reduce(function(total, keyword) {
    return total + (keywordPresent_(lowered, keyword) ? 1 : 0);
  }, 0);
  var markerHits = INTENSITY_MARKERS.reduce(function(total, marker) {
    return total + (lowered.indexOf(marker) !== -1 ? 1 : 0);
  }, 0);
  var numericHit = /(\$|\d|%)/.test(evidence) ? 1 : 0;
  var sectionHit = section ? 1 : 0;
  var categoryBonus = Math.min(2, Math.max(0, categories.length - 1));
  var score = 3 + Math.min(3, keywordHits) + Math.min(2, markerHits) + numericHit + sectionHit + categoryBonus;
  return Math.max(1, Math.min(10, score));
}

function ruleForPattern_(pattern) {
  for (var i = 0; i < PATTERN_RULES.length; i += 1) {
    if (PATTERN_RULES[i].pattern === pattern) {
      return PATTERN_RULES[i];
    }
  }
  return null;
}

function fallbackOpportunityName_(pattern) {
  var cleaned = String(pattern || "").replace(/^Input-backed pattern:\s*/, "").trim();
  var words = cleaned.split(/[^A-Za-z0-9]+/).filter(Boolean).map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  if (!words.length) {
    return "Input-Backed Opportunity";
  }
  return words.slice(0, 5).join(" ") + " Opportunity";
}

function anyBonus_(tokenSet, combined, markers, weight) {
  var resolvedWeight = weight || 1;
  return markers.some(function(marker) {
    return tokenSet[marker] || combined.indexOf(marker) !== -1;
  }) ? resolvedWeight : 0;
}

function tokens_(text) {
  var raw = String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [];
  return raw.map(stem_).filter(function(token) {
    return !STOPWORDS[token] && token.length > 2;
  });
}

function topTokens_(text, limit) {
  var counts = {};
  var firstIndex = {};
  tokens_(text).forEach(function(token, index) {
    counts[token] = (counts[token] || 0) + 1;
    if (!Object.prototype.hasOwnProperty.call(firstIndex, token)) {
      firstIndex[token] = index;
    }
  });

  return Object.keys(counts).sort(function(a, b) {
    return compareMany_([
      counts[b] - counts[a],
      firstIndex[a] - firstIndex[b],
      compareStrings_(a, b)
    ]);
  }).slice(0, limit);
}

function stem_(token) {
  if (/ies$/.test(token) && token.length > 4) {
    return token.slice(0, -3) + "y";
  }
  var suffixes = ["ing", "ed", "es", "s"];
  for (var i = 0; i < suffixes.length; i += 1) {
    var suffix = suffixes[i];
    if (token.slice(-suffix.length) === suffix && token.length > suffix.length + 3) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

function wordCount_(text) {
  var words = String(text || "").match(/[A-Za-z0-9]+/g);
  return words ? words.length : 0;
}

function truncateWords_(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  var shortened = text.slice(0, maxChars).replace(/\s+\S*$/, "").replace(/[ ,;:]+$/, "");
  return shortened + "...";
}

function formatIndustries_(industries) {
  if (!industries || !industries.length) {
    return "the affected industries";
  }
  if (industries.length === 1) {
    return industries[0];
  }
  if (industries.length === 2) {
    return industries[0] + " and " + industries[1];
  }
  return industries.slice(0, -1).join(", ") + ", and " + industries[industries.length - 1];
}

function getAsymmetrySpreadsheet_(props) {
  var spreadsheetId = props.getProperty("ASYMMETRY_SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    return null;
  }
}

function ensureSignalsHeader_(sheet) {
  var header = ["Timestamp", "Run ID", "Signal ID", "Industry", "Signal", "Evidence", "Strength Score"];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    return;
  }

  var firstRow = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  if (String(firstRow[0] || "") !== "Timestamp" || String(firstRow[1] || "") !== "Run ID") {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildAllKeywords_() {
  var all = {};
  Object.keys(CATEGORY_KEYWORDS).forEach(function(category) {
    CATEGORY_KEYWORDS[category].forEach(function(keyword) {
      all[keyword] = true;
    });
  });
  return Object.keys(all).sort(function(a, b) {
    return b.length - a.length || compareStrings_(a, b);
  });
}

function toSet_(items) {
  var set = {};
  (items || []).forEach(function(item) {
    set[item] = true;
  });
  return set;
}

function uniqueSorted_(items) {
  return Object.keys(toSet_(items)).sort(compareStrings_);
}

function compareStrings_(a, b) {
  return String(a).localeCompare(String(b));
}

function compareMany_(comparisons) {
  for (var i = 0; i < comparisons.length; i += 1) {
    if (comparisons[i] < 0) {
      return -1;
    }
    if (comparisons[i] > 0) {
      return 1;
    }
  }
  return 0;
}

function roundHalfToEven_(value) {
  var floor = Math.floor(value);
  var diff = value - floor;
  if (diff < 0.5) {
    return floor;
  }
  if (diff > 0.5) {
    return floor + 1;
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

function clampScore_(value) {
  return Math.max(1, Math.min(10, value));
}

function padNumber_(value, width) {
  var text = String(value);
  while (text.length < width) {
    text = "0" + text;
  }
  return text;
}

function escapeRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage_(err) {
  if (!err) {
    return "Unknown error";
  }
  return err.message ? String(err.message) : String(err);
}
