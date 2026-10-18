#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { requireSandbox } from "./guard/sandbox.mjs";
import { worldLabel, displayWorld, worldChips } from "../remote-control/world-labels.mjs";
await requireSandbox(import.meta.url);
assert.equal(worldLabel("E", { E: " Research " }), "Research");
for (const labels of [null, [], {}, { E: " " }, { E: 4 }, Object.create({E:"inherited"})]) assert.equal(worldLabel("E", labels), "E");
assert.equal(worldLabel("E", {E:"\u0000\n"}), "E");
assert.equal(worldLabel("E", {E:"x".repeat(200)}).length, 80);
assert.equal(displayWorld({id:"B",label:"Projects"}), "Projects");
const chips=worldChips([{id:"A", label:'<img src=x onerror="evil()">',color:"#fff",shown:true,agents:2},{id:"E",label:"Research",color:"#fff",shown:true},{id:"B",label:"Projects",color:"#fff",shown:false},{id:"C",color:"#fff",shown:true}],"B");
assert(!chips.includes("<img"));assert(chips.includes("&lt;img"));assert(chips.includes('data-w="B"'));assert(chips.includes('aria-current="true"'));assert(chips.includes('aria-label="Projects (B)'));assert(chips.includes('>C</span></button>'));
assert(!worldChips([{id:"D",shown:false}],"E").includes("button"));
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const T=fs.mkdtempSync(path.join(os.tmpdir(),"world-labels-"));
const cfg=path.join(T,"cfg"),state=path.join(T,"state"),run=path.join(T,"run"),home=path.join(T,"home"),sock=path.join(T,"daemon.sock");
for(const d of [path.join(cfg,"hyprpi"),state,run,home])fs.mkdirSync(d,{recursive:true});
const labels={A:"Main",E:"Research",B:"Projects"};
const config={pi:"/bin/cat",roomToThoughts:false,worldLabels:labels};
const conf=path.join(cfg,"hyprpi/config.json");fs.writeFileSync(conf,JSON.stringify(config));
fs.writeFileSync(path.join(cfg,"hyprpi/hyprpi.jsonc"),JSON.stringify({upkeep:{refresh:{enabled:false},autoReload:{enabled:false}}}));
const env={...process.env,HOME:home,HYPRPI_SOCKET:sock,HYPRPI_STATE:state,XDG_CONFIG_HOME:cfg,XDG_STATE_HOME:path.join(T,"xdg"),XDG_RUNTIME_DIR:run,HYPRPI_TEST:"1",HYPRPI_NO_ENSURE:"1",HYPRLAND_INSTANCE_SIGNATURE:"labels-isolated",HYPRPI_REMOTE_DIR:path.join(T,"remote")};
for(const k of ["HYPRPI_AGENT_ID","HYPRPI_WORKSPACE","WAYLAND_DISPLAY","HYPRPI_REMOTE_LINK","HYPRPI_REMOTE_HOME"])delete env[k];
const logs=fs.openSync(path.join(T,"log"),"w");
const daemon=spawn(process.execPath,[path.join(ROOT,"bin/hyprpi"),"daemon"],{env,stdio:["ignore",logs,logs]});
let server,api;
try {
 for(let i=0;i<80&&!fs.existsSync(sock);i++)await new Promise(r=>setTimeout(r,100));
 const {connect}=await import("../lib/client.mjs");api=await connect({path:sock});
 for(const room of ["A","E"])await api.call("room.post",{room,text:`Existing ${room}`,deliver:false});
 const before=await api.call("list");assert(!before.rooms.some(r=>r.id==="B"));
 const created=await api.call("room.post",{room:"B",text:"Projects world created",deliver:false});assert.equal(created.room,"B");
 const after=await api.call("list");assert.deepEqual(after.agents,before.agents);assert.equal(after.rooms.find(r=>r.id==="A").last_seq,1);assert.equal(after.rooms.find(r=>r.id==="E").last_seq,1);assert.equal(after.rooms.find(r=>r.id==="B").last_seq,1);
 assert(!fs.existsSync(path.join(state,"thoughts/B")),"non-delivering room creation must not start Thoughts");
 const port=21000+Math.floor(Math.random()*2000),origin=`http://127.0.0.1:${port}`;
 server=spawn(process.execPath,[path.join(ROOT,"remote-control/server.mjs")],{env:{...env,HYPRPI_REMOTE_PORT:String(port)},stdio:["ignore",logs,logs]});
 let data;for(let i=0;i<80;i++){try{const r=await fetch(origin+"/api/state");if(r.ok){data=await r.json();if(data.worlds.some(w=>w.id==="B"))break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const [id,label]of Object.entries(labels))assert.equal(data.worlds.find(w=>w.id===id)?.label,label);
 const mod=await fetch(origin+"/world-labels.mjs");assert.equal(mod.status,200);assert.match(mod.headers.get("content-type"),/javascript/);
 config.worldLabels.E="Updated label";fs.writeFileSync(conf,JSON.stringify(config));
 data=await(await fetch(origin+"/api/state")).json();assert.equal(data.worlds.find(w=>w.id==="E").label,"Updated label","config hot reload");
 delete config.worldLabels.E;fs.writeFileSync(conf,JSON.stringify(config));data=await(await fetch(origin+"/api/state")).json();assert.equal(data.worlds.find(w=>w.id==="E").label,"E");
 const css=fs.readFileSync(path.join(ROOT,"remote-control/style.css"),"utf8");assert.match(css,/#worlds\s*\{[^}]*min-width: 0[^}]*overflow-x: auto/);assert.match(css,/\.chip\.named\s*\{[^}]*max-width: 160px/);
 console.log("PASS labels/escaping/fallback/stable IDs/isolated headless room creation/no agent or Thoughts startup/API/static module/config reload/responsive overflow rules");
} finally {api?.close();server?.kill();daemon.kill();console.log("test evidence",T);}
