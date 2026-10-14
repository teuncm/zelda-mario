import { scoreStep, midi, STEP_DURATION, LOOP_STEPS } from './score.js';

// Original rock arrangement: distorted power chords, bass, lead, and a full drum kit.
export class RockAudio {
  constructor() {
    this.enabled = true; this.active = false; this.ctx = null; this.timer = null;
    this.step = 0; this.nextNote = 0; this.session = 0;
  }
  setupGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = .58;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 14;
    compressor.ratio.value = 5; compressor.attack.value = .003; compressor.release.value = .13;
    this.master.connect(compressor); compressor.connect(ctx.destination);
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    this.distortion = new Float32Array(2048);
    for (let i = 0; i < this.distortion.length; i++) {
      const x = i * 2 / (this.distortion.length - 1) - 1;
      this.distortion[i] = Math.tanh(x * 5);
    }
  }
  async start() {
    if (!this.enabled) return;
    this.active = true;
    const session = ++this.session;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.setupGraph();
    }
    await this.ctx.resume();
    // A quick mute/pause can arrive while resume is still pending in the browser.
    if (!this.active || !this.enabled) { await this.ctx.suspend(); return; }
    if (session !== this.session) return;
    this.master.gain.setValueAtTime(.58,this.ctx.currentTime);
    if (this.timer) return;
    this.nextNote = Math.max(this.nextNote, this.ctx.currentTime + .025);
    this.schedule(); this.timer = setInterval(() => this.schedule(), 25);
  }
  envelope(time, duration, volume, attack = .004) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, time + Math.max(duration, attack + .01));
    return gain;
  }
  note(frequency, time, duration, volume = .05, type = 'sine', destination = this.master) {
    if (!this.ctx || !this.enabled) return;
    const oscillator = this.ctx.createOscillator(), gain = this.envelope(time, duration, volume);
    oscillator.type = type; oscillator.frequency.value = frequency;
    oscillator.connect(gain); gain.connect(destination);
    oscillator.start(time); oscillator.stop(time + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  guitar(event, time) {
    const distortion = this.ctx.createWaveShaper(), filter = this.ctx.createBiquadFilter();
    distortion.curve = this.distortion; distortion.oversample = '2x';
    filter.type = 'lowpass'; filter.frequency.value = event.wide ? 3200 : 1950; filter.Q.value = .65;
    const gain = this.envelope(time, event.duration + .05, event.volume, .005);
    distortion.connect(filter); filter.connect(gain); gain.connect(this.master);
    const notes = [event.note, event.note + 7, event.note + 12];
    notes.forEach((note, index) => {
      const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = midi(note); osc.detune.value = index % 2 ? -5 : 5;
      osc.connect(distortion); osc.start(time); osc.stop(time + event.duration + .08);
      osc.onended = () => { osc.disconnect(); if(index===2){distortion.disconnect();filter.disconnect();gain.disconnect();} };
    });
  }
  noise(time, duration, volume, frequency, type = 'highpass') {
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter();
    source.buffer = this.noiseBuffer; source.loop=duration>this.noiseBuffer.duration; filter.type = type; filter.frequency.value = frequency;
    const gain = this.envelope(time, duration, volume);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    source.start(time); source.stop(time + duration + .02);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  playStep(step, time) {
    for (const event of scoreStep(step).events) {
      if (event.voice === 'guitar') this.guitar(event, time);
      else if (event.voice === 'bass') {
        this.note(midi(event.note), time, event.duration, event.volume, 'triangle');
        this.note(midi(event.note + 12), time, event.duration, .025, 'sawtooth');
      } else if (event.voice === 'lead') {
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2800;
        filter.connect(this.master);
        const osc = this.ctx.createOscillator(), vibrato = this.ctx.createOscillator(), depth = this.ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = midi(event.note);
        vibrato.frequency.value = 5.5; depth.gain.value = 9;
        vibrato.connect(depth); depth.connect(osc.detune);
        const gain = this.envelope(time, event.duration, event.volume, .012);
        osc.connect(gain); gain.connect(filter);
        osc.start(time); vibrato.start(time); osc.stop(time + event.duration + .03); vibrato.stop(time + event.duration + .03);
        osc.onended = () => { osc.disconnect(); vibrato.disconnect(); depth.disconnect(); gain.disconnect(); filter.disconnect(); };
        // A quieter eighth-note slapback gives the lead depth without washing out the riff.
        this.note(midi(event.note), time + STEP_DURATION * 3, event.duration * .8, event.volume * .16, 'triangle');
      } else if (event.voice === 'kick') {
        const osc = this.ctx.createOscillator(), gain = this.envelope(time, .22, .62, .002);
        osc.frequency.setValueAtTime(155,time); osc.frequency.exponentialRampToValueAtTime(44,time+.16);
        osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time+.25);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        this.noise(time,.018,.06,1800);
      } else if (event.voice === 'snare') {
        this.noise(time,.15,.22,1300,'highpass'); this.note(175,time,.1,.11,'triangle');
      } else if (event.voice === 'hat') this.noise(time,event.open?.19:.045,event.volume,6500);
      else if (event.voice === 'crash') this.noise(time,.85,.085,4200);
      else if (event.voice === 'tom') this.note(midi(event.note),time,.18,.2,'sine');
    }
  }
  schedule() {
    if (!this.active || !this.enabled) return;
    // Recover from a stalled tab without firing a backlog of notes.
    if(this.nextNote<this.ctx.currentTime-.2)this.nextNote=this.ctx.currentTime+.025;
    while (this.nextNote < this.ctx.currentTime + .14) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += STEP_DURATION; this.step = (this.step + 1) % LOOP_STEPS;
    }
  }
  pickup() { if(this.ctx) [84,88,91,96].forEach((n,i)=>this.note(midi(n),this.ctx.currentTime+i*.045,.23,.09,'triangle')); }
  skull() { if(this.ctx) [52,59,64].forEach((n,i)=>this.note(midi(n),this.ctx.currentTime+i*.045,.22,.13,'square')); }
  upgrade() { if(this.ctx) [40,47,52,59,64,71,76].forEach((n,i)=>this.note(midi(n),this.ctx.currentTime+i*.07,.45,.1,'sawtooth')); }
  slash() { if(this.ctx&&this.enabled) { this.noise(this.ctx.currentTime,.075,.15,2200); this.note(330,this.ctx.currentTime,.08,.09,'sawtooth'); } }
  hit(killed=false) { if(this.ctx&&this.enabled) {this.noise(this.ctx.currentTime,.1,.22,700,'lowpass');this.note(killed?58:105,this.ctx.currentTime,.18,.23,'triangle');} }
  explosion() {
    if(!this.ctx||!this.enabled)return;
    const time=this.ctx.currentTime;
    this.noise(time,.65,.38,850,'lowpass');this.noise(time,.14,.18,1800,'highpass');
    const osc=this.ctx.createOscillator(),gain=this.envelope(time,.6,.5,.002);
    osc.frequency.setValueAtTime(140,time);osc.frequency.exponentialRampToValueAtTime(26,time+.45);
    osc.connect(gain);gain.connect(this.master);osc.start(time);osc.stop(time+.64);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
    this.note(52,time+.04,.5,.18,'triangle');
  }
  fireCast() {
    if(!this.ctx||!this.enabled)return;const time=this.ctx.currentTime;
    this.noise(time,.3,.25,900,'highpass');this.noise(time+.05,1.9,.065,1600,'highpass');
    [110,165,220].forEach((f,i)=>this.note(f,time+i*.055,.3,.12,'sawtooth'));
  }
  playerHit() {if(this.ctx&&this.enabled){this.noise(this.ctx.currentTime,.1,.17,800,'bandpass');this.note(73,this.ctx.currentTime,.25,.2,'square');}}
  heal(){if(this.ctx&&this.enabled)[72,79,84].forEach((n,i)=>this.note(midi(n),this.ctx.currentTime+i*.07,.4,.1,'sine'));}
  radial(){if(this.ctx&&this.enabled){this.noise(this.ctx.currentTime,.13,.13,3800);this.note(660,this.ctx.currentTime,.15,.07,'triangle');}}
  nuclear(){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;this.noise(t,2,.45,600,'lowpass');this.noise(t,.25,.25,2000);[38,55,82].forEach((f,i)=>this.note(f,t+i*.04,1.8,.18,'sawtooth'));}
  gameOver(){
    clearInterval(this.timer);this.timer=null;this.active=false;this.session++;
    if(!this.ctx||!this.enabled)return;
    const t=this.ctx.currentTime;this.master.gain.setValueAtTime(.58,t);
    [64,59,55,52,40].forEach((n,i)=>{this.note(midi(n),t+i*.25,.65,.18,'sawtooth');this.note(midi(n-12),t+i*.25,.7,.15,'triangle');});
    this.noise(t,.7,.15,500,'lowpass');
  }
  setEnabled(enabled) { this.enabled=enabled; if(enabled) this.start().catch(()=>{}); else this.pause(); }
  pause() {
    this.active=false;this.session++;clearInterval(this.timer);this.timer=null;
    if(this.ctx){this.master.gain.setValueAtTime(0,this.ctx.currentTime);this.ctx.suspend();}
  }
}
