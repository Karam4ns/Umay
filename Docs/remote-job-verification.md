# Yönetici ve SSH uzun iş devamlılığı — 0.8.3 kabul kaydı

2026-11-08: 0.8.2 üzerine, sohbetten başlatılan yönetici/SSH uzun işlerini başka görev sırasında koruyup sonucuyla aynı asıl göreve dönme eklendi. Tasarım ve plan: `remote-job-continuity.md`. Uygulama kaynak commit'i `4cd9ae6`; worker taşıması önce `09946d4` içinde kaydedildi.

## Son davranış

- Yönetici işçisi aynı hesabın görev/istek/iş kimliklerini ayrı tutar. Bir işin durumunu okumak başka görevi değiştirmez. Tek RPC beklemesini iptal etmek ile görevin süreçlerini durdurmak ayrı mesajlardır.
- Yerel, yönetici ve SSH işleri aynı izleyici/sahiplik koordinatörüne katılır. Backend park alındısı doğrulanmadan pending iş silinmez. Geç alındı, Dur veya hesap değişiminden sonra işi yeniden etkinleştiremez. Kısmi park başarısızlığında önceki sahiplik korunur.
- Başka görev normal kullanıcı modunda kalır; eski yerel işi sonraki `administrator:true` başka backend'e taşımaz. Yönetici erişimi kullanıcıya ait ilk gerçek Windows yetkilendirmesini gerektirir; güvenli UAC ekranı kullanıcı yerine onaylanmaz.
- SSH çıkış kodu/çıktısı gerçek bağlantıdan okunur; parola gizlenir. Kopan bağlantı veya kabulü belirsiz komut yeniden çalıştırılmaz. Geç exec callback'i iptal/çıkıştan sonra TERM/close dener; bunun uzak süreci kesin durdurduğu iddia edilmez.
- Dur/F8 mevcut koordinatör üzerinden park edilmiş işleri de durdurmayı dener. Worker erişimi/bağlantısı kaybolursa tamamlandı/stopped uydurulmaz. Sonucun belirsiz kaldığı aynı oturumda yeni etkiler güvenli biçimde durabilir; kullanıcı sunucu durumunu ayrıca doğrulamalıdır. Genel uzak süreç yeniden bağlama/otomatik replay eklenmedi.

## Doğrulama

