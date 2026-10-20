'use strict';
// Standalone: also serialized into the Workbench renderer. No Node dependencies.
function createPlanner() {
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
  const path = r => r.sourceUri.path;
  const dir = r => path(r).slice(0, path(r).lastIndexOf('/'));
  const name = r => path(r).slice(path(r).lastIndexOf('/') + 1);
  const compare = (a, b) => collator.compare(dir(a), dir(b)) || collator.compare(name(a), name(b)) || collator.compare(path(a), path(b));
  function plan(resources, width, measure, min = 12, rootUri, maxDisplayLines = 2, hiddenCommonDirectories = [], pathRules = []) {
    const tokens = new Map();
    const decode = text => { for (const [key,value] of tokens) text=text.split(key).join(value); return text; };
    const rawMeasure = measure;
    measure = text => rawMeasure(decode(text));
    const initial = text => tokens.has(text) ? text : Array.from(text)[0] || '';
    function token(text) {
      let key = '\uE000' + tokens.size + '\uE001';
      while (resources.some(r=>path(r).includes(key)) || tokens.has(key)) key += '\uE001';
      tokens.set(key,text); return key;
    }
    function ruleFor(relative, resource) {
      const values = typeof pathRules === 'function' ? pathRules(resource) : pathRules;
      if (!Array.isArray(values) || !values.length) return null;
      const dirs=relative.split('/').slice(0,-1);
      for (const rule of values) {
        if (!rule || typeof rule.pattern!=='string' || !['hide','ellipsis','abbreviate','replace'].includes(rule.mode)) continue;
        const pattern=rule.pattern.replace(/\\/g,'/').replace(/\/$/,'').split('/');
        if (!pattern.length || pattern.some(p=>!p || p==='.' || p==='..' || (p.includes('*') && p!=='*' && p!=='**'))) continue;
        if (rule.mode==='replace' && (typeof rule.replacement!=='string' || !rule.replacement.trim() || /[\r\n\x00-\x1f]/.test(rule.replacement))) continue;
        // Memoized directory-only prefix matching; ** is greedy, including zero segments.
        const memo=new Map();
        function match(i,j) {
          const key=i+':'+j;
          if(memo.has(key)) return memo.get(key);
          let end=-1;
          if(i===pattern.length) end=j;
          else if(pattern[i]==='**') {
            for(let k=dirs.length;k>=j;k--) { end=match(i+1,k); if(end>=0) break; }
          } else if(j<dirs.length && (pattern[i]==='*' || pattern[i]===dirs[j])) end=match(i+1,j+1);
          memo.set(key,end); return end;
        }
        const count=match(0,0);
        if(count<=0) continue;
        const value=rule.mode==='hide'?'':rule.mode==='ellipsis'?'…':rule.mode==='replace'?rule.replacement:dirs.slice(0,count).map(initial).join('/');
        return {count, value, replacement:value ? token(value)+'/' : '', signature:JSON.stringify([rule,count])};
      }
      return {count:0,replacement:'',signature:'unmatched'};
    }
    function transformed(relative, rule) {
      return rule?.count ? rule.replacement + relative.split('/').slice(rule.count).join('/') : relative;
    }
    function visibleCommon(common, resource) {
      const values = typeof hiddenCommonDirectories === 'function' ? hiddenCommonDirectories(resource) : hiddenCommonDirectories;
      const rules = (Array.isArray(values) ? values : []).filter(x => typeof x === 'string')
        .map(x => x.replace(/\\/g, '/').split('/').filter(Boolean))
        .filter(x => x.length && !x.some(p => p === '.' || p === '..' || p.includes('*')))
        .sort((a,b) => b.length-a.length);
      const parts = common.split('/').filter(Boolean), kept = [];
      for (let i=0; i<parts.length;) {
        const rule = rules.find(r => r.every((p,j) => parts[i+j] === p));
        if (rule) i += rule.length;
        else kept.push(parts[i++]);
      }
      return kept.length ? kept.join('/') + '/' : '';
    }
    function compactDirectories(text) {
      if (measure(text) <= width) return text;
      const parts = text.split('/').filter(Boolean);
      if (!parts.length) return text;
      const join = () => parts.join('/') + '/';
      // Keep the first/last directories recognizable; shorten the middle first.
      for(let i=1; i<parts.length-1 && measure(join())>width; i++) parts[i]=initial(parts[i]);
      if(!parts.some(p=>tokens.has(p)) && measure(join())>width && parts.length>3 && measure(parts[0]+'/…/'+parts.at(-1)+'/')<measure(join())) parts.splice(1,parts.length-2,'…');
      if(measure(join())>width) parts[0]=initial(parts[0]);
      if(measure(join())>width) parts[parts.length-1]=initial(parts.at(-1));
      return join();
    }
    const result = new Map(), directories = new Map();
    for (const r of [...resources].sort(compare)) {
      const key = `${r.sourceUri.scheme}://${r.sourceUri.authority || ''}${dir(r)}`;
      if (!directories.has(key)) directories.set(key, []);
      directories.get(key).push(r);
    }
    for (const rows of directories.values()) {
      if (rows.length < 2 || width < 48) continue;
      const names = rows.map(name);
      let common = names[0];
      for (const n of names.slice(1)) {
        let i = 0; while (i < common.length && common[i] === n[i]) i++;
        common = common.slice(0, i);
      }
      // Never consume a whole name or the shared extension.
      common = common.slice(0, Math.min(...names.map(n => n.lastIndexOf('.') > 0 ? n.lastIndexOf('.') : n.length - 1)));
      const boundaries = [];
      for (let i = min; i <= common.length; i++) {
        const prev = names[0][i - 1], next = names[0][i], after = names[0][i + 1];
        if (next && (/[a-z0-9]/.test(prev) && /[A-Z]/.test(next) || /[A-Z]/.test(prev) && /[A-Z]/.test(next) && /[a-z]/.test(after || '') || /[_-]/.test(prev))) boundaries.push(i);
      }
      if (!boundaries.length || names.every(n => measure(n) <= width)) continue;
      // Shortest boundary that makes every suffix fit; otherwise longest safe boundary.
      const cut = boundaries.find(i => names.every(n => measure(n.slice(i)) <= width)) || boundaries.at(-1);
      const prefix = names[0].slice(0, cut);
      // Prefix remains one line (ellipsis if necessary), first suffix uses a second real list line.
      rows.forEach((r, i) => result.set(r, { prefix, suffix: name(r).slice(cut), first: i === 0, height: i === 0 ? 44 : 22 }));
    }
    // Path folding is independent from basename folding. Only repository-relative
    // paths participate, never machine-specific absolute parent directories.
    if (rootUri && width >= 48) {
      const root = rootUri.path.replace(/\/$/, '') + '/';
      const buckets = new Map();
      for (const r of [...resources].sort(compare)) {
        if (r.sourceUri.scheme !== rootUri.scheme || (r.sourceUri.authority || '') !== (rootUri.authority || '') || !path(r).startsWith(root)) continue;
        const relative = path(r).slice(root.length), parts = relative.split('/');
        if (parts.length < 2) continue;
        const rule = ruleFor(relative,r);
        const display = transformed(relative,rule);
        const key = JSON.stringify([parts[0],rule?.signature]);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({r, relative, parts, rule, display});
      }
      // Wrap exclusively at directory boundaries; individual long segments use
      // native ellipsis, not character splitting. Heights match these exact lines.
      function wrap(text) {
        const parts = text.match(/[^/]+\/?/g) || [], lines = [];
        let line = '';
        for (const part of parts) {
          if (line && measure(line + part) > width) { lines.push(line); line = ''; }
          line += part;
        }
        if (line) lines.push(line);
        return lines;
      }
      // Bottom-up directory partition: prefer the largest reduction in repeated
      // path pixels, with a fixed group penalty. Width only changes wrapping,
      // so dragging the panel cannot make the groups oscillate.
      function partition(rows, depth = 0) {
        if (rows.length < 2) return {score:0, groups:[]};
        let count = depth;
        while (count < Math.min(...rows.map(x => x.parts.length - 1)) && rows.every(x => x.parts[count] === rows[0].parts[count])) count++;
        const commonPath = rows[0].parts.slice(0, count).join('/') + (count ? '/' : '');
        const score = commonPath.length >= min ? (rows.length - 1) * measure(commonPath) - 48 : 0;
        const children = new Map();
        for (const row of rows) {
          if (row.parts.length - 1 <= count) continue;
          const key = row.parts[count];
          if (!children.has(key)) children.set(key, []);
          children.get(key).push(row);
        }
        const split = [...children.values()].map(child => partition(child, count + 1));
        const childScore = split.reduce((sum, child) => sum + child.score, 0);
        if (score > 0 && score >= childScore) return {score, groups:[{rows, commonPath}]};
        return {score:childScore, groups:split.flatMap(child => child.groups)};
      }
      const grouped = new Set();
      for (const bucket of buckets.values()) for (const {rows, commonPath} of partition(bucket).groups) {
        if (rows.some(x => x.rule?.count > commonPath.split('/').filter(Boolean).length)) continue;
        if (rows.every(x => measure(x.display) <= width)) continue;
        rows.forEach(({r, relative, rule}, index) => {
          grouped.add(r);
          const old = result.get(r), remainder = relative.slice(commonPath.length);
          const differingDir = remainder.slice(0, remainder.lastIndexOf('/') + 1);
          // Shared context and the resource's own path are independent sections.
          const commonLines = index === 0 ? wrap(rule ? transformed(commonPath,rule) : visibleCommon(commonPath, r)).map(text => ({text, prefix:true, section:'commonPath'})) : [];
          const lines = [];
          if (old) {
            if (differingDir) for (const text of wrap(differingDir)) lines.push({text, prefix:false});
            if (old.first) lines.push({text:old.prefix, prefix:true});
            lines.push({text:old.suffix, prefix:false});
          } else for (const text of wrap(remainder)) lines.push({text, prefix:false});
          result.set(r, {...old, commonPath, pathFirst:index === 0, relative, commonLines, ownLines:lines.map(line => ({...line, section:'resource'}))});
        });
      }
      // An outlier remains explicit, but can wrap without destroying its peers' group.
      for (const bucket of buckets.values()) for (const {r, relative, display, rule} of bucket) {
        if (grouped.has(r)) continue;
        const old=result.get(r);
        if (rule?.count) {
          const directory=display.slice(0,display.lastIndexOf('/')+1);
          const filename=old ? (old.first?old.prefix:'')+old.suffix : name(r);
          result.set(r,{...old,relative,lines:wrap(directory+filename).map(text=>({text,prefix:false}))});
        } else if (!old && measure(relative)>width) result.set(r, {relative, lines:wrap(relative).map(text => ({text, prefix:false}))});
      }
    }
    const limit = Number.isFinite(maxDisplayLines) ? Math.max(1, Math.min(10, Math.floor(maxDisplayLines))) : 2;
    for (const [r, item] of result) {
      // Cap each logical section separately. Never move a resource directory
      // into the shared heading merely to meet the physical row-height budget.
      function cap(section, budget) {
        if (section.length <= budget) return section.map(line => ({...line}));
        const tail = section.slice(budget - 1);
        return [...section.slice(0, budget - 1).map(line => ({...line})),
          {...tail[0], text:tail.map(line => line.text).join(''), prefix:tail.every(line => line.prefix)}];
      }
      let lines;
      if (item.commonPath) {
        const common = item.commonLines;
        // One-line mode shows the resource; shared context remains in hover.
        const commonBudget = item.pathFirst ? Math.min(common.length, limit - 1) : 0;
        const ownBudget = Math.max(1, limit - (item.pathFirst ? commonBudget : 1));
        lines = [...(commonBudget ? cap(common, commonBudget) : []), ...cap(item.ownLines, ownBudget)];
      } else {
        const source = item.lines || [...(item.first ? [{text:item.prefix, prefix:true}] : []), {text:item.suffix, prefix:false}];
        lines = cap(source, limit);
      }
      for (const line of lines) if (line.text.endsWith('/')) line.text = compactDirectories(line.text);
      // Spend width on the basename first. Abbreviate outer directories before
      // removing them; only CSS end-ellipsis may truncate the basename itself.
      const last = lines.at(-1);
      if (measure(last.text) > width && last.text.includes('/') && !last.text.endsWith('/')) {
        const parts = last.text.split('/'), basename = parts.pop();
        const joined = () => [...parts, basename].join('/');
        for (let i = 0; i < parts.length && measure(joined()) > width; i++) {
          parts[i] = initial(parts[i]);
        }
        last.text = joined();
        if (measure(last.text) > width) {
          // Keep short initials (m/r/) intact. Replace at least two directory
          // segments only if an explicit omission marker actually saves pixels.
          for (let cut = 2; cut < parts.length; cut++) {
            if(parts.slice(0,cut).some(p=>tokens.has(p))) continue;
            const candidate = ['…', ...parts.slice(cut), basename].join('/');
            if (measure(candidate) < measure(last.text)) last.text = candidate;
            if (measure(last.text) <= width) break;
          }
        }
      }
      for(const line of lines) line.text=decode(line.text);
      for(const section of [item.commonLines,item.ownLines]) if(section) for(const line of section) line.text=decode(line.text);
      item.lines = lines; item.height = 22 * lines.length;
    }
    return result;
  }
  return { plan, compare, name };
}
module.exports = { createPlanner };
