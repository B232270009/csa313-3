# Лаб 3 — локал API setup

Express сервер нь зааврын гурван endpoint-ийг хэрэгжүүлсэн:

| Method | Endpoint | Зан төлөв |
| --- | --- | --- |
| POST | /cart/add | `{ok: true, items: 1}` |
| GET | /report | 200–400 мс хүлээгээд `{rows: 20000}` |
| POST | /pay | Ойролцоогоор 5% HTTP 500, бусад үед `{paid: true}` |

PowerShell дээр csa316 хавтаснаас:

```powershell
. .\scripts\env.ps1
cd .\Lab3
npm.cmd start
```

Сервер `http://127.0.0.1:3000` дээр ажиллана. Зогсоох: Ctrl+C.
Шинэ dependency суулгах: `npm.cmd ci`. Синтакс шалгах: `npm.cmd run check`.

Хоёр дахь PowerShell терминалд csa316 хавтаснаас:

```powershell
. .\scripts\env.ps1
cd .\Lab3
k6 run setup-smoke.js 2>&1 | Out-File -Encoding utf8 results/setup-smoke.txt
```

Энэ тест нь endpoint-үүдийн бүтэц ба холболтыг шалгана. `/pay`-ийн зориудын HTTP 500-ийг
setup алдаа гэж тооцохгүй. SLO хэмжилтийн хувьд 500 нь алдаа хэвээр байна.

Дараагийн алхам: гурван чанарын сценарио, SLO хүснэгт, `slo-test.js`,
`slo-test-fail.js`, chaos туршилт болон бодит хэмжилтэд тулгуурласан тайлан.
Setup-ийн 1 iteration гаралт SLO-ийн PASS нотолгоо болохгүй.

Setup-ийг Codex AI туслахаар бэлдсэн.

Setup шалгалт: `npm.cmd run check` амжилттай, k6 smoke-ийн 3/3 check амжилттай.
Бүтэн гаралт: `results/setup-smoke.txt`. Шалгалтын дараа серверийг зогсоосон.
