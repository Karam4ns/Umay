# Uzun işler ve bağımsız izleme — 0.8.1 kabulü

7 Kasım 2026. Kullanıcının 0.8.0'ı kurarken geliştirmeyi sürdürme talebiyle, `codex/obsidian-continuity` dalında `eba2300` temeli üzerinde çalışıldı. Çekirdek `0df06b4`, son uygulama `15c76d3`. Bu sürüm, genel asistan hedefinin uzun iş ve devamlılık aşamasıdır; bütün uygulamalarda kusursuz kullanım kabulü değildir.

## Değişen davranış

- Umay bir pencere veya Chrome sekmesinde koşul beklerken girdi sahipliğini bırakabilir. Kullanıcı bu sırada başka bir iş verebilir. Koşul kararlı biçimde gerçekleşirse iş hazır kuyruğuna alınır; girdi sahibi boşaldığında aynı asıl görevin kalan kısmı yeni gözlemle sürdürülür.
- Yerel, Umay'ın başlattığı süreçler yeni istek sırasında sahipliği korunarak arka plana alınır. İkinci işten sonra gerçek çıkış durumu okunur; eski süreç yeniden başlatılmaz. Yönetici/SSH işleri bu park etme yolunda desteklenmez; mevcut iş korunur ve çakışan operatör işi başlamaz.
- Bekleyen işler normal sohbet içinde görünür. Dur/F8 bütün otomatik devamları durdurur ve Umay'ın sahip olduğu süreçleri sonlandırır. Bir izleyicinin duraklatma düğmesi yalnız o izlemenin otomatik devamını durdurur; çalışan süreç işi varsa süreç kendi başına sürebilir. İptal düğmesi o işe ait süreci de sonlandırır.
- Birden fazla bekleyen iş varsa “devam et” üzerine seçim sorulur; “ikinci”, “ikincisi” veya sayı söylenerek doğru iş seçilir. Bu yerel seçim buluta yeni sohbet olarak gönderilmez. İlgisiz yeni bir istek, bekleyen soru varken `yeni iş: ...` biçiminde belirtilebilir.
- Umay yeniden açıldığında izleyiciler duraklatılmış gelir. Kullanıcı seçmeden eski işlem otomatik oynatılmaz. Chrome bağlantısı, profil/sekme/origin veya pencere/PID değişmişse hedef yeniden doğrulanır.

## Doğrulama

| Deneme | Sonuç ve sınır |
|---|---|
| Tam Node regresyonu | **419/419** geçti. Eski sohbet/hesap/rol/iptal/ses yönlendirme testleri dahil. |
| Konuşma/klonlama | Paketle aynı Python runtime ile **52/52** geçti. STT/TTS ve klonlama kaynakları değiştirilmedi. Bu tur fiziksel mikrofon/ses benzerliği kabulü yapılmadı. |
| Bağımsız scheduler | 12 saat sanal zaman, koşul kararlılığı, görünme/kaybolma, hazırken değişen koşul, hesap değişimi, geç okuma, iptal/devam yarışı ve yeniden açılışta otomatik başlamama doğrulandı. Gerçek 12 saat beklenmedi. |
| Yerel süreç | Gerçek alt süreç ikinci görev sırasında tamamlandı; dosyaya yalnız bir kez yazdı ve ilk göreve dönüldü. İptal edilen durum okuması arka plan sürecini öldürmedi. Açık Dur, ön planda tamamlanmış iş olsa da park edilmiş süreci durdurdu. Belirsiz durdurma yeni iş başlatmayı engelledi. |
| Gerçek Windows | Yalnız testin iki geçici penceresi kullanıldı. UIA arka plan okuması diğer pencerenin odağını değiştirmedi; hazır koşulundan sonra ilk PID/pencereye dönüldü ve eksik dosya sonucu bir kez yazıldı. |
| Gerçek Chrome | İlk sekme arka planda okunurken ikinci sekmenin seçimi ve mevcut UID'si korundu; ikinci sekmede gerçek düğme çalıştı. Eski bağlantı kimliği reddedildi. |
| Gerçek model | Alfa1.2-vision ile yalnız geçici test sitesi/dosyaları: arka plana geçiş **5.361 ms**, ikinci dosya işi ve ilk sekmeye dönüp tek düğmeyle doğrulama dahil toplam **13.825 ms**, **7 model turu**, düğme etkisi **1**. Bu tek ölçüm genel p50/p95 veya hız garantisi değildir. |
| Gerçek sohbet UI/IPC | İzleyici kartları, belirsiz devam sorusu, sesli yanıt yönlendirmesiyle ikinci iş seçimi, yanlış “tamam” yanıtının iş başlatmaması ve ön plandaki iş tamamlandıktan sonra yerel Dur geçti. Sahte hesap/sağlayıcı kullanıldı; gerçek STT kaydı değildir. |
| Eski sohbet UI/IPC | Yazılı/sesli yönlendirme, soru/onay, sahte UAC akışı, rol ataması, normal sohbet ve hesap temizliği geçti. Test fixture'ına sistemden masaüstüne açık geçiş eklendi; gerçek Windows UAC kendi kendine onaylanmadı. |
| Gerçek giriş/F8 | Kendi test pencerelerinde fare/klavye, iki pencere, scroll/drag ve fiziksel F8 durdurma geçti. |
| Paket | **73 uygulama dosyası**, native yardımcı, **4 konuşma modülü** ve **361 MCP dosyası** kaynaklarla eşleşti. Ayrı ASAR içinden hafıza/kasa/SSH2/yeni izleyici araçları ve kalıcı izleyici durum/kararlı koşul testi geçti. Gerçek paketlenmiş Umay.exe Chrome MCP host, yeniden bağlantı ve yardımcı kapanışı geçti. |

