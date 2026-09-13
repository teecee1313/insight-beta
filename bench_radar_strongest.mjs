// behave bench — v868: the radar tiles must filter the Strongest table.
import fs from 'fs'; import vm from 'vm';
const src=fs.readFileSync('app.js','utf-8');
function grab(re,label){ const m=src.match(re); if(!m){console.error('EXTRACT FAIL:',label);process.exit(1);} return m[0]; }
// extract the pieces under test, verbatim from the shipped file
const pStatOn = grab(/let _statOn=\{[^\n]*\n/,'_statOn');
const pAnyOn  = grab(/function _statAnyOn\(\)\{[\s\S]*?\n\}/,'_statAnyOn');
const pNoNews = grab(/function _noNews5d\(s\)\{[\s\S]*?\n\}/,'_noNews5d');
const pPass   = grab(/function _statPass\(s\)\{[\s\S]*?\n  return true;\n\}/,'_statPass');
const pBull   = grab(/function _isBullish\(s\)\{[\s\S]*?\n\}/,'_isBullish');
const pBear   = grab(/function _isBearish\(s\)\{[\s\S]*?\n\}/,'_isBearish');
const pTable  = grab(/function _strongestTableHTML\(limit,starterHeader\)\{[\s\S]*?\n    return out;\n\}/,'_strongestTableHTML');

const ctx={ window:{}, console,
  _evSigAnyOn:()=>false, _evSigOn:()=>[], _evFires:()=>false, _evDD:()=>'2026-09-13',
  fmtP:(p)=>'$'+(+p).toFixed(3), inWatch:()=>false, statFilter:()=>{},
};
vm.createContext(ctx);
vm.runInContext(pStatOn+'\n'+pAnyOn+'\n'+pNoNews+'\n'+pBull+'\n'+pBear+'\n'+pPass+'\n'+pTable
  +'\nthis._statOn=_statOn;this._statAnyOn=_statAnyOn;this._statPass=_statPass;this._strongestTableHTML=_strongestTableHTML;',ctx);

const mk=(t,o)=>Object.assign({ticker:t,name:t+' LTD',price:1,volume:100000,chgPct:1,chgAbs:0.01,volPct:50,volCalced:true,streakCalced:true,daysUp:0,watchScore:3,score:3,_evTier:null,_evEdge:null,newsFlag:'quiet',currency:'AUD',exchange:'ASX'},o);
ctx.allData=[
  mk('AAA',{volPct:250,daysUp:3,_evTier:'SOLID',_evEdge:2.46,watchScore:8,sigVolRecord:true}), // passes vol+up2+vrec
  mk('BBB',{volPct:250,daysUp:0}),   // vol only
  mk('CCC',{volPct:80, daysUp:3}),   // up2 only
  mk('DDD',{volPct:10, daysUp:0,_evTier:'PROMISING',_evEdge:1.1,watchScore:9}), // neither
];
let pass=0,fail=0; const ok=(c,l)=>{ c?pass++:(fail++,console.error('FAIL:',l)); };

// 1. no tiles on → full table, classic header, all 4 rows
let h=ctx._strongestTableHTML(50,true);
ok(!ctx._statAnyOn(),'no toggles active at start');
ok(h.includes('the 50 strongest of 4'),'unfiltered header keeps classic wording');
ok(['AAA','BBB','CCC','DDD'].every(t=>h.includes('>'+t+'<')),'unfiltered shows every share');
ok(!h.includes('clear filters'),'no clear-filters link when nothing is on');

// 2. Vol ≥200% + Up 2+ Days (Tony's screenshot combo) → only AAA
ctx._statOn.vol=true; ctx._statOn.up2=true;
h=ctx._strongestTableHTML(50,true);
ok(h.includes('>AAA<'),'AAA (vol 250%, up 3d) shown under vol+up2');
ok(!h.includes('>BBB<')&&!h.includes('>CCC<')&&!h.includes('>DDD<'),'non-matching shares hidden');
ok(h.includes('1 matching your radar filters (of 4)'),'starter header states the filtered count honestly');
ok(h.includes('clear filters'),'clear-filters link present');

// 3. add Vol Record tile → still AAA (it fires sigVolRecord)
ctx._statOn.vrec=true;
h=ctx._strongestTableHTML(50,false);
ok(h.includes('>AAA<')&&!h.includes('>DDD<'),'report variant filters identically');
ok(h.includes('1 of 4 matching your radar filters'),'report header states the filtered count');

// 4. impossible combo → empty state with a way out, no orphan rows
ctx._statOn.losers=true;    // nothing is a loser
h=ctx._strongestTableHTML(50,true);
ok(h.includes('Nothing matches this combination'),'empty state message shows');
ok(h.includes('Clear the filters'),'empty state offers the clear link');
ok(!h.includes('>AAA<'),'no rows leak into the empty state');

// 5. clear all → back to the classic full table
Object.keys(ctx._statOn).forEach(k=>ctx._statOn[k]=false); ctx.window._statBullBear=null;
h=ctx._strongestTableHTML(50,true);
ok(h.includes('the 50 strongest of 4')&&h.includes('>DDD<'),'clearing restores the unfiltered table');

// 6. ranking untouched: SOLID first regardless of filter state
ok(h.indexOf('>AAA<')<h.indexOf('>BBB<'),'evidence-first ordering preserved');

console.log(pass+'/'+(pass+fail)+' checks passed'); process.exit(fail?1:0);
