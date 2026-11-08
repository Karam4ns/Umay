# Bilgisayar ve Chrome kontrolü — 0.8.4 kabul kaydı

2026-11-08. Kullanıcının “komple incele” talebiyle, 0.8.3 üzerine mevcut genel kontrol akışı incelendi. Plan: `control-reliability.md`. İlk kaynak44d1c7f; bağımsız inceleme düzeltmeleriyle son uygulama kaynağı **aa20404**.

## Doğrulanan hatalar ve değişen davranış

1. Yerel kayıtların son arama/video görevleri, birkaç gerçek fill/click sonrasında “Görev açıklaması çok uzun” ile kesilmişti. Özgün komut kısa olmasına rağmen iç session/aktif hedef/geçmiş/sonuç toplamı11900 sınırını geçiyordu. Önce gerçek Agent testinde aynı hata üretildi. Artık yardımcı bağlam ayrı bir JSON kopyasında daraltılır; gerçek gözlemler değişmez. Özgün kullanıcı isteği, mevcut belirli onaylar ve güvenlik kuralları korunur. Sayfalama offset/toplamları ve araç keşfi kalır. Sığmayan değiştirilemez kapsam sessizce kesilmez; iç bağlam hatası kullanıcıya “kısa komut yaz” diye yansıtılmaz.
2. MCP'nin seçili sayfası, kullanıcının gerçek öndeki sekmesi olmayabiliyordu. Windows pencere PID'si bağlı yerel Chrome browser endpoint'inden doğrulanır; MCP üzerinden başlık/görünürlük okunarak sayfa eşlenir. Yeni görevde MCP sekme seçimi + kesin native pencere odağı, taze snapshot'tan önce yapılır. Belirsiz eşleşmede eski sekmeye giriş gönderilmez.
3. Bir komut gözleminde hata veya hassas pencere okunamaması, önceki pencereyi hâlâ taze hedef bırakabiliyordu. RED/GREEN testiyle, komut yenilemesi başlangıcında eski hedef geçerliliği kaldırıldı. Umay öndeyken önceki pencere yalnız güncel Windows listesindeki aynı PID/handle ile tekrar bulunursa kullanılır.
4. Windows focus/girdi yolunda yalnız HWND karşılaştırılan yerler vardı. Gözlenen PID artık odaklama ve giriş isteklerine taşınır; yanlış PID için giriş öncesi ret gerçek native testte doğrulandı. Windows'un odak reddi ile kapanmış pencere ayrı kodlardır; odak reddi bir giriş başarısı veya yönetici onayı sayılmaz.

Chrome web işlemleri MCP içinde kalır. `chrome-identity.cjs` yalnız yerel debug endpoint'inde `SystemInfo.getProcessInfo` okur; DOM, gezinme veya klavye/fare yürütücüsü değildir. Endpoint/WS adresi loopback, port, kimlik bilgisi ve browser UUID açısından doğrulanır. Parola/OTP veya tam kullanıcı ekranı bu kimlik sorgusuna gönderilmez.

## Son test kanıtı