| Test | Gerçek kanıt / sonuç |
| --- | --- |
| Başlangıç tabanı | Temiz `4de04b5`, **440/440** Node testi. |
| Son Node regresyonu | **460/460**, `npm test`. Kaynak son sürüm **0.8.3** ile. |
| Konuşma/klonlama | Mevcut runtime Python ile **52/52**. STT/TTS/klonlama kaynakları değiştirilmedi; bu bir yeni mikrofon veya insan ses kalitesi ölçümü değildir. |
| `system-worker-host.test.cjs` | Gerçek çocuk süreç A/B sahipliği, park edilmiş isteğin iptali, diğer işi durdurmama, worker kapanması; 140 ardışık görevde boş bağlamların temizlenmesi ve geç dosya işleminin durdurma yanıtından önce bitmesi. |
| `system-worker-pipe.test.cjs` | Gerçek Windows özel pipe ve ayrı worker süreci. Bootstrap yükseltme bayrağı simüledir; gerçek yönetici kabulü olarak sayılmaz. |
| `remote-job-continuity.test.cjs` | Yönetici A + normal B, başarısız/geç park alındısı, worker lease yenilenmesi, hesap değişimi, eski terminal alındısının korunması, yanlış backend'e terfi etmeme. Gerçek alt süreçler, kontrollü taşıma. |
| `ssh-job-continuity.test.cjs` | Gerçek loopback SSH2 sunucusu ve arkasında gerçek geçici çocuk süreç. A sürerken B dosya işi tamamlandı; tek exec, gerçek bitiş/çıkış kodu ve gizlenmiş çıktı okundu. Kopma unknown kaldı. Gerçek `ComputerAgent` + izleyici döngüsü, kontrollü sağlayıcı ile aynı asıl göreve döndü. Canlı bulut model testi değildir. |
| `ssh-exec-cancellation.test.cjs` | Abort/logout sonrası geç SSH kanalında en iyi çabayla TERM/close, çalışan kabul sonucu döndürmeme. |
| `process-wait-adapter.test.cjs` | Senkron adaptörde bile bekleme gerçek zamanlayıcı/Stop'a yer verir; microtask döngüsü UI olaylarını kilitlemez. |
| `electron-elevated-jobs.cjs` | **Gerçek Windows yetkilendirme/token/özel pipe:** yükseltilmiş PowerShell A kendi geçici dosyasına `IsInRole(Administrator)=True` yazdı. A arka plandayken normal B dosyası oluştu. A exit0/çıktı okundu; park edilmiş C açık durdurma ile sonlandı; erişim kapatılınca normal iş devam etti. Kullanıcı uygulamalarına klavye/fare girişi yapılmadı. |
| Önceki sipariş/OTP | Gerçek Chrome yerel test mağazası, değişen toplam, yanlış/doğru OTP, kayıp yanıt ve tekrar gönderim engeli geçti. Mevcut sahte kasa/giriş/OTP Chrome testi geçti. Gerçek dış hesap veya alışveriş kullanılmadı. |
| Önceki sohbet UI/IPC | Gerçek sohbet adres/toplam/ödeme teyidi ve yerel OTP/sipariş kartı kontrolleri geçti; test başlangıcındaki geliştirme runtime/login yarışı logda korunur. Gerçek kullanıcı login veya STT kabulü sayılmaz. |

## Bağımsız inceleme ve düzeltmeler

Tek taze, salt okunur son inceleme üç Important bulgu verdi: SSH `process_wait` olay döngüsü açlığı, eski terminal işin lease kaybında unknown'a çevrilip normal işleri engellemesi ve yönetici worker'ının 128 yaşam boyu görevden sonra dolması. Critical/Minor yoktu. Üçü de önce başarısız testlerle üretildi, tek düzeltme turunda kapatıldı. Aynı turda uygulayıcı, dosya isteğinin iptal alındısından sonra tamamlanabilmesi için ayrı bir başarısız drain testi ekledi; durdurma artık bu isteklerin bitişini bekler. Hedefli **18/18**, ardından tam **460/460** geçti. İkinci bir inceleme yapıldığı iddia edilmez.

Tam regresyonda yakalanan ayrı mevcut sorun: kaynak UUID'sindeki uzun rakam dizisi kart verisi filtresine takılıp Obsidian aktarımını sessizce atlayabiliyordu. Sabit UUID ile RED/GREEN testi eklendi. İstisna yalnız metadata kaynak kimliği/kanonik anahtar içindeki UUIDv4 içindir; normal içerik, parola alanı ve gerçek kart dizisi kontrolleri korunur. 27 yakın hafıza/Obsidian testi geçti.

## Açık masaüstü odak kabulü

`electron-background-watches.cjs` içindeki Chrome arka plan sekme okuması ve güncel UID korunması geçti. Ancak Windows pencereyi öne getirme aşaması üç denemede `NATIVE_WINDOW_UNAVAILABLE` verdi. Sonuç gizlenmedi ve tüm masaüstü kabulü geçti diye işaretlenmedi.

Karşılaştırma: önceki **0.8.2 ASAR** içinden aynı native sınıfla, yalnız yeni oluşturulan geçici pencerede aynı istek çalıştırıldı; **aynı hata** alındı. `computer-control.cjs` ve `native-desktop.ps1` dosyalarının 0.8.2 ile byte/hash olarak aynı olduğu doğrulandı. Bu turdaki backend değişikliği bu kontrol yolunu değiştirmedi. Windows'un odak izni/aktif masaüstü koşulu için ayrı inceleme gerekir; yeni sürümde genel odak başarısı iddiası yoktur. Test yalnız kendi pencerelerine giriş istedi; kullanıcı pencerelerine dokunmadı.

