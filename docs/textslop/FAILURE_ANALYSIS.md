# TextSlopBench failure analysis

Pre-change analysis only. No skill files were modified. The comparison uses the six prior host-agent output files and the single original judge pass per fixture. The prior judge result is a smoke test, not a claim of equivalence.

## Main answer

The six FixMySlop losses share a register-and-pragmatics gap more than a fidelity gap. The analyzer often detects surface inflation, filler, or negative parallelism, but the rewrite policy does not convert those signals into genre-specific decisions about spoken cadence, support empathy, policy scope, README relevance, or academic information structure. The deterministic CLI does not pass analyzer findings to a rewriting model at all; the host-agent comparison prompt also did not supply a finding list. This is therefore mostly rewrite-policy/genre miss, with analyzer miss for pragmatic and claim-coverage properties.

Higher Jaccard is not uniformly good or bad. It tracks fidelity wins on release notes, recipes, and the bilingual review, but it also tracks under-editing when the remaining defect is voice or register. The small prior pass has no power to establish a correlation; the computed point-biserial values below are descriptive only.

Prior single-pass FixMySlop wins (6): release_notes_hype, incident_postmortem, recipe_prose, onboarding_microcopy, internal_project_memo, bilingual_customer_review.
Prior single-pass FixMySlop losses (6): support_email_refund, research_abstract, policy_notice, social_post_mixed_feelings, readme_commands, interview_transcript.

## Aggregate diagnostics

```json
{
  "fixture_count": 12,
  "fix_wins_in_prior_single_judge_pass": [
    "release_notes_hype",
    "incident_postmortem",
    "recipe_prose",
    "onboarding_microcopy",
    "internal_project_memo",
    "bilingual_customer_review"
  ],
  "fix_losses_in_prior_single_judge_pass": [
    "support_email_refund",
    "research_abstract",
    "policy_notice",
    "social_post_mixed_feelings",
    "readme_commands",
    "interview_transcript"
  ],
  "fix_win_count": 6,
  "fix_loss_count": 6,
  "fix_jaccard_mean_wins": 0.6291,
  "fix_jaccard_mean_losses": 0.5875,
  "fix_edit_mean_wins": 0.4148,
  "fix_edit_mean_losses": 0.4031,
  "point_biserial_jaccard_vs_fix_win": 0.181,
  "point_biserial_edit_vs_fix_win": 0.0373,
  "known_baseline_semantic_risk_cases_all": [
    "support_email_refund",
    "release_notes_hype",
    "recipe_prose",
    "bilingual_customer_review"
  ],
  "known_baseline_semantic_risk_cases_within_fix_wins": [
    "release_notes_hype",
    "recipe_prose",
    "bilingual_customer_review"
  ],
  "known_baseline_semantic_risk_rate_over_fix_wins": 0.5,
  "known_baseline_semantic_risk_rate_over_all_fixtures": 0.3333,
  "interpretation": "The sample is too small for a causal claim. Higher retention is beneficial in the release/recipe/bilingual cases, but the same retention can leave register problems untouched in the interview/social/support/README cases."
}
```

## Ranked recommendations (do not implement yet)

These are pre-change recommendations only; none was applied to the skill.

1. **Add explicit genre/register inference and genre-specific rewrite objectives for dialogue, support, social, README, academic, and policy text.** *(expected impact: High)* — The six prior losses cluster in these genres; the heuristic audit matched 11/12 fixtures, while the current CLI records genre='auto' without inferring it. Interview, social, support, and README failures are task-fit failures rather than missing surface substitutions.

2. **Pass analyzer findings into the rewrite step as actionable edit targets with a preserve/allow decision for each finding.** *(expected impact: High)* — The host-agent prompt supplied no humanstats findings or per-finding edit plan. Two of six loss outputs still retain a detector finding (social promotional language; interview false-range phrasing), while the remaining four losses expose analyzer blind spots that need explicit genre targets.

3. **Add claim-coverage and unsupported-addition checks, not just protected-span/exact-fidelity checks.** *(expected impact: High)* — Within the six prior Fix wins, the baseline drops release performance data, invents recipe timing/meal details, and changes/drops distinctive review wording: 3/6 show semantic or voice-fidelity risk. Separately, the support baseline adds a package-contents photo requirement. The existing exact checker passes both systems.

4. **Add genre-sensitive voice and information-density scoring, plus human do-no-harm judgments, before using retention as a guardrail.** *(expected impact: Medium-high)* — Fix Jaccard is higher on prior wins (0.6291) than losses (0.5875), but edit magnitude has almost no association with winning (point-biserial 0.0373). Retention helps fact-rich cases and can preserve the wrong register; the current control slice has automatic fidelity only, not human preservation judgments.

5. **Pin and record rewrite-host provenance, then evaluate locked held-out LAMP, Baumler, Beemo, and WQ subsets before tuning the skill.** *(expected impact: Medium-high)* — The original rewrite host model/settings were not recorded; the expanded judge audit shows 37.1% orientation winner flips and Fleiss kappa 0.228. The adapters are implemented, but real-data access, terms, and held-out manifests are still outstanding.

## Per-fixture comparison

### support_email_refund
Genre metadata: `customer-support email`; condition: `ai`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
Hi there! Great question, and you're absolutely right to reach out. Your Bramble Mini order #TSB-1042 was delivered on 14 August, but the replacement filter pack is missing. We're happy to help make this right! Please send a photo and we can issue a refund within 7 business days. I hope this helps—let me know if you'd like anything else.
```

#### Exact FixMySlop output
```text
Hi, and thanks for reaching out. Your Bramble Mini order #TSB-1042 was delivered on 14 August, but the replacement filter pack was missing. Please send us a photo, and we can issue a refund within 7 business days. Sorry for the trouble.
```

#### Exact baseline Humanizer output
```text
I'm sorry your Bramble Mini order #TSB-1042 was delivered on 14 August without the replacement filter pack. Please send us a photo of the package and its contents, and we'll issue a refund within 7 business days. Sorry for the trouble.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "support_email_refund",
    "choice": "B",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 4,
    "note": "More direct and empathetic, with a clearer description of the missing item.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "support_email_refund",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A is clear, polite, and appropriately supportive while staying close to the source; B adds extra request details and feels slightly stiffer.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "support_email_refund",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is warm, direct, and complete, retaining the order details, missing item, photo request, refund timing, and apology. B is also polished but adds specificity about the package contents that the source did not require.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "support_email_refund",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is concise, apologetic support copy that preserves the stated evidence request and refund timing. B is equally natural but adds a requirement for photos of both package and contents.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "support_email_refund",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B sounds more like a polished support email while preserving the source facts and keeping an appropriate customer-service tone.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "support_email_refund",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is more empathetic and decisive, with a clear request and resolution. B stays closer to the source wording but retains a somewhat canned opening and the weaker 'we can issue' commitment.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "support_email_refund",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B is warm but professional support copy and keeps the requested evidence and refund timing. A adds a requirement for package contents that the source did not specify.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 29,
    "normalized_word_edit_distance": 0.4677,
    "char_edit_distance": 138,
    "normalized_char_edit_distance": 0.4071,
    "content_retention_jaccard": 0.5098,
    "source_word_count": 62,
    "candidate_word_count": 43,
    "word_delta": -19,
    "length_ratio": 0.6935,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Bramble Mini",
            "#TSB-1042",
            "14 August",
            "7 business days"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "1042",
            "14",
            "7"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.52,
      "char_delta": -103,
      "word_delta": -19,
      "rewrite_ratio": 0.6962,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 39,
    "normalized_word_edit_distance": 0.629,
    "char_edit_distance": 173,
    "normalized_char_edit_distance": 0.5103,
    "content_retention_jaccard": 0.4,
    "source_word_count": 62,
    "candidate_word_count": 42,
    "word_delta": -20,
    "length_ratio": 0.6774,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Bramble Mini",
            "#TSB-1042",
            "14 August",
            "7 business days"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "1042",
            "14",
            "7"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.4074,
      "char_delta": -104,
      "word_delta": -20,
      "rewrite_ratio": 0.6932,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `interface_artifact`.