| Test | Sonuç ve sınırı |
| --- | --- |
| Tam Node | **473/473**, sürüm0.8.4, son uygulama kaynaklarıyla `npm test`. Başlangıç0.8.3 tabanı460 testti. |
| Konuşma/klonlama | **52/52** mevcut runtime Python ile. STT/TTS/klonlama kaynakları değişmedi; yeni fiziksel mikrofon veya ses kalitesi kabulü değildir. |
| `browser-agent` / `computer-prompt` | Kısa komut + büyük eski bağlam önce aynı hatayı verdi, sonra tamamlandı. İstek/onay aynı; gerçek session ve snapshot nesneleri değişmedi. |
| `browser-mcp` / `chrome-identity` | Gerçek MCP sözleşmesi sınırında görünür sekme, yanlış süreç, geç profil yanıtı, loopback/UUID/timeout ve keşif. Büyük aday listesi belirsiz sayılır. |
| `electron-control-reliability.cjs` | Gerçek Chrome + MCP: ayrı açma → tam `Duru test ğüş` araması → üçüncü sonuç → sistem üzerinden pencere büyütme. Taze UID ve gerçek sayfa sonuçları. Sağlayıcı kontrollüdür, bulut model testi değildir. |
| Aynı gerçek testin hedefleri | Windows Ctrl+2 ile kullanıcı sekmesi değiştirilirken eski MCP seçimi korundu; sync gerçek görünen sekmeyi buldu. Açık endpoint'li mevcut bağlantı, endpoint'siz mevcut bağlantı ve yeni client ile tekrar kullanılan Umay profili geçti. MCP sayfa kimlikleri bağlantılar arasında aynı kabul edilmedi; URL/gerçek süreç kanıtı karşılaştırıldı. |
| `electron-focus-identity.cjs` | Yanlış PID focus ve tuş işlemi önce hatalı kabul edildi; düzeltme sonrası ikisi de native katmanda reddedildi. Doğru kendi penceresine focus ve gerçek foreground doğrulandı; yanlış giriş olayı0. |
| `electron-control-primitives.cjs` | Gerçek UIA Edit, replace+Unicode+Enter, basılı W/Shift/fare iptalinde bırakma **37ms**, göreli fare, arka plan UIA ve kapanmış pencere. Parola gözlemde yer almadı. |
| `electron-computer-workflow.cjs` | Gerçek hover/sağ/orta/çift tık, dikey/yatay scroll, drag, iki pencere odağı, gerçek planlayıcı-girdi-doğrulama döngüsü ve fiziksel **F8** geçti. Yalnız testin sahip olduğu pencereler kullanıldı. |
| `electron-background-watches.cjs` | Chrome arka plan sekme okuması güncel UID'yi bozmadı; Windows arka plan UIA diğer işin odağını çalmadı; aynı asıl görevde kalan işlem bir kez yapıldı. |
| `electron-elevated-jobs.cjs` | Gerçek Windows yönetici token/özel worker: A sürerken normal B, durum okuma/exit0, park edilmiş C'yi durdurma ve erişimi kapatma geçti. İlk standart Windows UAC kullanıcıya aittir. |
| Checkout / sohbet | Gerçek Chrome loopback mağazasında adres, değişen toplam, cüzdan, yanlış/doğru OTP, kayıp yanıt ve yinelenen gönderim engeli geçti. Gerçek sohbet UI/IPC ve yazılı/sesli görev devri/rol/onay akışı geçti. Fixture başlamadan önceki dev runtime/login ve kapanış yarış uyarıları logda korunur; gerçek hesap/mikrofon kabulü sayılmaz. |

## Bağımsız inceleme

Tek taze salt okunur inceleme iki Important, sıfır Critical/Minor verdi. İkisi de yeniden üretildi ve tek düzeltme turunda kapatıldı:

- Endpoint'siz mevcut Chrome, native PID eşlemesinde `null` endpoint yüzünden duruyordu. MCP'nin paketlenmiş Puppeteer kaynağıyla aynı stable Chrome `DevToolsActivePort` kaydı çözülüp aynı browser UUID, MCP `--ws-endpoint` bağlantısına ve salt okunur PID doğrulamasına bağlandı. RED/GREEN ve gerçek endpoint'siz Chrome kabulü geçti. Debug izni veya bağlantı yoksa kullanıcıya bağlantı hatası gösterilir; rastgele Chrome seçilmez.
- İlk40 adayda tek görünen eşleşme,41. adayda aynı başlıklı diğer pencere varken kesin sayılabiliyordu. Sayfa1+41 görünür testi önce yanlış `connected:true`, sonra belirsiz sonuç verdi.40'tan fazla uygun aday incelenemiyorsa seçim yapılmaz; başlığı farklı sekmeler aday filtresiyle elenir. Büyük sekme kümesinde tüm adayların görülmüş gibi davranılmaz.

## Teknik kararlar ve açık kabul

