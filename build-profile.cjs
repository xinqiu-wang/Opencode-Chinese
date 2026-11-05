'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { applyBundle, readGraph } = require('./bundle.cjs');
const base = require('./translations.json');
const extra = require('./translations-extra.json');
const menus = require('./translations-menus.json');
const original = '0c346fdaf519d2f23a31d3b6cb9d65e369a72d77cac6f027b5e0a06376ec3a43';
const previous = {
  '63ddc4a994007b0a27febbe70bdffa898871edca2743212086ed9105968637e4': 385,
  'e97020d65e48dc4bad0a47d509b50487b680d58420b478472a3bafbc2c5c021e': 1401,
};
const data = fs.readFileSync(process.argv[2]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (hash(data) !== original) throw new Error('Not the verified OpenCode 2.2.5 x64 binary');
const graph = readGraph(data);
const rules = {};

const ui = { ...base.ui, ...extra.ui };
const render = { ...ui, ...extra.render };
const cli = { ...base.cli, ...extra.cli };
const uiText = /(\b(?:title|titlePlaceholder|placeholder|description|display|label|empty|desc|message|hint|text|children|category|group|choicesLabel):|\bF\()("(?:[^"\\\r\n]|\\.)*")/g;
const cliText = /(\b(?:jr\(|Nf\(|bold\(|description:|en\())("(?:[^"\\\r\n]|\\.)*")/g;

function add(name, dictionary, pattern, extraRules = []) {
  const { record } = graph.modules.get(name);
  const start = graph.base + data.readUInt32LE(record + 8);
  const encoding = ['utf8', 'latin1', 'utf16le'][data[record + 48]];
  const code = data.toString(encoding, start, start + data.readUInt32LE(record + 12));
  const changes = new Map(extraRules);
  for (const [from, prefix, literal] of code.matchAll(pattern)) {
    let value;
    try { value = JSON.parse(literal.replace(/\\x([\da-f]{2})/gi, '\\u00$1')); }
    catch { continue; }
    if (Object.hasOwn(dictionary, value)) changes.set(from, prefix + JSON.stringify(dictionary[value]));
  }
  // Longer anchors can contain shorter ones. Assign each source span once,
  // using the more specific anchor first.
  let translated = code;
  rules[name] = [];
  for (const [from, to] of [...changes].sort(([a], [b]) => b.length - a.length)) {
    const parts = translated.split(from);
    if (parts.length === 1) {
      if (code.includes(from)) continue;
      throw new Error('Missing expected text: ' + name + ' ' + from);
    }
    rules[name].push({ from, to, count: parts.length - 1 });
    translated = parts.join(to);
  }
}

const literal = (source, translation) => [JSON.stringify(source), JSON.stringify(translation)];
const settingLabels = {
  system: '跟随系统', dark: '深色', light: '浅色', off: '关闭', on: '开启',
  hide: '隐藏', show: '显示', auto: '自动', source: '源码', rendered: '渲染',
  none: '无', low: '简略', medium: '适中', high: '详细', horizontal: '横向',
  vertical: '纵向', split: '并排', unified: '统一', word: '按单词', compact: '折叠',
  full: '完整', manual: '手动复制', select: '选中即复制',
  'launch directory': '启动目录', 'active session': '当前会话目录',
  prompt: '询问', 'auto accept': '自动批准', 'current directory': '当前目录', global: '全局',
  'status icons': '状态图标', 'always show numbers': '始终显示数字',
};

const builtinCommandDescriptions = {
  'keep working until an objective is met [pause|resume|clear]': '持续工作直到达成目标 [pause|resume|clear]',
  'guided AGENTS.md setup': '引导创建或更新 AGENTS.md',
  'review changes [commit|branch|pr], defaults to uncommitted': '审查改动 [commit|branch|pr]，默认审查未提交的改动',
  "schedule a prompt for later, or list, pause and delete this session's schedules": '安排稍后发送消息，或查看、暂停和删除会话计划',
};
const builtinAgentDescriptions = {
  'The default agent. Executes tools based on configured permissions.': '默认代理，按配置的权限执行工具。',
  'Read-only agent for exploring the codebase and planning work before implementation.': '只读代理，用于查看代码并在实施前制定计划。',
  'General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.': '通用代理，用于研究复杂问题、执行多步任务和并行处理多项工作。',
};
const variantLabels = {
  default: '默认', none: '关闭', minimal: '极低', low: '低', medium: '中',
  high: '高', xhigh: '很高', max: '最高', ultra: '极高', auto: '自动',
};
function translateDisplay(expression, labels, fallback = 'value') {
  return '((value)=>{const labels=' + JSON.stringify(labels) +
    ';return Object.hasOwn(labels,value)?labels[value]:' + fallback + '})(' + expression + ')';
}

add('chunk-5nv4x58q.js', cli, cliText, [
  literal('Directory to start OpenCode in', 'OpenCode 的启动目录'),
]);
add('chunk-3dkk5ehy.js', cli, cliText, [
  literal(' (optional)', '（可选）'),
  ['(choices: ${o.join(", ")})', '（可选值：${o.join(", ")}）'],
  ['Missing required flag: --${this.option}', '缺少必填选项 --${this.option}'],
  ['Missing required argument: ${this.argument}', '缺少必填参数 ${this.argument}'],
]);
add('chunk-t5qeknxt.js', render, uiText, [
  ["\"Previous update action\":\"Next update action\"", "\"上一个更新操作\":\"下一个更新操作\""],
  ["?\"Updating OpenCode\":D().type===\"available\"||D().type===\"failed\"?\"Update available\":\"Update\"", "?\"正在更新 OpenCode\":D().type===\"available\"||D().type===\"failed\"?\"有可用更新\":\"更新\""],
  ["Installing OpenCode ${B.version}\\u2026", "正在安装 OpenCode ${B.version}…"],
  ["\"Type your own answer\"", "\"输入自定义回答\""],
  ["l(lr,qe),l(zt,s(C", "l(lr,()=>" + translateDisplay('qe()', menus.formActions) + "),l(zt,s(C"],
  ["P.editing&&!Fe()?\"close\":\"dismiss\"", "P.editing&&!Fe()?\"关闭编辑\":\"关闭\""],
  ["M()?\"\\u2713 copied\":\"copy\"", "M()?\"✓ 已复制\":\"复制\""],
  ["ht()?\"Review\":`Field ${Math.min(P.tab,ne().length-1)+1} of ${ne().length}`", "ht()?\"检查回答\":`第 ${Math.min(P.tab,ne().length-1)+1} 项，共 ${ne().length} 项`"],
  ["St===ie?\"Today\":St", "St===ie?\"今天\":new Date(We.time.updated).toLocaleDateString(\"zh-CN\")"],
  ["pending:\"Notice\"", "pending:\"提示\""],
  ["title:Q()?\"current directory\":\"all projects\"", "title:Q()?\"当前目录\":\"所有项目\""],
  ["title:Q()?\"Show current directory sessions\":\"Show all project sessions\"", "title:Q()?\"显示当前目录会话\":\"显示所有项目会话\""],
  ["ve=F(\" for \");return c(Ie,ve),l(Ie,ee,null)", "ve=F(\" · \");return c(Ie,ve),l(Ie,ee,null)"],
  ["Ye(pe.get(We),\"Pinned\")", "Ye(pe.get(We),\"已固定\")"],
  ["description:k.description?.replace(/\\s+/g,\" \").trim(),value:k.id", "description:" + translateDisplay('k.description?.replace(/\\s+/g," ").trim()', menus.skillDescriptions) + ",value:k.id"],
  ["function _c(r){if(r===\"pdf\")return\"PDF\";return r.charAt(0).toUpperCase()+r.slice(1)}", "function _c(r){return " + translateDisplay('r', menus.modalities, 'r.charAt(0).toUpperCase()+r.slice(1)') + "}"],
  ["if(Zr(r.model))return\"Free\";", "if(Zr(r.model))return\"免费\";"],
  ["d()!==\"Free\"?[`${d()} per 1M`]", "d()!==\"免费\"?[`${d()} / 百万令牌`]"],
  ["return Zr(A)?\"Free\":void 0", "return Zr(A)?\"免费\":void 0"],
  ["r.model.variants.length>0?[\"Reasoning\"]", "r.model.variants.length>0?[\"推理\"]"],
  ["`Failed to delete session: ${Xo(pe)}`", "`删除会话失败：${Xo(pe)}`"],
  ["`MCP server failed: ${ce.name}`", "`MCP 服务器失败：${ce.name}`"],
  ["`Connect \"${ce.name}\" to use its tools.`", "`连接“${ce.name}”后可使用其工具。`"],
  ['return"Select model"', 'return"选择模型"'],
  ['category:"Suggested"', 'category:"推荐"'],
  ['if(W.format)return W.format(U);let P=W.values?.indexOf(U);return P===void 0||P<0?String(U):W.labels?.[P]??String(U)',
   'if(W.format)return W.format(U);let P=W.values?.indexOf(U);let J=P===void 0||P<0?String(U):W.labels?.[P]??String(U);return Object.hasOwn(' +
      JSON.stringify(settingLabels) + ',J)&&W.path.join(".")!=="theme.name"?' + JSON.stringify(settingLabels) + '[J]:J'],
  literal('Fix a TODO in the codebase', '修复代码中的一项待办'),
  literal('What is the tech stack of this project?', '这个项目用了哪些技术？'),
  literal('Fix broken tests', '修复失败的测试'),
  ['Ask anything\\u2026', '输入你的问题…'],
  ['te(Z,"Favorites")', 'te(Z,"收藏")'],
  [')),\"Recent\"),we=Uo', ')),"最近使用"),we=Uo'],
  literal('Search sessions', '搜索会话'),
  ['Search sessions in ${ee()}', '在 ${ee()} 中搜索会话'],
  literal('No sessions found', '未找到会话'),
  literal('No sessions available', '暂无会话'),
  literal('Could not search sessions. Change the search to try again.', '无法搜索会话。请修改搜索内容后重试。'),
  literal('Could not load sessions.', '无法加载会话。'),
  literal('No matches', '没有匹配结果'),
  ['No matches \\xB7 search all sessions with ', '没有匹配结果 · 搜索所有会话：'],
  ['"Search worktrees\\u2026"', '"搜索工作树…"'],
  ['"Search sessions and projects\\u2026"', '"搜索会话和项目…"'],
  ['} / Worktrees`:"Open"', '} / 工作树`:"打开"'],
  ['()?"Connected":r.connection.status()', '()?"已连接":r.connection.status()'],
  ['"Switch to light mode":"Switch to dark mode"', '"切换到浅色模式":"切换到深色模式"'],
  ['"Disable animations":"Enable animations"', '"关闭动画":"开启动画"'],
  ['"Searching sessions\\u2026"', '"正在搜索会话…"'],
  ['"Loading sessions\\u2026"', '"正在加载会话…"'],
  ['"Searching sessions and projects\\u2026"', '"正在搜索会话和项目…"'],
  ['agentLabel:Ut?Tc(Ut.id):void 0', 'agentLabel:Ut?(Ut.id==="build"?"构建":Ut.id==="plan"?"规划":Tc(Ut.id)):void 0'],
  ['value:g.id,title:g.id,description:g.description',
   'value:g.id,title:g.id==="build"?"构建":g.id==="plan"?"规划":g.id,searchText:g.id,description:' +
     translateDisplay('g.description', builtinAgentDescriptions)],
  ['description:Ve.description,queueable:!0', 'description:' + translateDisplay('Ve.description', builtinCommandDescriptions) + ',queueable:!0'],
  ['get variant(){return Nt().variant}', 'get variant(){return ' + translateDisplay('Nt().variant', variantLabels) + '}'],
  ['filter((p)=>p!=="default").map((p)=>({value:p,title:p,onSelect:()=>{n.clear(),r.model.variant.set(p)}}))', 'filter((p)=>p!=="default").map((p)=>({value:p,title:' + translateDisplay('p', variantLabels) + ',searchText:p,onSelect:()=>{n.clear(),r.model.variant.set(p)}}))'],
  ['V()?"connect integration":"view all integrations":V()?"Connect an integration":"View all integrations"', 'V()?"连接服务":"查看所有集成":V()?"连接服务":"查看所有集成"'],
  ['command:"model.dialog.usage",title:d()?"usage":"Usage"', 'command:"model.dialog.usage",title:"用量"'],
  ['M(D?.value)?"unfavorite":"favorite"', 'M(D?.value)?"取消收藏":"收藏"'],
  ['B(A?.value)?"unfavorite":"favorite":"Favorite"', 'B(A?.value)?"取消收藏":"收藏":"收藏"'],
  ['F(" to see all available actions and commands in any context.")', 'F(" 查看当前界面可用的操作和命令。")'],
]);
add('chunk-fvkdscp7.js', render, uiText, [
  ["\"esc back\"", "\"esc 返回\""],
  ["\"pgup/pgdn scroll\"", "\"pgup/pgdn 滚动\""],
  ["\"tab next \"", " \"tab 下一项 \""],
  ["\"esc dismiss\"", "\"esc 关闭\""],
  ["\"enter submit   esc dismiss\"", "\"enter 提交   esc 关闭\""],
  ["\"enter save   esc dismiss\"", "\"enter 保存   esc 关闭\""],
  ["enter ${w()}   esc dismiss", "enter ${" + translateDisplay('w()', menus.formActions) + "}   esc 关闭"],
  ["\"up/down select   enter choose   tab next   esc dismiss\"", "\"up/down 选择   enter 确认   tab 下一项   esc 关闭\""],
  ["\"\\u2191\\u2193 select   enter choose   tab next   esc dismiss\"", "\"↑↓ 选择   enter 确认   tab 下一项   esc 关闭\""],
  ["Field type ${n.type} is not supported in Mini yet.", "精简模式暂不支持 ${n.type} 类型的字段。"],
  ["B()?\"Review\":`${Math.min(S().field+1,t.request.fields.length)}/${t.request.fields.length}`", "B()?\"检查回答\":`${Math.min(S().field+1,t.request.fields.length)}/${t.request.fields.length}`"],
  ["f.cost?.input===0&&i.id===\"opencode\"?\"Free\"", "f.cost?.input===0&&i.id===\"opencode\"?\"免费\""],
  ['Ask anything, / for commands, @ for context','输入你的问题，/ 查看命令，@ 添加上下文'],
  ['return"Always allow"', 'return"始终允许"'],
  ['o()<24?"Reject":"Reject permission"', 'o()<24?"拒绝":"拒绝授权"'],
  ['o()<24?"Permission":"Permission required"', 'o()<24?"权限":"需要授权"'],
  ['?"current":void 0,footerTone:"selection"', '?"当前":void 0,footerTone:"selection"'],
]);
add('chunk-15f4c5jr.js', render, uiText, [
  ["\"Base or diff unavailable\"", "\"无法获取基准或差异\""],
  ["\"Base not reported\"", "\"未提供基准\""],
  ["\"Resolving diff\\u2026\"", "\"正在解析差异…\""],
  ["\"vs HEAD\"", "\"与 HEAD 比较\""],
  ["`vs ${P.name}`", "`与 ${P.name} 比较`"],
  ["title:`${p()?\"hide\":\"show\"} internal`", "title:p()?\"隐藏内置插件\":\"显示内置插件\""],
  ["title:i()?\"checking for updates\":\"check for updates\"", "title:i()?\"正在检查更新\":\"检查更新\""],
  ["if(!L)return\"toggle\";return t.plugins.registered().find((Y)=>Y.id===L.id)?.active?\"disable\":\"enable\"", "if(!L)return\"切换\";return t.plugins.registered().find((Y)=>Y.id===L.id)?.active?\"禁用\":\"启用\""],
  ["`Failed to update plugin ${Y.id}`", "`更新插件失败：${Y.id}`"],
  ["`${Y().runtime===\"tui\"?\"TUI\":\"Server\"} plugin error`", "`${Y().runtime===\"tui\"?\"终端界面\":\"服务器\"}插件错误`"],
  ["\"Unknown plugin error\"", "\"未知插件错误\""],
  ["Plugin: ${pn(Y(),t.context)}\nStatus: failed\nRuntime: ${Y().runtime}\nSource: ${ba(Y(),t.context)}", "插件：${pn(Y(),t.context)}\n状态：失败\n运行环境：${Y().runtime}\n来源：${ba(Y(),t.context)}"],
  ["...jn(t)===\"active\"?[]:[jn(t)],...dd(t)?[\"local\"]", "...jn(t)===\"active\"?[]:[" + translateDisplay('jn(t)', menus.pluginStatuses) + "],...dd(t)?[\"本地\"]"],
  ["...Fo(t)?[\"update available\"]", "...Fo(t)?[\"有可用更新\"]"],
  ["I.label===\"best streak\"?\" days\":\"\"", "I.label===\"best streak\"?\" 天\":\"\""],
  ["l(X,()=>I.label),b((_)", "l(X,()=>" + translateDisplay('I.label', menus.statsLabels) + "),b((_)"],
  ["new Intl.DateTimeFormat(\"en-US\",{month:\"short\",year:\"numeric\"}).formatRange(new Date(t.stats.range.from)", "new Intl.DateTimeFormat(\"zh-CN\",{month:\"short\",year:\"numeric\"}).formatRange(new Date(t.stats.range.from)"],
  ["(I.label.length<=I.span*2?I.label:\"\").padEnd(I.span*2)", "(()=>{const label=" + translateDisplay('I.label', menus.months) + ";const cells=Jt(label);return cells<=I.span*2?label+\" \".repeat(I.span*2-cells):\" \".repeat(I.span*2)})()"],
  ["each:[\"M\",\"T\",\"W\",\"T\",\"F\",\"S\",\"S\"]", "each:[\"一\",\"二\",\"三\",\"四\",\"五\",\"六\",\"日\"]"],
  ["l(X,I+\"   \"),l(U,s(tt", "l(X,I+\"  \"),l(U,s(tt"],
  ["return\"goal paused\";if(t.status===\"complete\")return\"goal met\";return\"goal\"", "return\"目标已暂停\";if(t.status===\"complete\")return\"目标已达成\";return\"目标\""],
  ['F("Connect provider")','F("连接模型供应商")'],
  ['F("agents")','F("代理")'],
  ['F("commands")','F("命令")'],
  ['t.source??"Files"', 't.source??"文件"'],
]);
add('chunk-mdnw6rat.js', render, uiText, [
  ["\"Type your own answer\"", "\"输入自定义回答\""],
  ["title:f.type===\"key\"?f.label??\"API key\":f.label,value:", "title:" + translateDisplay('f.type==="key"?f.label??"API key":f.label', menus.authLabels) + ",value:"],
  ["function IA(t,r,n,i,o){", "function IA(t,r,n,i,o){r={...r,label:" + translateDisplay('r.label', menus.authLabels) + ",form:r.form?.map(field=>({...field,title:" + translateDisplay('field.title', menus.authLabels) + ",description:" + translateDisplay('field.description', menus.authLabels) + ",placeholder:" + translateDisplay('field.placeholder', menus.authLabels) + ",options:field.options?.map(option=>({...option,label:" + translateDisplay('option.label', menus.authLabels) + ",description:" + translateDisplay('option.description', menus.authLabels) + "}))}))};"],
  ["o.expanded?\"minimize\":\"fullscreen\"", "o.expanded?\"缩小\":\"全屏\""],
  ["oe.root.directory===_e?\"Current\":\"Other\"", "oe.root.directory===_e?\"当前\":\"其他\""],
  ["What's new in ${t.version}", "${t.version} 版本亮点"],
  ["l(D,()=>g.title),e(A,\"wrapMode\",\"word\")", "l(D,()=>" + translateDisplay('g.title', menus.releaseTitles) + "),e(A,\"wrapMode\",\"word\")"],
  ["return g.body.split(\"`\")", "return (" + translateDisplay('g.title', menus.releaseBodies, 'void 0') + "??g.body).split(\"`\")"],
  ["return\"Connecting \\u2026\";if(t.status.status===\"connected\")", "return\"正在连接…\";if(t.status.status===\"connected\")"],
  ["if(t.status.status===\"failed\")return\"Failed !\"", "if(t.status.status===\"failed\")return\"失败 !\""],
  ["return\"Disabled \\u25CB\"", "return\"已禁用 ○\""],
  ["if(M===\"connected\")return\"disconnect\";if(M===\"failed\")return\"retry\";if(M===\"needs_auth\")return\"sign in\";return\"connect\"", "if(M===\"connected\")return\"断开\";if(M===\"failed\")return\"重试\";if(M===\"needs_auth\")return\"登录\";return\"连接\""],
  ["`MCP server: ${G().name}`", "`MCP 服务器：${G().name}`"],
  ["\"Unknown MCP connection error\"", "\"未知 MCP 连接错误\""],
  ["Status: ${G().status.status}\nConfiguration: mcp.servers.", "状态：${" + translateDisplay('G().status.status', menus.mcpStatuses) + "}\n配置：mcp.servers."],
  ["Integration: ${G().integrationID}", "集成：${G().integrationID}"],
  ['??t.placeholder??"Search"', '??t.placeholder??"搜索"'],
  literal('Untitled session', '未命名会话'),
  literal('Environment only', '仅支持环境变量配置'),
  ['"Sign in required \\u2192"', '"需要登录 →"'],
  ['g="Services";if(h.id in Iy)g="Popular"', 'g="服务";if(h.id in Iy)g="常用服务"'],
  ['Permission required: ${r??t}', '需要授权：${r??t}'],
  ['Reject permission: ${t.action}', '拒绝授权：${t.action}'],
  ['Connect ${t.name}', '连接 ${t.name}'],
  ['Connect ${t.integration.name}', '连接 ${t.integration.name}'],
]);

add('chunk-yc9ekmk6.js', render, uiText, [
  ['return"Allow once"', 'return"允许一次"'],
  ['return"Always allow"', 'return"始终允许"'],
  ['return"Reject"', 'return"拒绝"'],
  ['return"Confirm"', 'return"确认"'],
  ['return"Cancel"', 'return"取消"'],
  ['Edit ${r(p)}', '编辑 ${r(p)}'],
  ['u==="read"?"Read":"List"', 'u==="read"?"读取":"列出"'],
  ['u==="glob"?"Glob":"Grep"', 'u==="glob"?"匹配文件":"搜索文本"'],
  ['${Tc(p)} Subagent', '${Tc(p)} 子代理'],
  ['Access external directory ${r(h)}', '访问外部目录 ${r(h)}'],
  ['Call tool ${n.action}', '调用工具 ${n.action}'],
  ['This will always allow ${n.action} for this project.', '此项目将始终允许 ${n.action}。'],
  literal('This will always allow the following patterns for this project.', '此项目将始终允许匹配以下规则的操作。'),
  literal('This keeps the session running despite repeated failures.', '即使操作多次失败，也继续运行当前会话。'),
]);

add('chunk-mabj30d7.js', {"Answer required":"请填写回答","Select at least one option":"请至少选择一项","Expected text":"请输入文本","Expected an email address":"请输入电子邮箱地址","Expected a URL":"请输入网址","Expected a date (YYYY-MM-DD)":"请输入日期（YYYY-MM-DD）","Expected a date and time":"请输入日期和时间","Select an available option":"请选择一个可用选项","Expected a number":"请输入数字","Expected an integer":"请输入整数","Expected yes or no":"请选择是或否","Expected selections":"请选择选项","Select only available options":"请选择可用的选项"}, /()("(?:[^"\\\r\n]|\\.)*")/g, [
  ["Must be at least ${t.minLength} characters", "至少输入 ${t.minLength} 个字符"],
  ["Must be at most ${t.maxLength} characters", "最多输入 ${t.maxLength} 个字符"],
  ["Must match pattern: ${t.pattern}", "必须符合格式：${t.pattern}"],
  ["Invalid pattern: ${t.pattern}", "格式规则无效：${t.pattern}"],
  ["Must be at least ${t.minimum}", "最小值为 ${t.minimum}"],
  ["Must be at most ${t.maximum}", "最大值为 ${t.maximum}"],
  ["Select at least ${t.minItems}", "请至少选择 ${t.minItems} 项"],
  ["Select at most ${t.maxItems}", "请最多选择 ${t.maxItems} 项"],
]);

const labels = applyBundle(data, rules);
const output = [{
  version: '2.2.5', versionOutput: 'opencode v2.2.5', variant: 'Windows x64',
  original, previous, patched: hash(data), helpMarker: 'OpenCode 命令行界面', labels, modules: rules,
}];
fs.writeFileSync(path.join(__dirname, 'profiles.json'), JSON.stringify(output, null, 2) + '\n');
if (process.argv[3]) fs.writeFileSync(process.argv[3], data);
console.log(JSON.stringify({ labels, patched: output[0].patched, modules: Object.keys(rules).length }));
