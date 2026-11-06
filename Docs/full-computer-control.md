# Sesle genel bilgisayar kullanımı — tasarım ve uygulama planı

> 6 Kasım kapsam teyidi: örnek isimler/komutlar ürün sınırı değildir. Genel web, uygulama, dosya/aygıt, birleşik görev, yönetici ve hız kabul çerçevesi: `Docs/general-assistant-scope.md`. Önceki birkaç başarılı senaryo genel kapsamın tamamlandığı anlamına gelmez.

> Uygulama: `superpowers:executing-plans` ile bu oturumda sırayla; her davranış için RED→GREEN testi ve sonunda bağımsız bütün değişiklik incelemesi.

**Goal:** Kullanıcı normal sohbette sesli/yazılı talimat verir; Umay uygulama listelerine bağlı kalmadan ekranı inceleyip gerçek Windows fare/klavye girişleriyle çalışır, kullanıcı işlemleri canlı görür ve yerel durdurma komutu model yanıtını beklemez.

**Architecture:** Mevcut Electron/Windows erişim katmanı, ayrı bilgisayar modeli ve sohbet içi izin akışı genişletilir. Yerel kontrol komutları, görev yaşam döngüsü ve uygulama izleme model çağrısından ayrılır. Model anlamsal görevi planlar; yerel yürütücü kısa, doğrulanan adımlar uygular; gözlenen içerik talimat/onay sayılmaz.

**Tech Stack:** Electron45, Node CommonJS, Windows PowerShell5/C# SendInput/UIAutomation, mevcut Seda/Pocket TTS, Veriüssü chat worker.

## Kullanıcının tarifi

Uygulama açma/kurma/kaldırma, Codex/Cursor/Cline/OpenCode/Claude gibi araçları kullanma ve takip etme, site/video bölümleri arasında geçiş ve oyun girişleri örnektir; kapsam bu isimlere veya komut kalıplarına indirgenmez. Ayrı bilgisayar sayfası/mod kutusu eklenmez. Görev, açıklama üretmek yerine uygulamada gerçek girişler yapmalıdır. Yeni sesli talimat, durdurma ve devam etme sohbet içinde kalır. Yıkıcı veya dışarıya gönderim/yayımlama gibi özel etkiler mevcut kullanıcı talimatı/onayıyla; Windows UAC onayı kullanıcı tarafından tamamlanır.

## Genel kısıtlar ve kararlar

- Windows ilk platformdur; mevcut giriş, model rolleri, STT/TTS/klonlama bozulmaz.
- Kullanıcı ekranında gerçek uygulama/fare/klavye hareketleri görünür; uzaktan gizli bir masaüstü açılmaz.
- `dur`/`durdur`/`bekle` yerel önceliklidir; söylenen bir örneğin veya «durma» gibi olumsuz ifadenin parçası dur komutu sayılmaz. Umay'ın kendi sesi mevcut echo filtresinden geçer.
- Duraklatma görev bağlamını saklar; `devam et` güncel ekranla devam eder. F8 kesin durdurmadır. Geç kalan model yanıtı durdurulan nesilden giriş yaptıramaz.
- Süreli basılı girişler en fazla2000ms, durdurma işareti en geç20ms aralıkla kontrol; tuş/fare bırakma `finally` ile. Süresiz veya ağ yanıtı boyunca basılı tuş tutulmaz.
- İzleme salt okunur, en fazla10dakikalık yerel dilimlerle, en az500ms aralıkla; izleme süresi aktif işlem zamanından ayrı tutulur. İzlenen uygulama kendi kendine tamamlansa bile yayınlama/silme gibi ek yetki doğmaz.
- Bir dış model her oyunda insan refleksi/fps'si sağlayamaz; korumalı Windows ekranları ve giriş kabul etmeyen uygulamalar gerçek sınırlama olarak raporlanır. Anti-cheat/UAC atlatma eklenmez.
- Ruling: Mevcut `codex/computer-model-roles` dalında, temiz çalışma alanında devam — yerel runtime/ses modellerini çoğaltmadan kullanır; her adım Git ve test kaydıyla korunur.
- Ruling: Kullanıcının genel kontrol isteği ve önceki kodlama/test yetkisi bu devam çalışmasının kapsamını zaten belirliyor; tekrar tasarım onayı menüsü açılmıyor.

