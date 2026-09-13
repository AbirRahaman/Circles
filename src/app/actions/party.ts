/* Superseded by src/app/actions/tallies.ts.
 *
 * This file previously held a purpose-built counter with fixed labels. It has
 * been replaced by the generic Tally, whose title is free text and which ships
 * no presets, defaults or status vocabulary. Nothing imports this module; it is
 * kept only so the deletion is a deliberate commit rather than a silent one.
 *
 * Safe to remove:  git rm src/app/actions/party.ts
 */
export {};
