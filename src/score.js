// 64 bars at 144 BPM: 1 minute 46.67 seconds, played on a sample-accurate clock.
export const BPM = 144;
export const STEP_DURATION = 60 / BPM / 4;
export const LOOP_STEPS = 64 * 16;
export const LOOP_DURATION = LOOP_STEPS * STEP_DURATION;
export const midi = n => 440 * 2 ** ((n - 69) / 12);

const verse = [40,40,43,45,40,40,47,43,40,43,45,45,48,47,43,38];
const chorus = [48,43,45,40,48,43,50,47,48,43,45,40,41,43,47,47];
const leadPhrases = [
  [0,7,12,10,7,3,5,7,0,7,10,12,15,14,12,7],
  [12,10,7,5,3,5,7,10,12,15,14,12,10,7,5,3],
  [7,10,12,19,17,15,14,12,10,12,14,15,12,10,7,5],
  [0,3,5,7,10,7,5,3,7,10,12,14,15,19,17,12],
];

export function scoreStep(absoluteStep) {
  const step = ((absoluteStep % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const bar = Math.floor(step / 16), beat = step % 16;
  const section = bar < 4 ? 'intro' : bar < 20 ? 'verse' : bar < 36 ? 'chorus' : bar < 44 ? 'breakdown' : bar < 60 ? 'solo' : 'outro';
  const heavy = section === 'chorus' || section === 'solo';
  const roots = heavy ? chorus : verse;
  const root = roots[(bar - (heavy ? 20 : 4) + 32) % roots.length];
  const events = [];
  const add = (voice, extra = {}) => events.push({ voice, ...extra });
  // Syncopated low-string chugs open into sustained power chords in the chorus.
  const riff = section === 'breakdown' ? [0,3,6,10] : heavy ? [0,4,6,8,12,14] : [0,2,3,6,8,10,12,15];
  if (riff.includes(beat)) {
    const accent = beat === 0 || (heavy && beat === 8);
    const riffNote = root + ((!heavy && beat === 15) ? 3 : 0);
    add('guitar', { note: riffNote, duration: accent && heavy ? .37 : .11, volume: accent ? .12 : .085, wide: heavy });
    if (beat % 2 === 0 || section === 'breakdown') add('bass', { note: riffNote - 12, duration: .18, volume: .12 });
  }
  const kicks = section === 'breakdown' ? [0,3,6,10] : heavy ? [0,2,6,8,10,14] : [0,6,8,11];
  if (kicks.includes(beat)) add('kick');
  if (beat === 4 || beat === 12) add('snare');
  if (beat % 2 === 0 && !(section === 'intro' && bar < 2)) add('hat', { open: heavy && beat === 14, volume: beat % 4 === 0 ? .038 : .025 });
  if ((bar % 4 === 0 && beat === 0) || ([20,36,44,60].includes(bar) && beat === 0)) add('crash');
  // Alternating phrases, octave changes, fills and a denser solo develop the long loop.
  if ((heavy || (section === 'verse' && bar % 4 >= 2)) && beat % (section === 'solo' ? 1 : 2) === 0) {
    const phrase = leadPhrases[Math.floor(bar / 2) % 4];
    const index = (Math.floor(beat / (section === 'solo' ? 1 : 2)) + (bar % 2) * 8) % 16;
    add('lead', { note: 64 + phrase[index] + (section === 'solo' && bar % 4 === 3 ? 12 : 0), duration: section === 'solo' ? .12 : .26, volume: section === 'solo' ? .045 : .035 });
  }
  if (bar % 4 === 3 && beat >= 13) add(beat % 2 ? 'tom' : 'snare', { note: beat === 15 ? 43 : 48 });
  if (section === 'outro' && beat === 0) add('lead', { note: [76,74,71,64][bar - 60], duration: .9, volume: .05 });
  return { bar, beat, section, events };
}
