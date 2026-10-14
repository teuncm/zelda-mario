import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { runGameChecks } from './check-survival.mjs';

const artifacts=resolve('.artifacts');
await mkdir(artifacts,{recursive:true});
const chrome=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--mute-audio','--disable-gpu','--no-sandbox','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=9233',`--user-data-dir=${resolve(artifacts,`chrome-profile-${Date.now()}`)}`,'about:blank',
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let browserLog='';chrome.stderr.on('data',chunk=>{browserLog+=chunk;});
chrome.on('exit',code=>{if(code)console.error('Chrome exited:',code,browserLog.slice(-2000));});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
const keepAlive=setInterval(()=>{},1000);
try {
  let pages;
  for(let i=0;i<50;i++) {try{pages=await(await fetch('http://127.0.0.1:9233/json')).json();break;}catch{await delay(100);}}
  assert(pages?.length,'Chrome debugging connection');
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let nextId=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.id){const p=pending.get(data.id);pending.delete(data.id);if(data.error)p.reject(data.error);else p.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text+': '+data.params.exceptionDetails.exception?.description);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timeout=setTimeout(()=>reject(new Error(`Timed out: ${method}`)),30000);pending.set(id,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:value=>{clearTimeout(timeout);reject(value);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await delay(25);}assert.fail(`Condition did not settle: ${expression}`);};
  await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const screenshot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(artifacts,name),Buffer.from(result.data,'base64'));};
  const result=await runGameChecks({send,evaluate,delay,screenshot,waitFor});
  assert.deepEqual(errors,[],'No runtime exceptions');
  console.log(JSON.stringify({...result,screenshots:artifacts},null,2));
  await send('Browser.close');
} finally {clearInterval(keepAlive);if(ws?.readyState===WebSocket.OPEN)ws.close();chrome.kill();}