- Task1/2 aynı Agent dosyasını değiştirdiği için kaynaklar iki yarım yama yerine ortak uygulama commit'inde kaydedildi; maliyeti ilk kaynak commit'inin iki düzeltme alanını birlikte taşımasıdır.
- İncelemeci evrensel Windows odak davranışını değerlendirmedi. Bu tur sahip olunan pencerelerde odak/F8/giriş testleri geçti; önceki0.8.3'teki bütün OS reddi nedenleri giderildi diye sunulmaz. Gerçek reddin ayrı durması ve kullanıcıya devam yolu göstermesi korunur. Kalan maliyet, Windows reddinde kullanıcı pencereyi öne getirmeden görevin devam edememesidir.
- Canlı bulut model kalitesi bu tur ölçülemedi: yetkili kısa ömürlü test oturumu yoktu; kurulu uygulamanın şifreli cookie deposunun salt okunur kopyası kilitli olduğundan erişilemedi. Orijinal profil değiştirilmedi. Sahte sağlayıcıyla geçen kontrol döngüsü canlı model zekâsı kabulü değildir. Kullanıcı ana cihazındaki gerçek görevler ayrı geri bildirimle değerlendirilir.
- Üretim veriussu.com/10203 servisi, modeller/rollerin kullanıcının mevcut ataması, hesap bağlama, ses ve güncelleme feed'i değiştirilmedi. Geniş profesyonel uygulamalar/çok monitör/gerçek saatler/oyun/genel alışveriş kabulü açık kalır.
- Otomatik onay denetimi, yalnız kendi geçici şifreli test kopyası ve ilk tanıdan kalmış kendi Chrome sürecini temizleme komutunu `blocked by policy` ile reddetti; temizlik yapılmadı, alternatifle aşılmadı. Bu artık test kaynakları uygulama düzeltmesinin veya installer'ın parçası değildir.

Dayanaklar: [Windows foreground sözleşmesi](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow) ve [Chrome SystemInfo protokolü](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/). Eşleme ayrıca sabit MCP1.12.0 içindeki BrowserManager/Puppeteer ve gerçek Chrome kabulüyle doğrulandı.

## Paket ve teslim

0.8.4 NSIS build exit0. Son80 uygulama dosyası, native yardımcı ve dört konuşma modülü kaynakla;361 Chrome MCP runtime dosyası sabit npm paketiyle eşleşti. Ayrıca22474 runtime dosyası /918827387 bayt kaynakla SHA256 düzeyinde aynı; yalnız üretilen pycache karşılaştırmadan çıkarıldı. İzole ASAR hafıza/kasa/Obsidian/SSH2/izleyici/kalıcı checkout testi geçti.

Son ASAR modülleri, paket native yardımcısı ve **gerçek paket Umay.exe MCP host** ile yeni kontrol testi geçti: görünür kullanıcı sekmesi, explicit/endpoint'siz/recovered Chrome ve ayrı arama → üçüncü sonuç → sistem maximize. İlk paket denemesinde auto aşamasının foreground eşlemesi false döndü; test kendi doğrulanmış PID/handle'ını yeniden öne getirerek ön koşulu doğruladığında geçti. Başarısız deneme saklandı; kullanıcı odağının değiştiği koşulda yanlış başarı veya evrensel odak garantisi çıkarılmaz. Üretim kaynağında bu tekrar için değişiklik yapılmadı. İzole ASAR + gerçek paket yönetici worker testi ve paket Chrome close/reconnect/click/readback/yardımcı kapanması da geçti.

- Installer: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/control-0.8.4/Umay Setup 0.8.4.exe`
- Boyut: **350514240 bayt**, blockmap: **365815 bayt**.
- SHA256: `be2824c1f3a3c285f848667eb7ed5a66e71d42ad42285bd7582198c68f08ac3b`
- SHA512: `nKUv+U/C5uhQMeVeOZ1f26HMcT2xkhzGxScTUlAHBCX5N8cMsm78lQYCn0lmDmUwtivtcXTScI1hYcUoZhsktg==`
- latest.yml sürüm/boyut/SHA512 eşleşti. Authenticode `NotSigned`; imza kullanıcının önceki kararıyla ertelidir.
- exe/blockmap/latest.yml/verification.json ana checkout'a kopyalandı; dört dosyanın kaynak/hedef SHA256'ları aynı.
- Eski0.8.3 SHA256 yeniden doğrulandı: `4305607cdab96f905406416ab45dd613fcc6bbedb9360965c196a5e4bff3bf16`.
- Kaynak `codex/obsidian-continuity` dalında tutulur; son38 Markdown belge kopyası Obsidian `Umay/Docs` içindedir. Otomatik kurulum, genel updater veya üretim servisi yayını yapılmaz.