```json
{
  "fix_before": [
    {
      "family": "interface_artifact",
      "severity": 2,
      "start": 10,
      "end": 24,
      "evidence": "Great question",
      "message": "chat-response language"
    },
    {
      "family": "interface_artifact",
      "severity": 2,
      "start": 281,
      "end": 298,
      "evidence": "I hope this helps",
      "message": "chat-response language"
    },
    {
      "family": "interface_artifact",
      "severity": 2,
      "start": 299,
      "end": 313,
      "evidence": "let me know if",
      "message": "chat-response language"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R13_em_dash",
      "title": "em/en dash",
      "count": 1,
      "evidence": [
        "—"
      ]
    },
    {
      "rule": "R19_chat_artifact",
      "title": "collaborative/chat artifact",
      "count": 3,
      "evidence": [
        "Great question",
        "I hope this helps",
        "let me know"
      ]
    },
    {
      "rule": "R21_sycophancy",
      "title": "sycophantic tone",
      "count": 3,
      "evidence": [
        "Great question",
        "you're absolutely right",
        "happy to help"
      ]
    }
  ],
  "baseline_remaining": [],
  "fix_rules_remaining": []
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "customer-support email",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "customer-support email",
      "warm, concise support correspondence"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Make the apology and next step sound like support correspondence; remove the generic greeting and closing without adding a package-photo requirement.",
    "category": "genre/register miss",
    "detectability": "Analyzer miss: current findings catch chat framing but not support empathy, clarity, or the awkward delivered-but-missing construction.",
    "baseline_issue": "Baseline adds 'package and its contents', a requirement absent from the source; the exact checker does not catch additions.",
    "diagnosis": "FixMySlop retains the factual core but its opening remains generic and less empathetic. The failure is pragmatic/register-sensitive, not caused by an overly strong fidelity guardrail."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### release_notes_hype
Genre metadata: `software release notes`; condition: `ai`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
🚀 v2.4.0 marks a pivotal moment for the export experience, delivering a powerful, seamless, and intuitive workflow. We enhanced /v1/exports with smarter retry handling, improved visibility, and better performance, reducing failed jobs by 38%. The update also introduces retry_after support and a new --dry-run option. Upgrade today to unlock the future of reliable exports, available 2026-08-12.
```

#### Exact FixMySlop output
```text
v2.4.0 improves the export experience with smarter retry handling, better visibility, and improved performance for /v1/exports. These changes reduced failed jobs by 38%. It also adds retry_after support and a new --dry-run option. Released 2026-08-12.
```

