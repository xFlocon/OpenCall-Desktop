const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const context={URL,safeText:v=>String(v??''),escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function linkifyMentions('),source.indexOf("document.addEventListener('click',async event=>",source.indexOf('function linkifyMentions('))),context);
const render=context.linkifyMentions;
for(const address of ['https://example.com/a?x=1&y=2','http://192.168.1.2:8080','www.example.com','example.com/path','https://例え.jp/道','https://example.com/@friend']){
  const html=render(address);assert.match(html,/<a class="message-link"/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert.match(html,/data-copy-address=/);
}
for(const address of ['192.168.1.2','192.168.1.2:25565','play.example.com:25565','play.example.com:443','[2001:db8::1]:25565','[::1]']){
  const html=render(address);assert.match(html,/<button type="button" class="message-address"/);assert.ok(!html.includes('<a '));assert.ok(html.includes(`data-copy-address="${address}"`));
}
for(const text of ['999.168.1.2:25565','192.168.001.2','example.com:65536','example.com:0','name@example.com','javascript:alert(1)','javascript:example.com','file:///etc/passwd','https://user:pass@example.com'])assert.ok(!render(text).includes('data-copy-address='),text);
assert.match(render('@amigo\n<svg onload="alert(1)">'),/^<span class="mention">@amigo<\/span><br>&lt;svg/);
assert.ok(!render('https://example.com/" onclick="alert(1)').includes(' onclick="'));
assert.match(render('(https://example.com/a_(b)).'),/data-copy-address="https:\/\/example.com\/a_\(b\)"/);
assert.match(render('IP 192.168.1.2:25565, fim'),/data-copy-address="192\.168\.1\.2:25565"/);
for(const address of ['www.example.org','192.168.1.2','play.example.com:25565'])assert.ok(render(`${address}.`).includes(`data-copy-address="${address}"`));
assert.equal((render('example.com e example.org').match(/<a /g)||[]).length,2);
assert.equal((render('https://example.com/@friend').match(/class="mention"/g)||[]).length,0);
assert.equal((source.match(/:linkifyMentions\(m.content\|\|""\)/g)||[]).length,2,'DMs and communities share renderer');
console.log('Message links: HTTP(S), domains, IPs/ports, escaping and shared DM/community renderer OK');