## Review Focus

1. «Durma, devam et» / alıntılanan «dur» yanlış durdurmamalı; gerçek dur kısmi STT'de yerel durmalı.
2. Duraklat→devam sırasında eski model POST'u/geç yanıt yeni göreve giriş yaptıramamalı; conversation sürümü güncel olmalı.
3. Basılı giriş durdurulunca/odak değişince/fail olunca tuş ve fare bırakılmalı; kısmi giriş körlemesine tekrarlanmamalı.
4. Beklenen kodlama işi/video ekranı değişirken yeni kullanıcı talimatı izlemeyi durdurmalı; arka plan gözlemi yanlış pencereye giriş hedefi olmamalı.
5. Ekrandaki terminal/web metni kullanıcı onayı veya yeni görev olmamalı; oturum/hesap değişince eski uygulama bağlamı temizlenmeli.

## Task1 — yerel sesli kontrol ve duraklat/devam

**Files:** `src/ui/computer-commands.js` (yeni), `src/ui/chat-computer.js`, `src/ui/renderer.js`, `src/ui/index.html`, `src/computer-agent.cjs`, `src/device-services.cjs`, `src/computer-shortcut.cjs`, `src/main.cjs`; ilgili unit/Electron testleri.

**Interfaces:** `computerCommand(text) -> 'pause'|'resume'|'stop'|null`; `ComputerAgent.pause()`, `ComputerAgent.resumePaused()`. Normal sohbet ve soruya/onaya yanıt davranışı korunur.

- [x] Yerel komut doğrulama, STT kısmi dur, pause/resume nesil/geç POST/sürüm testleri RED.
- [x] Yalnızca gerçek kontrol komutunu modelden önce yakala; görev durumunu/mikrofonu koru; penceresi küçülünce ses yakalama zamanlamasını yavaşlatma.
- [x] Son bütünleşik ses/UI regresyonları (Task6) geçti; son tam unit paketi171/171.

## Task2 — genel uygulama/oturum bağlamı

**Files:** `src/device-services.cjs`, `src/computer-agent.cjs`, yeni `src/computer-session.cjs`; unit testleri.

**Interfaces:** `ComputerSession.context()`, `update(task, observation)`; `desktopContext.computer` içinde son gerçek görev/durum ve sınırlı foreground/window özeti. Hesap epoch'uyla temizlenir; ekran içeriği yetkilendirme değildir.

- [x] «Sıradaki bölüme geç» bağlamı, eski hesap ve büyük bağlam testlerini RED yap.
- [x] Son görev/uygulama bağlamını yeni sohbet devrine taşı; aktif pencereleri genel gözlemle tanı, isim bazlı uygulama komut listesi oluşturma.
- [x] GREEN; kullanıcı metni aynen ve ayrı aktarılmalı; toplam bağlam12000 sınırı korunmalı.

## Task3 — uzun süren işi yerelde izleme

**Files:** yeni `src/computer-watch.cjs`, `src/computer-agent.cjs`, `src/computer-control.cjs`, `src/native-desktop.ps1`; unit/Windows fixture testleri.

**Interfaces:** planner `watch` eylemi: `{windowHandle, milliseconds<=600000, intervalMs>=500, contains?|absent?|changed?}`; izleme sonucu yalnızca sonraki gözlem/planner için veridir.

- [x] Değişim/metin/zaman aşımı/dur/hesap değişimi testlerini RED yap.
- [x] Salt okunur hedef pencere gözlemi ve iptal edilebilir yerel takip; bekleme sırasında model çağrısı yapma; izlemeyi aktif süreye sayma.
- [x] GREEN; izleme pencereyi odaklamamalı, input için yeni foreground gözlemi gerekmeli.

## Task4 — süreli basılı giriş ve göreli fare

**Files:** `src/computer-control.cjs`, `src/native-desktop.ps1`, `src/computer-agent.cjs`; native protokol/giriş testleri.

**Interfaces:** `hold` `{keys?,button?,milliseconds:1..2000}`; `move_relative` `{dx,dy}`. Native girişin dur işareti, JS kuyruğundan bağımsız okunur.

