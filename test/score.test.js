import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreStep, LOOP_STEPS, LOOP_DURATION, STEP_DURATION, BPM } from '../src/score.js';

test('rock arrangement develops over 64 bars and loops after 106.67 seconds',()=>{
  assert.equal(BPM,144);assert.equal(LOOP_STEPS,1024);
  assert(Math.abs(LOOP_DURATION-106.6666667)<.0001);
  const sections=new Set(),voices=new Set();
  for(let step=0;step<LOOP_STEPS;step++) {
    const event=scoreStep(step);sections.add(event.section);
    for(const note of event.events) {
      voices.add(note.voice);
      if(note.note!==undefined)assert(Number.isFinite(note.note));
      if(note.duration!==undefined)assert(note.duration>0);
    }
    assert.deepEqual(event,scoreStep(step+LOOP_STEPS));
  }
  assert.deepEqual(sections,new Set(['intro','verse','chorus','breakdown','solo','outro']));
  for(const voice of ['guitar','bass','lead','kick','snare','hat','crash','tom'])assert(voices.has(voice),voice);
  assert.notDeepEqual(scoreStep(16*5),scoreStep(16*21));
  assert.equal(STEP_DURATION,60/144/4);
});