## Bulunan hatalar ve düzeltmeler

İlk gerçek model denemesi 18 tur sınırında başarısızdı: `system_start` ile `browser_start` arasında dönüyordu. Bağlam küçültülürken `task_watch_start` aracının şeması düşüyor, yalnız adı kalıyordu. Aynı eksikliği gerçek sunucu araç-deklarasyon kodu üzerinden üreten test önce başarısız oldu. Araç şemasının önceliği düzeltildikten sonra test ve gerçek model akışı geçti; başarısız deneme başarı sayılmadı.

Bağımsız incelemede üç önemli bulgu doğrulandı ve bir düzeltme turunda kapatıldı:

1. Ön plandaki ikinci iş tamamlandıktan sonra Dur/Stop, arka plan işini kaçırabiliyordu. Yerel komut uygunluğu bütün arka plan işlerini kapsar; backend terminal/boş görevde de sahip olunan süreçleri durdurur. Gerçek renderer ve yerel alt süreç testleri eklendi.
2. Bekleyen bir `devam` okuması, kullanıcı bu sırada iptal/duraklat yaptıktan sonra izleyiciyi yeniden başlatabiliyordu. Kayıt bazlı kontrol sürümü ile geç sonuç reddedilir. Her iki yarış önce RED, sonra GREEN doğrulandı.
3. Yeni istek, ilgisiz iş duraklatılırken boş durumdaki ortak Chrome bağlantısını kapatıp eski izleyiciyi bozabiliyordu. Boş bağlantı korunur; üç görevli yaşam döngüsü testi doğrulandı. Etkin bir Chrome işleminin iptali bağlantıyı gerçekten kapatmayı gerektirirse eski kimlik sessizce yeni bağlantıya taşınmaz; yeniden hedefleme gerekir.

Gerçek pencere fixture'ı ilk denemelerde Windows odağını ve DOM→UIA yayımını eşzamanlı varsayıyordu. Test, kendi ikinci penceresine açıkça odaklanıp gerçek UIA durumunun yayımlandığını bekleyecek şekilde düzeltildi; odak çalmama iddiası bundan sonra sınandı. UI testlerindeki başlangıç login/runtime uyarıları fixture sınırlamasıdır ve gerçek giriş/mikrofon kabulü diye raporlanmaz.

## Sınırlar ve sonraki kapsam

Aynı anda yalnız bir etkili görev vardır; izleyiciler girdi göndermez. En fazla 12 bekleyen iş, bir görevde 32 izleme dönüşü, 120 işlem adımı ve 30 dakika etkin çalışma sınırları korunur. Bekleme süresi etkin çalışma bütçesinden ayrılır. Varsayılan izleme 12 saat; üst sınır 24 saattir. Gerçek saatler süren profesyonel uygulama ve model güvenilirliği ayrıca kabul gerektirir.

Yönetici/SSH süreçlerini arka plana park etme, yeniden başlatma sonrasında süreç sahipliğini yeniden edinme, çoklu Chrome bağlantılarını aynı anda yürütme, AutoCAD/Unreal/Photoshop/oyun ve geniş aygıt/çok monitör kabulü açık kalır. Bütün sitelerde sipariş/adres/ödeme, OTP ve belirsiz ödeme tekrarını önleyen kapsamlı kabul de tamamlanmadı. Bu sürüm bunların bittiği anlamına gelmez.

Bağımsız incelemenin kapsam dışında bıraktığı alanlar için karar: profesyonel uygulama/ödeme/gerçek saatler kabulü açık tutuldu; değiştirilmemiş 0.8.0 kripto temeli tekrar incelenmedi; imzalama kullanıcı kararına göre sonraya bırakıldı ve paket eşleşmesi ayrı doğrulandı. Bunların maliyeti sonraki kabul/entegrasyon çalışmasıdır. Ertelenen küçük inceleme bulgusu yoktur.

## Teslim

0.8.0 kurulumu ve önceki installer'lar korunur. 0.8.1 ayrı imzasız Windows test paketidir; üretim güncelleme kanalına otomatik yayımlanmaz. Kaynaklar [codex/obsidian-continuity](https://github.com/Karam4ns/Umay/tree/codex/obsidian-continuity) dalında teslim edilir. Son uygulama commit’i `15c76d3`; sonraki teslim commit’i yalnız belgeler ve paket kabul testini günceller. Test görüşmeleri yalnız kendi kimlikleriyle arşivlendi; geçici doğrulama oturumu iptal edildi. Üretim sunucu kodu bu aşama için değiştirilmedi.

### Doğrulanmış kurulum dosyası

- Yol: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/continuity-0.8.1/Umay Setup 0.8.1.exe`
- Boyut: **378.199.291 bayt**; blockmap **392.714 bayt**.
- SHA256: `f09ec617b22cda78dab08d658141c5887fabc70ffe1a70292558a63c992ff5a4`
- SHA512: `2i7QDENE5bbEvJLd89EjHKP3faq9/EaKmWHs8EYFLW+nJuAhJUpmltN3noQfv7+ja5JMX73BI5xPvsxaC6H3XQ==`
- `latest.yml` sürüm/boyut/SHA512 ve asıl çalışma klasörüne kopyalanan installer SHA256 eşleşti. Aynı klasörde `verification.json` vardır.
- Bu paket cihazda otomatik kurulmadı; kullanıcının 0.8.0 testini değiştirmez. Sunucu/genel otomatik güncelleme kanalına yayımlanmadı.
- Proje belge kopyaları vault içinde `Umay/Docs` altındadır; erişim bilgileri dahil edilmez.
