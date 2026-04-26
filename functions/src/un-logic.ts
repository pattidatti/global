/**
 * Pure helpers for un.ts (FN-møte) — testbar uten RTDB.
 */

export interface ValidatedAgenda {
  ok: true;
  agenda: string;
  options: string[];
}
export interface InvalidAgenda {
  ok: false;
  reason: 'agenda_too_short' | 'agenda_too_long' | 'too_few_options' | 'too_many_options' | 'option_invalid';
}
export type AgendaValidationResult = ValidatedAgenda | InvalidAgenda;

const AGENDA_MIN = 5;
const AGENDA_MAX = 500;
const OPTION_MIN = 2;
const OPTION_MAX = 4;
const OPTION_TEXT_MIN = 1;
const OPTION_TEXT_MAX = 80;

export function validateAgenda(agenda: unknown, options: unknown): AgendaValidationResult {
  const trimmed = typeof agenda === 'string' ? agenda.trim() : '';
  if (trimmed.length < AGENDA_MIN) return { ok: false, reason: 'agenda_too_short' };
  if (trimmed.length > AGENDA_MAX) return { ok: false, reason: 'agenda_too_long' };

  if (!Array.isArray(options)) return { ok: false, reason: 'too_few_options' };
  if (options.length < OPTION_MIN) return { ok: false, reason: 'too_few_options' };
  if (options.length > OPTION_MAX) return { ok: false, reason: 'too_many_options' };

  const cleaned: string[] = [];
  for (const opt of options) {
    if (typeof opt !== 'string') return { ok: false, reason: 'option_invalid' };
    const t = opt.trim();
    if (t.length < OPTION_TEXT_MIN || t.length > OPTION_TEXT_MAX) {
      return { ok: false, reason: 'option_invalid' };
    }
    cleaned.push(t);
  }

  return { ok: true, agenda: trimmed, options: cleaned };
}

export interface VoteSummary {
  counts: number[];
  total: number;
  winningIndex: number;          // -1 hvis ingen stemmer
}

export function summarizeVotes(
  votes: Record<string, number> | undefined | null,
  optionCount: number,
): VoteSummary {
  const counts = new Array<number>(optionCount).fill(0);
  let total = 0;
  if (votes) {
    for (const idx of Object.values(votes)) {
      if (typeof idx === 'number' && idx >= 0 && idx < optionCount) {
        counts[idx] += 1;
        total += 1;
      }
    }
  }
  let winningIndex = -1;
  let max = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > max) {
      max = counts[i];
      winningIndex = i;
    }
  }
  return { counts, total, winningIndex };
}