## Kararlar ve ölçülmemiş sınırlar

- Mevcut Windows/CommonJS/SSH2 ve izole worktree korundu; worker host ile girdi/iş sahipliği ayrımı uygulayıcının mimari seçimidir. Yeni bağımlılık ve üretim sunucusu değişikliği yoktur.
- SSH TERM/exit bütün torun süreçlerin bittiğini her sunucuda kanıtlamaz. Gerçek sunucu, uzun fiziksel saatler, profesyonel uygulamalar ve geniş aygıt/çok monitör kabulü tamamlanmadı. Ağ kaybında genel uzak PID yeniden bağlama eklenmedi; belirsiz kayıtlar otomatik devam etmez.
- Aynı hesabın bilinen iş kimliğinden özgün owner görevin bulunması taban davranıştır; bu tur yeni bir görevler arası kullanıcı yetkilendirme garantisi getirdi diye sunulmaz. Sayfa/araç çıktısı yeni izin değildir.
- Yönetici cache/bağlantı düzeni testlerinin geçmesi tüm uygulamalarda süresiz anlık kontrol kanıtı değildir. Yerel/Dur sözleşmesi ve durduğu doğrulanamayan süreç uyarısı korunur.
- Kullanıcının “diğer yeri bozma” koşulu nedeniyle başarısız Windows odak testi için kontrol motoru bu backend çalışmasında genişletilmedi. Sıradaki somut inceleme bu odak reddi; kullanıcıdan ana cihaz geri bildirimi gelirse o kayıt önceliklidir.

## Paket ve teslim

0.8.3 test paketi hazır. 78 uygulama dosyası, native yardımcı ve dört konuşma modülü kaynakla aynı; Chrome MCP1.12.0/SDK1.32.2 için361 runtime dosyası eşleşti. İzole ASAR içinde kaynak node_modules geri dönüşü olmadan gerçek DPAPI/kasa/katalog/SSH2, kalıcı sipariş ve izleyici regresyonu geçti. Gerçek paket Umay.exe ile MCP bağlantı yenileme/click/readback/yardımcı çıkışı geçti. Ayrıca **izole son ASAR ve gerçek paket Umay.exe yönetici worker'ı** ile Windows yetkilendirme, yükseltilmiş A + normal B, readback/stop/erişim kapatma kabulü geçti.

- Ana checkout: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/remote-jobs-0.8.3/Umay Setup 0.8.3.exe`
- Boyut: **378207595 bayt**; blockmap: **392816 bayt**.
- SHA-256: `4305607cdab96f905406416ab45dd613fcc6bbedb9360965c196a5e4bff3bf16`
- SHA-512 (latest.yml ile aynı): `mtXCvioheoh0aQ6F74NqlUnSzn7t7FJSBwibwCucjhr6MfLJbyY/mLzI/1xbxUyHTI8sb7qiqjZqk9HpNrjruw==`
- Kaynak/ana checkout exe, blockmap, latest.yml ve verification.json hash'leri aynı. Authenticode: `NotSigned`.
- Önceki0.8.2 SHA-256 korundu: `54aa3999c4f66f4aab80fa21b0263d1aecf48edb215713ec54db99116ceebaa7`.
- Kaynak GitHub `codex/obsidian-continuity` dalı; son36 Markdown belge kopyası Obsidian `Umay/Docs` içinde tutulur.
 Önceki 0.8.2 dosyaları korunur. İmza kullanıcının önceki kararıyla ertelidir; imzasız test installer hazırlanır. Genel updater feed'i, üretim site/10203 sohbet servisi veya kullanıcı kurulumuna otomatik müdahale yapılmaz.