#### Exact baseline Humanizer output
```text
v2.4.0 improves export reliability. We updated /v1/exports with smarter retry handling and clearer job status. Failed jobs fell by 38%. This release also adds retry_after support and a new --dry-run option. Released 2026-08-12.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "release_notes_hype",
    "choice": "B",
    "naturalness": 4,
    "quality": 4,
    "fidelity": 5,
    "voice": 4,
    "note": "Retains all stated release changes and the measured result; A omits the performance improvement.",
    "a_system": "humanizer/host-agent",
    "b_system": "FixMySlop:Humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "release_notes_hype",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 3.0,
    "reason": "A is tighter and better aligned with straightforward release notes, though B preserves a bit more of the source detail.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "release_notes_hype",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 3.0,
    "reason": "Both are polished and faithful release notes. A is marginally clearer and more specific about job status, while B retains performance detail but repeats 'improves/improved' and reads a little less tightly.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "release_notes_hype",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A has the cleaner release-note cadence and turns vague visibility into a concrete job-status benefit. B retains more source language but repeats generic improvement claims and needs more editing.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "release_notes_hype",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "Both are strong, but A stays slightly closer to the source phrasing and scope while remaining concise and release-note appropriate.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "release_notes_hype",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B has the strongest release-notes voice: concrete, compact, and focused on reliability and job status. A is also solid but repeats 'improved' and is less specific about the user-visible change.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "release_notes_hype",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B is sharper release-note copy with a clearer progression from change to outcome, though it omits the explicit performance improvement that A preserves.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 37,
    "normalized_word_edit_distance": 0.6066,
    "char_edit_distance": 224,
    "normalized_char_edit_distance": 0.5671,
    "content_retention_jaccard": 0.5,
    "source_word_count": 61,
    "candidate_word_count": 41,
    "word_delta": -20,
    "length_ratio": 0.6721,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "v2.4.0",
            "/v1/exports",
            "38%",
            "retry_after",
            "--dry-run",
            "2026-08-12"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026-08-12"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "4.0",
            "38%",
            "2026",
            "08",
            "12"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5,
      "char_delta": -144,
      "word_delta": -20,
      "rewrite_ratio": 0.6354,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 34,
    "normalized_word_edit_distance": 0.5574,
    "char_edit_distance": 219,
    "normalized_char_edit_distance": 0.5544,
    "content_retention_jaccard": 0.3208,
    "source_word_count": 61,
    "candidate_word_count": 39,
    "word_delta": -22,
    "length_ratio": 0.6393,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "v2.4.0",
            "/v1/exports",
            "38%",
            "retry_after",
            "--dry-run",
            "2026-08-12"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026-08-12"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "4.0",
            "38%",
            "2026",
            "08",
            "12"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.3208,
      "char_delta": -168,
      "word_delta": -22,
      "rewrite_ratio": 0.5747,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `ai_vocabulary, inflation, promotional`.
```json
{
  "fix_before": [
    {
      "family": "inflation",
      "severity": 1,
      "start": 17,
      "end": 31,
      "evidence": "pivotal moment",
      "message": "importance is asserted rather than shown"
    },
    {
      "family": "ai_vocabulary",
      "severity": 1,
      "start": 17,
      "end": 24,
      "evidence": "pivotal",
      "message": "context-sensitive formulaic vocabulary"
    },
    {
      "family": "promotional",
      "severity": 1,
      "start": 82,
      "end": 90,
      "evidence": "seamless",
      "message": "promotional adjective or bundle"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R01_significance_inflation",
      "title": "undue significance",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 3,
      "evidence": [
        "powerful",
        "seamless",
        "intuitive"
      ]
    },
    {
      "rule": "R07_ai_vocabulary",
      "title": "formulaic AI vocabulary",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 2,
      "evidence": [
        "delivering a powerful, seamless, and intuitive workflow",
        "We enhanced /v1/exports with smarter retry handling, improved visibility, and better performance"
      ]
    },
    {
      "rule": "R17_emoji",
      "title": "emoji decoration",
      "count": 1,
      "evidence": [
        "🚀"
      ]
    }
  ],
  "baseline_remaining": [],
  "fix_rules_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "0 improves the export experience with smarter retry handling, better visibility, and improved performance for /v1/exports"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "software release notes",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "software release notes",
      "terse factual release communication"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Use terse release-note structure and retain every measured change, including better performance and the 38% failed-job reduction.",
    "category": "fidelity constraint too strong",
    "detectability": "Analyzer correctly sees hype, emoji, and AI vocabulary; it does not represent claim coverage, so omission of 'better performance' is invisible.",
    "baseline_issue": "Baseline drops the stated performance improvement while retaining the 38% number.",
    "diagnosis": "Fix wins because it preserves the release facts while neutralizing hype. Its higher retention is beneficial here, not under-editing."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### incident_postmortem
Genre metadata: `engineering incident postmortem`; condition: `ai`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
At 2026-08-15 03:12 UTC, the queue-worker entered a degraded state after receiving ERR_BATCH_17. The issue was not merely a processing failure—it was a critical reminder of the importance of resilient systems. Industry observers would likely agree that the alerting gaps contributed to the 19-minute delay. As one engineer said, "We saw the alert, but assumed it was the usual backlog." We have implemented monitoring, documentation, and process improvements to ensure this does not happen again.
```

#### Exact FixMySlop output
```text
At 2026-08-15 03:12 UTC, the queue-worker entered a degraded state after receiving ERR_BATCH_17. Alerting gaps contributed to the 19-minute delay. As one engineer said, "We saw the alert, but assumed it was the usual backlog." We have added monitoring, updated the documentation, and revised the response process.
```

#### Exact baseline Humanizer output
```text
At 2026-08-15 03:12 UTC, queue-worker entered a degraded state after receiving ERR_BATCH_17. The failure exposed an alerting gap and caused a 19-minute delay. One engineer said, "We saw the alert, but assumed it was the usual backlog." We added monitoring and updated the documentation and response process.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "incident_postmortem",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 5,
    "voice": 4,
    "note": "A keeps the cautious causal claim and concrete remediation list while removing inflated framing.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "incident_postmortem",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A reads like a cleaner postmortem and stays closer to the source wording; B is solid but recasts a few details and reads slightly less polished.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "incident_postmortem",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "A is a clean, professional postmortem summary and retains the concrete timeline, quote, and distinct remediation steps; B is similarly faithful but slightly more compressed and less precise about the process changes.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "incident_postmortem",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A directly and accurately states the alerting cause and remediation in a postmortem-appropriate register. B is concise but awkwardly omits the article before queue-worker and shifts the causal framing.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "incident_postmortem",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B reads like a cleaner postmortem while staying close to the source details and register; A is solid but slightly rougher in phrasing.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "incident_postmortem",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is more direct and less formulaic, with a clear causal account; it only needs the minor grammatical fix of restoring 'the' before queue-worker. B is faithful but more bureaucratic.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "incident_postmortem",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "Tie",
    "winner": null,
    "confidence": 4.0,
    "reason": "Both are concise, factual postmortem prose that preserve the timestamp, error, delay, quotation, and remediation without unnecessary framing.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 38,
    "normalized_word_edit_distance": 0.4691,
    "char_edit_distance": 225,
    "normalized_char_edit_distance": 0.4536,
    "content_retention_jaccard": 0.5345,
    "source_word_count": 81,
    "candidate_word_count": 52,
    "word_delta": -29,
    "length_ratio": 0.642,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "2026-08-15 03:12 UTC",
            "queue-worker",
            "ERR_BATCH_17",
            "19-minute",
            "\"We saw the alert, but assumed it was the usual backlog.\""
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026-08-15"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "2026",
            "08",
            "15",
            "03",
            "12",
            "17",
            "19"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5424,
      "char_delta": -183,
      "word_delta": -29,
      "rewrite_ratio": 0.631,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 42,
    "normalized_word_edit_distance": 0.5185,
    "char_edit_distance": 231,
    "normalized_char_edit_distance": 0.4657,
    "content_retention_jaccard": 0.4833,
    "source_word_count": 81,
    "candidate_word_count": 52,
    "word_delta": -29,
    "length_ratio": 0.642,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "2026-08-15 03:12 UTC",
            "queue-worker",
            "ERR_BATCH_17",
            "19-minute",
            "\"We saw the alert, but assumed it was the usual backlog.\""
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026-08-15"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "2026",
            "08",
            "15",
            "03",
            "12",
            "17",
            "19"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.4918,
      "char_delta": -189,
      "word_delta": -29,
      "rewrite_ratio": 0.619,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `none`.
```json
{
  "fix_before": [],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R05_vague_attribution",
      "title": "vague attribution",
      "count": 1,
      "evidence": [
        "observers"
      ]
    },
    {
      "rule": "R09_negative_parallelism",
      "title": "negative parallelism",
      "count": 1,
      "evidence": [
        "not merely"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "We have implemented monitoring, documentation, and process improvements to ensure this does not happen again"
      ]
    },
    {
      "rule": "R13_em_dash",
      "title": "em/en dash",
      "count": 1,
      "evidence": [
        "—"
      ]
    }
  ],
  "baseline_remaining": [],
  "fix_rules_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "We have added monitoring, updated the documentation, and revised the response process"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "engineering incident postmortem",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "engineering incident postmortem",
      "blunt accountable technical report"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Keep the timestamp, service, error, quote, and duration; state causality carefully and make remediation concrete.",
    "category": "benchmark/judge uncertainty",
    "detectability": "Analyzer sees the dash, negative parallelism, vague attribution, and generic remediation only partially; no clear remaining high-confidence error is visible in the Fix output.",
    "baseline_issue": "No confirmed baseline factual omission in this fixture; the win is mostly clarity and cautious attribution.",
    "diagnosis": "The apparent win is plausible but not a strong fidelity separation. It should be treated as a useful calibration case, not evidence of a broad advantage."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### research_abstract
Genre metadata: `academic abstract`; condition: `ai`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
This study serves as a significant contribution to the evolving landscape of attention research by examining task_switch_cost in a controlled sample. Eighty-four participants (n = 84) completed condition_B, with results indicating a statistically significant reduction in response time of 12 minutes (p = .03), highlighting the potentially important implications of the intervention. While further research may be needed, these findings could potentially suggest that the method might improve focus.
```

#### Exact FixMySlop output
```text
This study examines task_switch_cost in a controlled sample. Eighty-four participants (n = 84) completed condition_B, and response time was reduced by 12 minutes (p = .03). These findings tentatively suggest that the method may improve focus, though further research may be needed.
```

#### Exact baseline Humanizer output
```text
This study examined task_switch_cost in a controlled sample of 84 participants (n = 84) who completed condition_B. The intervention produced a statistically significant reduction in response time of 12 minutes (p = .03). The findings suggest that the method may improve focus, although further research is needed to determine whether the effect holds in other samples.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "research_abstract",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 4,
    "note": "Clearer academic prose and a more complete statement of the study's cautious conclusion.",
    "a_system": "humanizer/host-agent",
    "b_system": "FixMySlop:Humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "research_abstract",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B feels more like a conventional abstract and stays closer to the source claims, while A adds an extra limitation not stated in the original.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "research_abstract",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A has the stronger academic structure and explicitly preserves the statistical-significance claim, sample size, effect, and limitation. B is readable but drops that important qualifier and uses a less precise summary.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "research_abstract",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A uses precise academic prose, reports the result cleanly, and appropriately qualifies generalizability. B is faithful but its tense and repeated hedging make it less polished as an abstract.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "research_abstract",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B fits academic abstract style better and presents the findings more cleanly, with only a small amount of additional cautionary framing.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "research_abstract",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B is more conventional academic prose, clearly identifies the sample and intervention, and gives a useful scope limitation. A is accurate but less polished and slightly more hedged.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "research_abstract",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B has the more idiomatic academic register, consistent past tense, and appropriately qualified interpretation while retaining the study details and uncertainty.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 47,
    "normalized_word_edit_distance": 0.6912,
    "char_edit_distance": 292,
    "normalized_char_edit_distance": 0.5852,
    "content_retention_jaccard": 0.4902,
    "source_word_count": 68,
    "candidate_word_count": 41,
    "word_delta": -27,
    "length_ratio": 0.6029,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "task_switch_cost",
            "n = 84",
            "condition_B",
            "12 minutes",
            "p = .03"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "84",
            "12",
            "03"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5094,
      "char_delta": -218,
      "word_delta": -27,
      "rewrite_ratio": 0.5631,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 43,
    "normalized_word_edit_distance": 0.6324,
    "char_edit_distance": 257,
    "normalized_char_edit_distance": 0.515,
    "content_retention_jaccard": 0.4727,
    "source_word_count": 68,
    "candidate_word_count": 54,
    "word_delta": -14,
    "length_ratio": 0.7941,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "task_switch_cost",
            "n = 84",
            "condition_B",
            "12 minutes",
            "p = .03"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "84",
            "12",
            "03"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5,
      "char_delta": -131,
      "word_delta": -14,
      "rewrite_ratio": 0.7375,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `copula_avoidance, inflation, participial_tail`.
```json
{
  "fix_before": [
    {
      "family": "copula_avoidance",
      "severity": 1,
      "start": 11,
      "end": 20,
      "evidence": "serves as",
      "message": "elaborate substitute for a simple verb"
    },
    {
      "family": "inflation",
      "severity": 1,
      "start": 55,
      "end": 73,
      "evidence": "evolving landscape",
      "message": "importance is asserted rather than shown"
    },
    {
      "family": "participial_tail",
      "severity": 1,
      "start": 309,
      "end": 323,
      "evidence": ", highlighting",
      "message": "explanatory -ing tail"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R01_significance_inflation",
      "title": "undue significance",
      "count": 1,
      "evidence": [
        "evolving landscape"
      ]
    },
    {
      "rule": "R03_ing_analysis",
      "title": "superficial -ing analysis",
      "count": 1,
      "evidence": [
        ", highlighting"
      ]
    },
    {
      "rule": "R08_copula_avoidance",
      "title": "copula avoidance",
      "count": 1,
      "evidence": [
        "serves as"
      ]
    }
  ],
  "baseline_remaining": [],
  "fix_rules_remaining": []
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "academic abstract",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "academic abstract",
      "restrained research summary"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Use restrained abstract tense and syntax, preserve the sample/statistical values, and state the cautious inference without adding causal force.",
    "category": "genre/register miss",
    "detectability": "Analyzer sees inflation, AI vocabulary, participial framing, and hedging in the source; after the Fix rewrite, it does not score abstract-specific tense, result framing, or claim precision.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline wins on tighter academic result/conclusion phrasing.",
    "diagnosis": "Fix is faithful but still reads like a lightly cleaned source rather than a finished abstract. The missing capability is academic register and information-structure control."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### recipe_prose
Genre metadata: `recipe`; condition: `ai`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
Nestled in the heart of weeknight cooking, this vibrant tomato toast is a celebration of freshness, comfort, and simplicity. Begin by combining 2 tbsp olive oil with crushed tomatoes, herbs, and garlic, then allow the flavors to harmoniously develop. Spread the mixture over bread and bake at 190°C for 22 minutes until golden, fragrant, and irresistible. This peanut-free recipe is perfect for busy families and food lovers alike.
```

#### Exact FixMySlop output
```text
Mix 2 tbsp olive oil with crushed tomatoes, herbs, and garlic. Let the flavors develop, then spread the mixture over bread. Bake at 190°C for 22 minutes, until golden and fragrant. This recipe is peanut-free.
```

#### Exact baseline Humanizer output
```text
For a quick tomato toast, mix 2 tbsp olive oil with crushed tomatoes, herbs, and garlic. Let the mixture sit for a few minutes, then spread it over the bread. Bake at 190°C for 22 minutes, until the edges are golden. This peanut-free recipe makes an easy weeknight snack or light meal.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "recipe_prose",
    "choice": "A",
    "naturalness": 5,
    "quality": 4,
    "fidelity": 5,
    "voice": 4,
    "note": "Keeps the actual recipe content while removing promotional fluff; B adds unsupported timing and serving claims.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "recipe_prose",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 3.0,
    "reason": "B reads more like finished recipe copy with only light additions, while A is accurate but more bare-bones and less inviting.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "recipe_prose",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is crisp recipe prose and preserves every actionable instruction and the peanut-free constraint. B adds an unsupported resting step and reframes the result as a snack or light meal.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "recipe_prose",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A faithfully converts the source into straightforward recipe instructions and removes the promotional filler. B reads warmly, but adds a resting time and serving framing not supplied by the source.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "recipe_prose",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A reads like usable recipe prose with a natural weeknight-cooking register, while B is leaner but loses some of the source's practical framing.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "recipe_prose",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A reads like useful recipe instructions and gives the result a plausible weeknight use case. B is faithful and concise but retains the slightly artificial 'let the flavors develop' phrasing.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "recipe_prose",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B gives direct, natural recipe instructions and retains all material requirements. A is also good but adds an unsupported timing detail and reframes the serving use.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 40,
    "normalized_word_edit_distance": 0.5714,
    "char_edit_distance": 253,
    "normalized_char_edit_distance": 0.587,
    "content_retention_jaccard": 0.5385,
    "source_word_count": 70,
    "candidate_word_count": 37,
    "word_delta": -33,
    "length_ratio": 0.5286,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "2 tbsp",
            "190°C",
            "22 minutes",
            "peanut-free"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "2",
            "190",
            "22"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5385,
      "char_delta": -223,
      "word_delta": -33,
      "rewrite_ratio": 0.4826,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 46,
    "normalized_word_edit_distance": 0.6571,
    "char_edit_distance": 242,
    "normalized_char_edit_distance": 0.5615,
    "content_retention_jaccard": 0.4516,
    "source_word_count": 70,
    "candidate_word_count": 54,
    "word_delta": -16,
    "length_ratio": 0.7714,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "2 tbsp",
            "190°C",
            "22 minutes",
            "peanut-free"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "2",
            "190",
            "22"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.4516,
      "char_delta": -146,
      "word_delta": -16,
      "rewrite_ratio": 0.6613,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `promotional`.
```json
{
  "fix_before": [
    {
      "family": "promotional",
      "severity": 1,
      "start": 48,
      "end": 55,
      "evidence": "vibrant",
      "message": "promotional adjective or bundle"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 1,
      "evidence": [
        "vibrant"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 3,
      "evidence": [
        "this vibrant tomato toast is a celebration of freshness, comfort, and simplicity",
        "Begin by combining 2 tbsp olive oil with crushed tomatoes, herbs, and garlic",
        "Spread the mixture over bread and bake at 190°C for 22 minutes until golden, fragrant, and irresistible"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "mix 2 tbsp olive oil with crushed tomatoes, herbs, and garlic"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "Mix 2 tbsp olive oil with crushed tomatoes, herbs, and garlic"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "recipe",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "recipe",
      "practical imperative instructions"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Turn the introduction into direct instructions while preserving the exact quantities, temperature, time, and dietary property.",
    "category": "benchmark/judge uncertainty",
    "detectability": "Analyzer catches promotional language and false range only weakly; it has no recipe-task or instruction-utility metric.",
    "baseline_issue": "Baseline invents 'a few minutes' and 'light meal'; these are unsupported additions not covered by exact protected spans.",
    "diagnosis": "Fix wins primarily because it does not invent recipe facts. This is a consistent baseline semantic-risk pattern, not proof that Fix's prose is always better."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### policy_notice
Genre metadata: `policy notice`; condition: `ai`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
In order to ensure a transparent and empowering experience, the service will not only update its data-retention process but will also foster stronger user control. Under Section 4.2, customers may opt out before 1 September 2026 by visiting https://example.test/opt-out or emailing privacy@example.test. This is not merely an administrative update; it represents an important step toward responsible data stewardship. Requests submitted within 30 days will be reviewed by the privacy team.
```

#### Exact FixMySlop output
```text
The service will update its data-retention process and support stronger user control. Under Section 4.2, customers may opt out before 1 September 2026 by visiting https://example.test/opt-out or emailing privacy@example.test. This is an administrative update that supports responsible data stewardship. Requests submitted within 30 days will be reviewed by the privacy team.
```

#### Exact baseline Humanizer output
```text
Under Section 4.2, the service will update its data-retention process. Customers may opt out before 1 September 2026 by visiting https://example.test/opt-out or emailing privacy@example.test. Requests submitted within 30 days will be reviewed by the privacy team.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "policy_notice",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 5,
    "voice": 4,
    "note": "Clear and concise policy language; B preserves unnecessary promotional framing and recasts the update.",
    "a_system": "humanizer/host-agent",
    "b_system": "FixMySlop:Humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "policy_notice",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A is clean and appropriate for a policy notice; B includes awkward framing that undercuts the source's intent and sounds less natural.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 3.0,
        "quality": 3.0,
        "fidelity": 3.0,
        "voice": 3.0
      }
    }
  },
  {
    "fixture_id": "policy_notice",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A delivers the operative policy, deadline, opt-out routes, and review window with the appropriate concise notice style. B retains more of the source framing but adds a vague, unnecessary stewardship sentence.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "policy_notice",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is ready-to-send policy language that keeps the operative notice, deadline, channels, and review window. B preserves more claims but its responsible-stewardship sentence remains abstract and bureaucratic.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "policy_notice",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A retains the main policy change, opt-out path, and broader framing about user control, while B omits important source content.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 2.0,
        "voice": 3.0
      }
    }
  },
  {
    "fixture_id": "policy_notice",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B states the policy change and opt-out procedure plainly, which fits a notice. A reintroduces vague stewardship language that adds rhetoric without useful information.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "policy_notice",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A retains the notice's two stated policy effects and deadline process. B is cleaner but makes the Section 4.2 relationship less precise and omits the user-control commitment.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 23,
    "normalized_word_edit_distance": 0.2949,
    "char_edit_distance": 128,
    "normalized_char_edit_distance": 0.2618,
    "content_retention_jaccard": 0.6727,
    "source_word_count": 78,
    "candidate_word_count": 59,
    "word_delta": -19,
    "length_ratio": 0.7564,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Section 4.2",
            "1 September 2026",
            "https://example.test/opt-out",
            "privacy@example.test",
            "30 days"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [
            "https://example.test/opt-out"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "4.2",
            "1",
            "2026",
            "30"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6909,
      "char_delta": -115,
      "word_delta": -19,
      "rewrite_ratio": 0.7648,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 38,
    "normalized_word_edit_distance": 0.4872,
    "char_edit_distance": 234,
    "normalized_char_edit_distance": 0.4785,
    "content_retention_jaccard": 0.5577,
    "source_word_count": 78,
    "candidate_word_count": 44,
    "word_delta": -34,
    "length_ratio": 0.5641,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Section 4.2",
            "1 September 2026",
            "https://example.test/opt-out",
            "privacy@example.test",
            "30 days"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [
            "https://example.test/opt-out"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [
            "2026"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "4.2",
            "1",
            "2026",
            "30"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.566,
      "char_delta": -226,
      "word_delta": -34,
      "rewrite_ratio": 0.5378,
      "drift_flags": []
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `ai_vocabulary, filler`.
```json
{
  "fix_before": [
    {
      "family": "filler",
      "severity": 1,
      "start": 0,
      "end": 11,
      "evidence": "In order to",
      "message": "needless framing"
    },
    {
      "family": "ai_vocabulary",
      "severity": 1,
      "start": 134,
      "end": 140,
      "evidence": "foster",
      "message": "context-sensitive formulaic vocabulary"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R09_negative_parallelism",
      "title": "negative parallelism",
      "count": 2,
      "evidence": [
        "not only",
        "not merely"
      ]
    },
    {
      "rule": "R22_filler",
      "title": "filler",
      "count": 1,
      "evidence": [
        "In order to"
      ]
    }
  ],
  "baseline_remaining": [],
  "fix_rules_remaining": []
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "policy notice",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "policy notice",
      "precise rights/policy notice"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Lead with the actual policy change and user right; keep scope, deadline, channels, and review period exact; remove empowerment/promotional framing.",
    "category": "rewrite-policy miss",
    "detectability": "Analyzer correctly flags filler, negative parallelism, copula/AI vocabulary, and significance framing in the source, but does not model legal scope or whether generic stewardship language is expendable.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline is more concise and policy-like.",
    "diagnosis": "Fix acts on surface patterns but leaves 'support stronger user control' and 'responsible data stewardship'. This is a rewrite-policy/register failure after partial analyzer success."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### social_post_mixed_feelings
Genre metadata: `personal social post`; condition: `human`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
Not only did the new station open on Saturday, but it also delivered world-class connectivity from day one. I genuinely don't know how to feel about the announcement: the trains are faster, but the platform is already too crowded. Anyway, progress is progress, and exciting times lie ahead for @devnisha and everyone commuting on #LocalTrain.
```

#### Exact FixMySlop output
```text
The new station opened on Saturday and delivered world-class connectivity from day one. I genuinely don't know how to feel about the announcement: the trains are faster, but the platform is already too crowded. Anyway, progress is progress, and we'll see how it goes for @devnisha and everyone commuting on #LocalTrain.
```

#### Exact baseline Humanizer output
```text
The new station opened on Saturday, and it delivered world-class connectivity from day one. I genuinely don't know how to feel about the announcement: the trains are faster, but the platform is already too crowded. Anyway, progress is progress. Here's hoping things get easier for @devnisha and everyone commuting on #LocalTrain.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "social_post_mixed_feelings",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 5,
    "note": "Keeps the mixed feelings while sounding personal and less formulaic.",
    "a_system": "humanizer/host-agent",
    "b_system": "FixMySlop:Humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B preserves the source's mixed-feelings tone and closing sentiment more faithfully, while A softens and redirects the ending.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "Both fit a personal social post and preserve the mixed feelings. B stays closer to the source's cadence and hopeful-but-uncertain ending; A's 'Here's hoping' changes the closing stance slightly.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "B keeps the author's mixed, tentative reaction and avoids adding a new hopeful claim. Both retain the source's overblown connectivity phrase, but B needs less adjustment overall.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 2.0,
    "reason": "Both are close, but A keeps the casual, mixed-feelings flow of the original a bit better and lands more like a personal post.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A keeps the post's mixed, informal voice and preserves the original closing sentiment without adding a new wish. B is grammatical but 'Here's hoping' feels more generic and less like the source.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "social_post_mixed_feelings",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A preserves the post's mixed feelings and ends in a conversationally skeptical way. B's hopeful closing softens that ambivalence and feels more generic.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 12,
    "normalized_word_edit_distance": 0.2143,
    "char_edit_distance": 46,
    "normalized_char_edit_distance": 0.1345,
    "content_retention_jaccard": 0.7234,
    "source_word_count": 56,
    "candidate_word_count": 52,
    "word_delta": -4,
    "length_ratio": 0.9286,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Saturday",
            "world-class connectivity",
            "I genuinely don't know how to feel",
            "@devnisha",
            "#LocalTrain"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.7234,
      "char_delta": -23,
      "word_delta": -4,
      "rewrite_ratio": 0.9327,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 11,
    "normalized_word_edit_distance": 0.1964,
    "char_edit_distance": 46,
    "normalized_char_edit_distance": 0.1345,
    "content_retention_jaccard": 0.6939,
    "source_word_count": 56,
    "candidate_word_count": 52,
    "word_delta": -4,
    "length_ratio": 0.9286,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Saturday",
            "world-class connectivity",
            "I genuinely don't know how to feel",
            "@devnisha",
            "#LocalTrain"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6939,
      "char_delta": -13,
      "word_delta": -4,
      "rewrite_ratio": 0.962,
      "drift_flags": []
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `generic_conclusion`.
```json
{
  "fix_before": [
    {
      "family": "promotional",
      "severity": 1,
      "start": 69,
      "end": 80,
      "evidence": "world-class",
      "message": "promotional adjective or bundle"
    },
    {
      "family": "generic_conclusion",
      "severity": 2,
      "start": 265,
      "end": 289,
      "evidence": "exciting times lie ahead",
      "message": "generic positive ending"
    }
  ],
  "fix_remaining": [
    {
      "family": "promotional",
      "severity": 1,
      "start": 49,
      "end": 60,
      "evidence": "world-class",
      "message": "promotional adjective or bundle"
    }
  ],
  "baseline_source": [
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 1,
      "evidence": [
        "world-class"
      ]
    },
    {
      "rule": "R09_negative_parallelism",
      "title": "negative parallelism",
      "count": 1,
      "evidence": [
        "Not only"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "Anyway, progress is progress, and exciting times lie ahead for @devnisha and everyone commuting on #LocalTrain"
      ]
    },
    {
      "rule": "R24_generic_conclusion",
      "title": "generic conclusion",
      "count": 1,
      "evidence": [
        "exciting times lie ahead"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 1,
      "evidence": [
        "world-class"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 1,
      "evidence": [
        "world-class"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "Anyway, progress is progress, and we'll see how it goes for @devnisha and everyone commuting on #LocalTrain"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "personal social post",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "personal social post",
      "first-person informal social voice"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Preserve the author's ambivalence and slightly sarcastic first-person voice; remove formulaic announcement framing only if the voice survives.",
    "category": "genre/register miss",
    "detectability": "Analyzer catches negative parallelism and generic conclusion but has no voice-preservation or irony signal; it cannot tell which unusual phrase is intentional.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline supplies a more idiomatic personal close.",
    "diagnosis": "Fix performs safe lexical cleanup but does not add or preserve enough authorial cadence. The shared loss mode is voice flattening in conversational material."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### readme_commands
Genre metadata: `developer README`; condition: `ai`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
TextSlopBench v1 is a powerful and intuitive toolkit for transforming AI-generated prose into natural writing. Getting started is simple: run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request. The project features clean fixtures, robust evaluation, and seamless local iteration. If you encounter issues, let me know! Fixtures live in fixtures/owned-v1.json, and invalid tokens return 401.
```

#### Exact FixMySlop output
```text
TextSlopBench v1 transforms AI-generated prose into natural writing. To get started, run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request. The project includes fixtures and evaluation tools for local iteration. Fixtures live in fixtures/owned-v1.json, and invalid tokens return 401.
```

#### Exact baseline Humanizer output
```text
TextSlopBench v1 rewrites AI-generated prose into more natural writing. To get started, run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request. Fixtures are in fixtures/owned-v1.json. Invalid tokens return 401.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "readme_commands",
    "choice": "B",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 5,
    "note": "More concise and README-like, though it drops the less essential evaluation/local-iteration detail.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "readme_commands",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A keeps the README useful and specific without hype, while B trims away helpful context about local iteration and tooling.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "readme_commands",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A keeps the setup commands, endpoint, fixture path, token behavior, and a useful summary of the evaluation/local-iteration features. B is concise but omits some of those project details.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "readme_commands",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B is the more useful README: it keeps every actionable command, path, endpoint, and error detail without padded description. A is also sound but adds a vague tools-for-local-iteration sentence.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "readme_commands",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is crisp, README-like, and delivers the core setup information cleanly. B is acceptable but a bit more generic and less direct.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "readme_commands",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is the clearest README version and keeps the commands, fixture path, and authentication behavior. B retains more source detail but repeats the fixture information and sounds more promotional.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "readme_commands",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B preserves the useful information about fixtures, evaluation, and local iteration while removing the promotional tone; A is very clean but loses those capabilities.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 24,
    "normalized_word_edit_distance": 0.3871,
    "char_edit_distance": 129,
    "normalized_char_edit_distance": 0.3177,
    "content_retention_jaccard": 0.62,
    "source_word_count": 62,
    "candidate_word_count": 46,
    "word_delta": -16,
    "length_ratio": 0.7419,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "TextSlopBench v1",
            "pnpm dev",
            "SLOP_BENCH_TOKEN",
            "POST /v1/rewrite",
            "fixtures/owned-v1.json",
            "401"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "401"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6275,
      "char_delta": -105,
      "word_delta": -16,
      "rewrite_ratio": 0.7414,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 33,
    "normalized_word_edit_distance": 0.5323,
    "char_edit_distance": 201,
    "normalized_char_edit_distance": 0.4951,
    "content_retention_jaccard": 0.48,
    "source_word_count": 62,
    "candidate_word_count": 36,
    "word_delta": -26,
    "length_ratio": 0.5806,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "TextSlopBench v1",
            "pnpm dev",
            "SLOP_BENCH_TOKEN",
            "POST /v1/rewrite",
            "fixtures/owned-v1.json",
            "401"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "401"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5,
      "char_delta": -179,
      "word_delta": -26,
      "rewrite_ratio": 0.5591,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `promotional`.
```json
{
  "fix_before": [
    {
      "family": "promotional",
      "severity": 1,
      "start": 271,
      "end": 279,
      "evidence": "seamless",
      "message": "promotional adjective or bundle"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R04_promotional",
      "title": "promotional language",
      "count": 3,
      "evidence": [
        "powerful",
        "intuitive",
        "seamless"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 2,
      "evidence": [
        "Getting started is simple: run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request",
        "The project features clean fixtures, robust evaluation, and seamless local iteration"
      ]
    },
    {
      "rule": "R19_chat_artifact",
      "title": "collaborative/chat artifact",
      "count": 1,
      "evidence": [
        "let me know"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "run pnpm dev, set SLOP_BENCH_TOKEN, and send a POST /v1/rewrite request"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "developer README",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "developer README",
      "direct technical documentation"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Use direct developer documentation prose, preserve all commands/routes/paths/status codes, and remove promotional claims and chat sign-off.",
    "category": "genre/register miss",
    "detectability": "Analyzer catches promotional vocabulary and chat artifact but does not score README relevance, imperative clarity, or information density.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline is shorter and more operational.",
    "diagnosis": "Fix keeps a generic project-description sentence and an extra evaluation sentence. It is not too conservative about facts; it is insufficiently task/register sensitive about what a README should foreground."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### onboarding_microcopy
Genre metadata: `product onboarding UI`; condition: `ai`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
✨ Welcome to your personalized writing workspace! In just a few effortless steps, you'll unlock a smoother, clearer, and more authentic writing experience. Add up to 3 sample rewrites, then select Continue to discover your unique style profile. You can Skip for now and change this later at /settings/profile. Samples must be under 2,000 characters.
```

#### Exact FixMySlop output
```text
Welcome to your writing workspace. Add up to 3 sample rewrites, then select Continue to set up your style profile. You can Skip for now and change this later at /settings/profile. Samples must be under 2,000 characters.
```

#### Exact baseline Humanizer output
```text
Welcome to your writing workspace. Add up to 3 sample rewrites, then select Continue to set up a style profile. You can choose Skip for now and make changes later at /settings/profile. Samples must be under 2,000 characters.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "onboarding_microcopy",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 5,
    "voice": 4,
    "note": "A is direct, preserves the UI labels and profile ownership, and avoids B's extra wording and vagueness.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is concise, clear, and closest to the intended UI voice; B is also good but slightly less direct and a bit more generic.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is clearer and more idiomatic UI copy, with a direct 'Skip for now' instruction and the more specific 'your style profile'; B's 'choose Skip' is slightly awkward and less personalized.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "Both are clear, compact UI copy, but A better preserves the personalized nature of the user's style profile. B's indefinite article makes that promise less specific.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B is slightly more natural for UI copy and stays closer to the original wording and user-facing tone.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B is concise, direct UI copy and preserves the user's style-profile reference and exact Skip action. A is slightly less specific and more awkwardly indirect.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "onboarding_microcopy",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "Both are clear, appropriately terse UI copy and retain the action, skip path, settings location, and character limit; B reads a touch more conventional.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 20,
    "normalized_word_edit_distance": 0.3571,
    "char_edit_distance": 135,
    "normalized_char_edit_distance": 0.3868,
    "content_retention_jaccard": 0.6429,
    "source_word_count": 56,
    "candidate_word_count": 39,
    "word_delta": -17,
    "length_ratio": 0.6964,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "3 sample rewrites",
            "Continue",
            "Skip for now",
            "/settings/profile",
            "2,000 characters"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "3",
            "2,000"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6341,
      "char_delta": -130,
      "word_delta": -17,
      "rewrite_ratio": 0.6275,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 23,
    "normalized_word_edit_distance": 0.4107,
    "char_edit_distance": 152,
    "normalized_char_edit_distance": 0.4355,
    "content_retention_jaccard": 0.5556,
    "source_word_count": 56,
    "candidate_word_count": 40,
    "word_delta": -16,
    "length_ratio": 0.7143,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "3 sample rewrites",
            "Continue",
            "Skip for now",
            "/settings/profile",
            "2,000 characters"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "3",
            "2,000"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5814,
      "char_delta": -125,
      "word_delta": -16,
      "rewrite_ratio": 0.6418,
      "drift_flags": []
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `none`.
```json
{
  "fix_before": [],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "you'll unlock a smoother, clearer, and more authentic writing experience"
      ]
    },
    {
      "rule": "R17_emoji",
      "title": "emoji decoration",
      "count": 1,
      "evidence": [
        "✨"
      ]
    },
    {
      "rule": "R19_chat_artifact",
      "title": "collaborative/chat artifact",
      "count": 1,
      "evidence": [
        "Welcome to"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R19_chat_artifact",
      "title": "collaborative/chat artifact",
      "count": 1,
      "evidence": [
        "Welcome to"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R19_chat_artifact",
      "title": "collaborative/chat artifact",
      "count": 1,
      "evidence": [
        "Welcome to"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "product onboarding UI",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "unknown",
      "unknown"
    ],
    "matches_metadata": false
  },
  "oracle_diagnostic": {
    "should_change": "Keep button labels, route, and limits exact; reduce marketing certainty and make the UI instruction scan quickly.",
    "category": "benchmark/judge uncertainty",
    "detectability": "Analyzer catches emoji and promotional language only at a coarse level; it has no UI microcopy density metric.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline was judged cleaner in the original pass.",
    "diagnosis": "The result is close. Any preference here is likely sensitive to short-copy taste and judge framing rather than a clear system failure."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### internal_project_memo
Genre metadata: `internal project memo`; condition: `ai`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
TextSlopBench v1 represents a pivotal foundation for our broader quality initiative. The proposal includes fixture writing, evaluator calibration, and stakeholder alignment. Despite several challenges, the project remains well positioned to succeed. Mina owns the first review pass, due October 3, with a budget of $1,200 and a target turnaround of 48 hours. The team will also recruit four reviewers. Exciting times lie ahead.
```

#### Exact FixMySlop output
```text
TextSlopBench v1 is the foundation for our quality initiative. The proposal covers fixture writing, evaluator calibration, and stakeholder alignment. Mina owns the first review pass, due October 3. The budget is $1,200, with a target turnaround of 48 hours. The team will also recruit four reviewers.
```

#### Exact baseline Humanizer output
```text
TextSlopBench v1 is one part of our quality initiative. The proposal covers fixture writing, evaluator calibration, and stakeholder alignment. Mina owns the first review pass, due October 3, with a budget of $1,200 and a target turnaround of 48 hours. The team will recruit four reviewers. We still have a few challenges to work through.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "internal_project_memo",
    "choice": "A",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 4,
    "note": "A is the cleaner memo and keeps the actionable details; B weakens the project claim and reintroduces a generic challenge line.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "internal_project_memo",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A preserves the memo structure and key operational details better, while B weakens the project's role and adds a more tentative ending.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "internal_project_memo",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is the stronger memo: concise, direct, and free of promotional filler. B retains the challenge note but weakens the project's status with 'one part' and ends in a less decisive tone.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "internal_project_memo",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B removes the hype while preserving the unresolved challenges and all planning details. A is clean but drops the challenges entirely and makes the initiative sound more definitive than the source.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "internal_project_memo",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 3.0,
    "reason": "A keeps the memo grounded and retains the note about ongoing challenges, while B is tidy but leaves out that part of the source.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "internal_project_memo",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A removes the inflated foundation claim while retaining the practical challenge note and all key logistics. B keeps the source's foundation framing and omits the challenges.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "internal_project_memo",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A keeps every operational commitment and candidly retains the unresolved challenges; B preserves inflated foundation language and omits that constraint.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 23,
    "normalized_word_edit_distance": 0.3594,
    "char_edit_distance": 146,
    "normalized_char_edit_distance": 0.3419,
    "content_retention_jaccard": 0.6667,
    "source_word_count": 64,
    "candidate_word_count": 47,
    "word_delta": -17,
    "length_ratio": 0.7344,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "TextSlopBench v1",
            "Mina",
            "October 3",
            "$1,200",
            "48 hours",
            "four reviewers"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "3",
            "1,200",
            "48"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6667,
      "char_delta": -127,
      "word_delta": -17,
      "rewrite_ratio": 0.7026,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 27,
    "normalized_word_edit_distance": 0.4219,
    "char_edit_distance": 160,
    "normalized_char_edit_distance": 0.3747,
    "content_retention_jaccard": 0.5517,
    "source_word_count": 64,
    "candidate_word_count": 56,
    "word_delta": -8,
    "length_ratio": 0.875,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "TextSlopBench v1",
            "Mina",
            "October 3",
            "$1,200",
            "48 hours",
            "four reviewers"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "3",
            "1,200",
            "48"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5517,
      "char_delta": -90,
      "word_delta": -8,
      "rewrite_ratio": 0.7892,
      "drift_flags": []
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `ai_vocabulary, copula_avoidance, generic_conclusion`.
```json
{
  "fix_before": [
    {
      "family": "copula_avoidance",
      "severity": 1,
      "start": 17,
      "end": 29,
      "evidence": "represents a",
      "message": "elaborate substitute for a simple verb"
    },
    {
      "family": "ai_vocabulary",
      "severity": 1,
      "start": 30,
      "end": 37,
      "evidence": "pivotal",
      "message": "context-sensitive formulaic vocabulary"
    },
    {
      "family": "generic_conclusion",
      "severity": 2,
      "start": 402,
      "end": 426,
      "evidence": "Exciting times lie ahead",
      "message": "generic positive ending"
    }
  ],
  "fix_remaining": [],
  "baseline_source": [
    {
      "rule": "R01_significance_inflation",
      "title": "undue significance",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R06_challenges_future",
      "title": "outline-like challenges/future",
      "count": 1,
      "evidence": [
        "Despite several challenges"
      ]
    },
    {
      "rule": "R07_ai_vocabulary",
      "title": "formulaic AI vocabulary",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R08_copula_avoidance",
      "title": "copula avoidance",
      "count": 1,
      "evidence": [
        "represents a"
      ]
    },
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "The proposal includes fixture writing, evaluator calibration, and stakeholder alignment"
      ]
    },
    {
      "rule": "R24_generic_conclusion",
      "title": "generic conclusion",
      "count": 1,
      "evidence": [
        "Exciting times lie ahead"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "The proposal covers fixture writing, evaluator calibration, and stakeholder alignment"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R10_rule_of_three",
      "title": "rule of three / list rhythm",
      "count": 1,
      "evidence": [
        "The proposal covers fixture writing, evaluator calibration, and stakeholder alignment"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "internal project memo",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "internal project memo",
      "concise action-oriented internal memo"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Remove inflated foundation language and generic optimism while retaining owner, deadline, budget, turnaround, reviewer count, and actionable scope.",
    "category": "benchmark/judge uncertainty",
    "detectability": "Analyzer correctly flags significance inflation and generic conclusion; it does not judge whether a memo's remaining challenge sentence is useful or generic.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline rephrases the scope more aggressively.",
    "diagnosis": "Fix preserves the plan and removes the strongest slop. The original 6–6 outcome is not enough to call the remaining memo difference a reliable loss."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### interview_transcript
Genre metadata: `interview transcript`; condition: `human`; prior judge winner: `humanizer/host-agent`.

#### Exact source
```text
Interviewer: Could you explain the pilot?
Ravi: Certainly. The pilot was a pivotal learning experience that enabled us to identify several meaningful opportunities for improvement. We encountered challenges, but it was not merely a failure; it was a foundation for future progress.
Interviewer: What changed?
Ravi: Honestly, the first version was slow. We cut the dashboard from 14 widgets to 5, and people actually used it.
```

#### Exact FixMySlop output
```text
Interviewer: Could you explain the pilot?
Ravi: The pilot helped us find several areas to improve. We ran into challenges, but it wasn't just a failure; it gave us a starting point for future work.
Interviewer: What changed?
Ravi: Honestly, the first version was slow. We cut the dashboard from 14 widgets to 5, and people actually used it.
```

#### Exact baseline Humanizer output
```text
Interviewer: Could you explain the pilot?
Ravi: Sure. It taught us what needed fixing. We ran into problems, but calling it a failure would be too simple. It showed us where to focus next.
Interviewer: What changed?
Ravi: Honestly, the first version was slow. We cut the dashboard from 14 widgets to 5, and people actually used it.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "interview_transcript",
    "choice": "B",
    "naturalness": 5,
    "quality": 5,
    "fidelity": 4,
    "voice": 5,
    "note": "More conversational and better matched to Ravi's candid speaking voice.",
    "a_system": "FixMySlop:Humanizer/host-agent",
    "b_system": "humanizer/host-agent",
    "winner": "humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "interview_transcript",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A keeps Ravi's somewhat formal, reflective tone from the source, whereas B makes him sound more casual and more heavily rewritten.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 3.0
      }
    }
  },
  {
    "fixture_id": "interview_transcript",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 3.0,
    "reason": "Both are strong and faithful. B sounds slightly more like spontaneous speech, especially in 'calling it a failure would be too simple,' while preserving Ravi's meaning and the unchanged concrete answer.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "interview_transcript",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B sounds like a person answering an interviewer, with direct phrasing that retains the lesson and the setback. A improves the source but still has the formulaic 'wasn't just a failure' construction.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "interview_transcript",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A sounds more like a real spoken answer in an interview and fits Ravi's register better, while still preserving the original meaning.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "interview_transcript",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 5.0,
    "reason": "A sounds like an actual spoken answer, with specific and appropriately modest phrasing. B is clear but more polished and generic than the conversational voice calls for.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "interview_transcript",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A sounds more like a person speaking in an interview and removes the formulaic contrast while preserving the lesson; B is faithful but still slightly scripted.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 4.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 24,
    "normalized_word_edit_distance": 0.3636,
    "char_edit_distance": 129,
    "normalized_char_edit_distance": 0.3042,
    "content_retention_jaccard": 0.5091,
    "source_word_count": 66,
    "candidate_word_count": 59,
    "word_delta": -7,
    "length_ratio": 0.8939,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Interviewer:",
            "Ravi:",
            "14 widgets to 5",
            "Honestly, the first version was slow."
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "14",
            "5"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.5091,
      "char_delta": -84,
      "word_delta": -7,
      "rewrite_ratio": 0.8019,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 33,
    "normalized_word_edit_distance": 0.5,
    "char_edit_distance": 170,
    "normalized_char_edit_distance": 0.4009,
    "content_retention_jaccard": 0.4138,
    "source_word_count": 66,
    "candidate_word_count": 58,
    "word_delta": -8,
    "length_ratio": 0.8788,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Interviewer:",
            "Ravi:",
            "14 widgets to 5",
            "Honestly, the first version was slow."
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "14",
            "5"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.4138,
      "char_delta": -93,
      "word_delta": -8,
      "rewrite_ratio": 0.7807,
      "drift_flags": [
        "low_content_overlap"
      ]
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `ai_vocabulary`.
```json
{
  "fix_before": [
    {
      "family": "ai_vocabulary",
      "severity": 1,
      "start": 75,
      "end": 82,
      "evidence": "pivotal",
      "message": "context-sensitive formulaic vocabulary"
    },
    {
      "family": "false_range",
      "severity": 1,
      "start": 374,
      "end": 423,
      "evidence": "from 14 widgets to 5, and people actually used it",
      "message": "range may be rhetorical rather than scalar"
    }
  ],
  "fix_remaining": [
    {
      "family": "false_range",
      "severity": 1,
      "start": 290,
      "end": 339,
      "evidence": "from 14 widgets to 5, and people actually used it",
      "message": "range may be rhetorical rather than scalar"
    }
  ],
  "baseline_source": [
    {
      "rule": "R01_significance_inflation",
      "title": "undue significance",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R07_ai_vocabulary",
      "title": "formulaic AI vocabulary",
      "count": 1,
      "evidence": [
        "pivotal"
      ]
    },
    {
      "rule": "R09_negative_parallelism",
      "title": "negative parallelism",
      "count": 1,
      "evidence": [
        "it was not merely"
      ]
    },
    {
      "rule": "R12_false_range",
      "title": "false range",
      "count": 1,
      "evidence": [
        "from 14 widgets to 5, and people actually used it"
      ]
    }
  ],
  "baseline_remaining": [
    {
      "rule": "R12_false_range",
      "title": "false range",
      "count": 1,
      "evidence": [
        "from 14 widgets to 5, and people actually used it"
      ]
    }
  ],
  "fix_rules_remaining": [
    {
      "rule": "R12_false_range",
      "title": "false range",
      "count": 1,
      "evidence": [
        "from 14 widgets to 5, and people actually used it"
      ]
    }
  ]
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "interview transcript",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "interview transcript",
      "conversational dialogue"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Make Ravi sound spoken and candid, not like an edited corporate summary; keep speaker labels and the 14-to-5 measurement.",
    "category": "genre/register miss",
    "detectability": "Analyzer catches pivotal/significance language and negative parallelism, but it does not model dialogue naturalness, turn-taking, or spoken compression.",
    "baseline_issue": "No confirmed exact-fidelity failure; baseline wins through more idiomatic spoken phrasing.",
    "diagnosis": "Fix sees some surface issues but rewrites them into another polished abstraction. This is the clearest case of rewrite-policy plus register failure, not a missing fidelity permission."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

### bilingual_customer_review
Genre metadata: `customer review`; condition: `human`; prior judge winner: `FixMySlop:Humanizer/host-agent`.

#### Exact source
```text
I visited Bramble Chai at 7:30 p.m. and the tea was genuinely lovely, especially the ginger blend. The app kept logging me out, though, so ordering was annoying. Thik hai for the price, but I would not use it for a daily commute. Overall this was a solid and memorable experience. Rating: 3/5.
```

#### Exact FixMySlop output
```text
I visited Bramble Chai at 7:30 p.m., and the tea was genuinely lovely, especially the ginger blend. The app kept logging me out, though, so ordering was annoying. Thik hai for the price, but I would not use it for a daily commute. Overall, it was a solid experience, though the app needs work. Rating: 3/5.
```

#### Exact baseline Humanizer output
```text
I visited Bramble Chai at 7:30 p.m., and the tea was lovely, especially the ginger blend. The app kept logging me out, though, so ordering was a pain. Thik hai for the price, but I wouldn't use it for a daily commute. Good tea, bad app. Rating: 3/5.
```

#### Judge reasoning
Original smoke-test judgment:
```json
[
  {
    "id": "bilingual_customer_review",
    "choice": "B",
    "naturalness": 4,
    "quality": 4,
    "fidelity": 5,
    "voice": 4,
    "note": "B preserves the mixed review and source wording; A sharpens it but changes the complaint and drops memorable.",
    "a_system": "humanizer/host-agent",
    "b_system": "FixMySlop:Humanizer/host-agent",
    "winner": "FixMySlop:Humanizer/host-agent"
  }
]
```
Expanded counterbalanced judgments:
```json
[
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "orig",
    "model": "gpt-5.4",
    "source_file": "audit2_orig_1.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 5.0,
    "reason": "B keeps the original balance and phrasing more faithfully, while A adds a punchier closing that shifts the tone and summary.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "orig",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_orig_2.jsonl",
    "choice": "B",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B preserves the review's specific details, mixed assessment, and rating while sounding more natural; A's compressed 'Good tea, bad app' line is blunter and drops the memorable-experience point.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 5.0,
        "voice": 5.0
      }
    }
  },
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "orig",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_orig_3.jsonl",
    "choice": "A",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A is crisper and more conversational while retaining the review's mixed verdict; B keeps more of the source wording but ends in a more generic, less memorable summary.",
    "scores": {
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 4.0,
        "voice": 5.0
      },
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "rev",
    "model": "gpt-5.4",
    "source_file": "audit2_rev_1.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 3.0,
    "reason": "A preserves more of the original balance and closing sentiment, while B is punchier but drops some nuance and shifts the tone slightly.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "rev",
    "model": "gpt-5.6-luna",
    "source_file": "audit2_rev_2.jsonl",
    "choice": "A",
    "winner": "FixMySlop:Humanizer/host-agent",
    "confidence": 4.0,
    "reason": "A preserves the review's overall assessment and the reasonable-for-price nuance, while B is punchier but drops the memorable-experience point and sharpens the complaint.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 4.0,
        "fidelity": 3.0,
        "voice": 4.0
      }
    }
  },
  {
    "fixture_id": "bilingual_customer_review",
    "orientation": "rev",
    "model": "gpt-5.6-terra",
    "source_file": "audit2_rev_3.jsonl",
    "choice": "B",
    "winner": "humanizer/host-agent",
    "confidence": 4.0,
    "reason": "B has the more believable, compact review voice; its closing lands cleanly, though it drops some of the source's overall positive framing.",
    "scores": {
      "FixMySlop:Humanizer/host-agent": {
        "naturalness": 4.0,
        "quality": 4.0,
        "fidelity": 4.0,
        "voice": 4.0
      },
      "humanizer/host-agent": {
        "naturalness": 5.0,
        "quality": 5.0,
        "fidelity": 3.0,
        "voice": 5.0
      }
    }
  }
]
```

#### Metrics
```json
{
  "fixmyslop": {
    "word_edit_distance": 7,
    "normalized_word_edit_distance": 0.125,
    "char_edit_distance": 36,
    "normalized_char_edit_distance": 0.1229,
    "content_retention_jaccard": 0.8919,
    "source_word_count": 56,
    "candidate_word_count": 59,
    "word_delta": 3,
    "length_ratio": 1.0536,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Bramble Chai",
            "7:30 p.m.",
            "Thik hai",
            "ginger blend",
            "3/5"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "7",
            "30",
            "3",
            "5"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.8919,
      "char_delta": 13,
      "word_delta": 3,
      "rewrite_ratio": 1.0444,
      "drift_flags": []
    }
  },
  "baseline_humanizer": {
    "word_edit_distance": 13,
    "normalized_word_edit_distance": 0.2321,
    "char_edit_distance": 58,
    "normalized_char_edit_distance": 0.198,
    "content_retention_jaccard": 0.6667,
    "source_word_count": 56,
    "candidate_word_count": 51,
    "word_delta": -5,
    "length_ratio": 0.9107,
    "fidelity": {
      "fidelity_version": "0.1.0",
      "passed": true,
      "exact_check_score": 100.0,
      "checks": [
        {
          "name": "protected_spans",
          "required": [
            "Bramble Chai",
            "7:30 p.m.",
            "Thik hai",
            "ginger blend",
            "3/5"
          ],
          "missing": [],
          "passed": true
        },
        {
          "name": "urls",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "dates",
          "required": [],
          "missing": [],
          "passed": true
        },
        {
          "name": "numbers",
          "required": [
            "7",
            "30",
            "3",
            "5"
          ],
          "missing": [],
          "passed": true
        }
      ],
      "content_word_jaccard": 0.6667,
      "char_delta": -44,
      "word_delta": -5,
      "rewrite_ratio": 0.8498,
      "drift_flags": []
    }
  }
}
```

#### Triggered rules/findings
FixMySlop resolved families: `none`.
```json
{
  "fix_before": [],
  "fix_remaining": [],
  "baseline_source": [],
  "baseline_remaining": [],
  "fix_rules_remaining": []
}
```

#### Genre/register and oracle diagnosis
```json
{
  "genre_register_audit": {
    "current_benchmark_argument": "customer review",
    "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
    "heuristic_inference": [
      "customer review",
      "personal evaluative prose"
    ],
    "matches_metadata": true
  },
  "oracle_diagnostic": {
    "should_change": "Keep the code-switch, mixed sentiment, specific ginger detail, login complaint, and rating; remove only generic summary language.",
    "category": "fidelity constraint too strong",
    "detectability": "Analyzer does not need to change the core facts; it has no explicit code-switch or review-voice metric.",
    "baseline_issue": "Baseline changes 'annoying' to 'a pain' and drops the explicit 'memorable' wording; both are acceptable but demonstrate unnecessary voice movement.",
    "diagnosis": "Fix wins by preserving the user's distinctive details and sentiment. Higher retention is clearly beneficial here."
  },
  "agent_context_audit": {
    "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
    "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
    "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step."
  }
}
```

## Em dash and curly-quote audit

The local pipeline protects quoted interiors before finalization. In the incident fixture, the editable dash in `failure—it` is reframed as a comma, while the protected quoted testimony retains its interior punctuation. In the support fixture, the editable closing dash is removed with the chat closing. The source release, policy, social, and recipe cases contain no protected quote that should be rewritten. The policy is structural in intent, but the current implementation is still a lightweight contextual substitution and should not yet be treated as a full syntactic rewriter.

## Boundary of this analysis

The machine-readable file contains the full humanstats before/after objects and exact text. Human judgments, especially on six close cases, need the expanded counterbalanced evaluation in BENCHMARK_AUDIT.md before they can justify a skill change.
