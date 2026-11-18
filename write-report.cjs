const fs = require('node:fs');
process.chdir(__dirname);
const studentName = fs.readFileSync('README.md', 'utf8').match(/^Оюутны нэр: (.+)$/m)?.[1] || '[нэрээ нөхөх]';
const names = ['pass', 'chaos', 'fail'];
const data = Object.fromEntries(names.map((name) => [name, JSON.parse(fs.readFileSync(`results/${name}.json`, 'utf8')).metrics]));
const n = (value) => value.toFixed(2);
const pct = (value) => n(value * 100);
const stats = (m) => ({
  total: m.http_reqs.count,
  success: m.checks.passes,
  failed: m.checks.fails,
  availability: m.checks.value,
  cart: m['http_req_duration{name:cart}']['p(95)'],
  report: m['http_req_duration{name:report}']['p(95)'],
  pay: m['http_req_failed{name:pay}'].value,
});
const s = Object.fromEntries(names.map((name) => [name, stats(data[name])]));
const c = s.chaos;
const recovery = data.chaos.outage_recovery_ms['p(95)'];
const samples = data.chaos.recovery_samples.count;
const allowedFailures = Math.floor(c.total * 0.10);
const analysis = names.map((name) => {
  const r = s[name];
  return `${name}: requests=${r.total}; successful=${r.success}; failed=${r.failed}; cart_p95_ms=${n(r.cart)}; report_p95_ms=${n(r.report)}; pay_error_pct=${pct(r.pay)}; availability_pct=${pct(r.availability)}`;
}).join('\n') + `\nchaos: availability=${c.success}/${c.total}=${pct(c.availability)}%; request_budget=floor(${c.total}*0.10)=${allowedFailures}; failures=${c.failed}; over_budget=${c.failed - allowedFailures}; recovery_p95_ms=${n(recovery)}; recovery_samples=${samples}\n`;
fs.writeFileSync('results/analysis.txt', analysis);
const scenarios = fs.readFileSync('SCENARIOS.md', 'utf8').split('\n').slice(2).join('\n');
const rows = names.map((name) => {
  const r = s[name];
  const exit = fs.readFileSync(`results/${name}.txt`, 'utf8').match(/exit=(\d+)/)[1];
  return `| ${name} | ${r.total} | ${n(r.cart)} | ${n(r.report)} | ${pct(r.pay)}% | ${pct(r.availability)}% | ${exit} | [Гаралт](results/${name}.txt) |`;
}).join('\n');
const report = `# Лаборатори 3 Чанарын сценарио SLO ба k6 threshold

Оюутны нэр: ${studentName}
Оюутны код: B232270009
Огноо: 2026-11-18

Локал Express API дээр чанарын сценарио бичиж, хэмжүүрүүдийг SLO болон k6 threshold болгон шалгав. Хэвийн тест PASS, crash оруулсан тест availability болон reliability дээр FAIL, зориуд чангалсан report threshold FAIL болсон.

## Орчин

\`k6 version\` командын гаралт ([эх файл](results/version.txt)):

\`\`\`text
${fs.readFileSync('results/version.txt', 'utf8').trim()}
\`\`\`

Windows PowerShell, Node.js v26.13.0, Express; API зөвхөн http://127.0.0.1:3000 дээр ажиллана. Node dependency хувилбарууд package-lock.json-д хадгалагдсан.

## Сценарио ба SLO

${scenarios}

## Ажиллуулах

Төслийн үндсэн хавтаснаас:

\`\`\`powershell
cd .\\Lab3
npm.cmd ci
npm.cmd run check
npm.cmd run experiments
\`\`\`

Runner нь portable k6-г ../.tools/k6/k6-v2.4.0-windows-amd64/k6.exe замаас ашиглана. Тусдаа суулгасан k6 ашиглах бол run-experiments.cjs-ийн k6 замыг тохируулна. Туршилтууд 1 минут, 2 минут, 1 минут гэсэн дарааллаар ажиллана. Runner өөрөө асаасан API процессоо chaos тестийн 30 дахь секундэд зогсоож, 10 секунд хүлээгээд дахин асаана. Энэ нь Ctrl+C ба гараар дахин асаах үйлдлийг давтагдах байдлаар автоматжуулсан. Бүх тестийн дараа API-г зогсооно. 3000 порт өмнө нь ашиглагдаж байвал runner туршилт эхлүүлэхгүй.

Тус тусад нь ажиллуулах бол API-г эхний терминалд \`node server.js\` гэж асаагаад хоёр дахь терминалд:

\`\`\`powershell
$k6Exe = (Get-ChildItem ..\\.tools\\k6 -Filter k6.exe -Recurse).FullName
& $k6Exe run --quiet --no-color --summary-mode full slo-test.js
$LASTEXITCODE
& $k6Exe run --quiet --no-color --summary-mode full -e CHAOS=1 slo-test.js
$LASTEXITCODE
& $k6Exe run --quiet --no-color --summary-mode full slo-test-fail.js
$LASTEXITCODE
\`\`\`

Гараар chaos ажиллуулах үед нөгөө терминалд API-г 30 дахь секундэд зогсоож, 10 секундийн дараа дахин асаана. \`CHAOS=1\` нь цонхыг 2 минут болгож, recovery хэмжүүрийг идэвхжүүлдэг; серверийг зогсоох үйлдлийг зөвхөн runner автоматжуулдаг.

## Бодит хэмжилт

| Туршилт | Нийт хүсэлт | Cart p95 мс | Report p95 мс | Pay error rate | Availability | Exit code | Нотолгоо |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

Хувь болон хугацааг хоёр орны нарийвчлалтай тоймлов. JSON эх өгөгдөл results/pass.json, results/chaos.json, results/fail.json-д, тооцоо [analysis.txt](results/analysis.txt)-д байна. Нэг хүсэлт бүрд HTTP 200 гэсэн ганц check байгаа тул checks-ийн амжилтын хувь нь нийт хүсэлтийн амжилтын хувьтай тэнцэнэ. HTTP 500 болон холболтын алдаа хоёулаа бүтэлгүй хүсэлтэд орно. Өгөгдлийн агуулга шалгах setup smoke нь тусдаа; SLO тестэд check-ийг олшруулбал энэ харьцаа өөрчлөгдөнө.

## Chaos ба error budget

Бодит availability = ${c.success} / ${c.total} × 100 = ${pct(c.availability)}%. 90%-ийн SLO-д нийт ${c.total} хүсэлтээс хамгийн ихдээ ${allowedFailures} хүсэлт унах боломжтой. Бодитоор ${c.failed} хүсэлт унасан тул budget-ийг ${c.failed - allowedFailures} хүсэлтээр хэтрүүлсэн. Иймээс availability threshold FAIL болсон. Pay error rate ${pct(c.pay)}% болж 8%-ийн босгыг мөн давсан: сервер унтарсан үед төлбөрийн бүх хүсэлт алдана.

Цагаар тооцсон budget 12 секунд бөгөөд зориудын зогсолт 10 секунд байсан. Гэвч сервер зогсоход report-ийн 200–400 мс хүлээлт байхгүй болж, connection refused хурдан буцдаг тул давталтын хугацаа богиносож, уналтын үеийн нэг секундэд илүү олон хүсэлт илгээгддэг. Үүн дээр pay-ийн хэвийн үеийн зориудын алдаа нэмэгдэнэ. Тиймээс цагаар budget-д багтсан ч хүсэлтийн budget хэтэрч болно. Энэ хэмжилтийн нөхцөлд 10 секундийн crash, pay-ийн алдааг хамтад нь тооцсон 90%-ийн хүсэлтийн SLO хангагдаагүй; хэмжилтийн дараа босгыг сулруулаагүй.

VU бүрийн анхны cart холболтын алдаанаас дараагийн амжилттай cart хүсэлт хүртэлх сэргэлтийн p95 ${n(recovery)} мс, ажиглалт ${samples} байв. Энэ нь 12000 мс-ийн босгыг хангасан. Controller-ийн stop болон ready цаг, recovery_ms нь chaos.txt дотор бий. VU хэмжилт нь probe-ийн 1 секундийн хүлээлт болон report-ийн хариуны хугацаанаас хамаардаг; яг процессын downtime биш. Эдгээр ${samples} хэмжилт нь нэг crash-ийн давхцсан ажиглалт тул олон тусдаа эвдрэлийн урт хугацааны p95 гэж үзэхгүй.

Availability-г cart эсвэл health probe-ийн хугацааны түүврээр, reliability-г сервер хүрэх боломжтой үеийн pay HTTP 500 / хүрсэн pay хүсэлтээр тусгаарлан хэмжиж болно. Энэ лабораторийн өгсөн SLI-г хэвээр үлдээсэн тул одоогийн pay error rate-д сүлжээний алдаа давхар багтсан.

## Зориудын FAIL

slo-test-fail.js нь бусад босгыг хадгалж, report-ийн p95 босгыг 450 мс-ээс 100 мс болгосон. Хэмжсэн report p95 ${n(s.fail.report)} мс тул p(95)<100 нөхцөл зөрчигдсөн. [fail.txt](results/fail.txt)-ийн THRESHOLDS хэсгийн report мөр, төгсгөлийн threshold зөрчсөн лог, exit=99 нь нотолгоо болно. Cart-ийн босгыг 50 мс болгоход localhost дээр хурдан хэвээр учраас найдвартай FAIL үүсгэхгүй. CI нь k6 процессын 99 exit code-оор шалгалтыг амжилтгүй болгох боломжтой.

## Дүгнэлт

Сценариогоос SLO гаргахад хамгийн хэцүү нь хэмжих нэгж, ачаалал, хугацааны цонхоо нэг утгатай тодорхойлох байв. Cart-ийн 20 мс босго нь хэвийн тестийн ${n(s.pass.cart)} мс p95-тай харьцуулахад бодитой нөөцтэй байсан. Pay-ийн зориудын алдааг харгалзсан 8%-ийн босгыг хэвийн тест хангасан. Report-ийн 450 мс босго хэвийн үед хангагдсан боловч 100 мс болгож чангалмагц тест FAIL болсон. Энэ үед HTTP хүсэлт амжилттай байсан ч хугацааны шаардлага зөрчигдөж болдгийг харлаа. Chaos туршилтад 10 секундийн зогсолт цагаар тооцсон 12 секундийн budget-д багтсан ч хүсэлтийн availability шаардлага хангагдаагүй. Сервер унахад давталт хурдан дуусдаг учраас хугацааны хувь ба хүсэлтийн хувийг адилтгаж болохгүйг энэ туршилт харуулсан. Нэг crash availability болон reliability хоёр SLO-г зэрэг зөрчсөн тул SLI-үүдийн хамрах хүрээг тусгаарлан тодорхойлох хэрэгтэй. Сэргэлтийн p95 босго хангагдсан ч нэг crash-ийн ажиглалтаар урт хугацааны найдвартай ажиллагааг батлах боломжгүй.

## Илгээх

Багшийн docx болон node_modules нь .gitignore-д орсон. Public GitHub remote одоогоор тохируулаагүй тул push, Teams Turn in хийгдээгүй. README-ийн оюутны нэрийг нөхөөд, public репозиторийн холбоосыг Teams Assignment-д оруулж Turn in дарна.
`;
fs.writeFileSync('README.md', report);
console.log(analysis);