- [x] Sınır/odak/iptal/kısmi giriş/key-up garantisi testlerini RED yap.
- [x] Kontrollü süreli giriş, mouse button/keyboard birlikte basma ve göreli hareket; iptalde finally ile bırakma.
- [x] GREEN; gerçek Windows'ta yalnızca testin kendi penceresinde basılı giriş ve sesli durdurma testi.

## Task5 — model sözleşmesi ve dar sunucu güncellemesi

**Files:** `server/desktop-context.ts`, yeni helper-only aday/aktivasyon betiği, `tests/server-desktop-context.cjs`.

- [x] Yeni eylem sözleşmesi ve sıradan sohbetin değişmemesi testleri RED.
- [x] Genel uygulama/kurulum/kod/video/oyun görevi planlama, watch/hold/relative ve gerçek kullanıcı yetkisi kuralları; özel uygulama isimleri için sabit yönlendirme yok.
- [x] Adayı immutable image ID ile izole test et; yalnızca gerekli worker/helper modüllerini yedekli güncelle. Ortam/port/public varlıklar korunur.

## Task6 — bütünleşik doğrulama ve paket

- [x] Genel test penceresi: kodlama işi ilerlemesi, site/video sonraki bölüm, uygulama başlatma ve iptal; ekran üzerindeki sahte talimat kullanıcı onayı sayılmamalı.
- [x] Gerçek mikrofon→STT yerel dur→native key-up; model yanıtı bekleyen durumda da dur; F8 alternatifi.
- [x] Unit/Electron/native/ses regresyonları, bağımsız bütün dal incelemesi,0.5.0 installer ve paket bütünlüğü.
- [x] Sonuçlar `Docs/walkthrought.md` ve doğrulama raporuna eklendi; gerçek dış-model/token engeli ayrıca açık bırakıldı.

## Yürütme kaydı

- Başlangıç:0.4.4, commit981d9f5,150 unit testi ve paket/native/ses kabul kayıtları mevcut. Canlı hesapta son model tekrarı token mutabakatına takıldı; bu engel geçilmeden dış model kabulü geçmiş sayılmayacak.
- Resmî kaynaklar: [Windows SendInput](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput), [Electron WebPreferences](https://github.com/electron/electron/blob/main/docs/api/structures/web-preferences.md). Eşit/yüksek yetki ve arka plan zamanlaması kararlarının dayanağı.

- Task1: yerel dur komutu,150ms düzeltilmiş kısmi transcript debounce, pause/continue nesil izolasyonu ve geç POST sürümü:72 ilgili test GREEN. Task2: son görev/uygulama bağlamı, kompakt planner görünümü ve hesap epoch koruması eklendi.

- Task3–6 tamamlandı: yerel pencere/PID takibi, iptal edilebilir basılı giriş, göreli fare, helper-only sunucu güncellemesi, gerçek Windows ve sesli durdurma,171 unit +60 konuşma regresyonu ve0.5.0 paket doğrulandı. Ayrıntılı kapsam/ölçümler: `Docs/full-computer-control-verification.md`.
- Ruling: Yerel durdurmada kabul edilmiş model akışı muhasebesi için terminale kadar okunur — erken upstream iptali kullanım sayısını kaybettirip token mutabakatını kilitleyebiliyor; eski yanıtın giriş yapmasına nesil kontrolü izin vermez. Mevcut eski bilinmeyen kullanım kayıtları elle değiştirilmez.
- Ruling: Windows normal odak kısıtı gözlenen kendi test penceresinde yeniden üretildi; aynı masaüstündeki input thread'leri kısa süreli bağlanıp sonunda ayrılır. Gerçek pencere odağı yeniden doğrulanır; bu yöntem korumalı masaüstü veya yetki sınırını geçmez.
- Bağımsız inceleme:4 önemli/2 küçük bulgu RED→GREEN; son kontrolde açık engelleyici bulgu yok.
- Açık doğrulama: mevcut hesap token mutabakatı nedeniyle son gerçek dış-model tam kabulü; bütün uygulama/oyunların tek tek performans sertifikası veya fiziksel mikrofon ortamı testi değildir.
