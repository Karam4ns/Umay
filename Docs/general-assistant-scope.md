# Umay: genel kişisel bilgisayar asistanı

## Bağlayıcı ürün kapsamı — 6 Kasım 2026

Kullanıcının Netflix, Chrome ve dosya örnekleri bir site, uygulama veya komut listesi tanımlamaz. Umay, kullanıcının yazılı/sesli yönlendirmesiyle bilgisayarı genel olarak kullanıp iş tamamlayan kişisel asistandır. Uygulama adı, internet sitesi veya dosya işlemi değişince yeteneğin ortadan kalkması ürün hatasıdır. Basit örneklerde hızlanmak, genel kontrol kapsamının tamamlandığını göstermez.

Bu belge, `full-computer-control.md` kapsamını yeniden teyit eder ve sonraki uygulama/kabul işlerini genişletir. 0.6.2'deki kesin site açma kısa yolu bir performans optimizasyonudur; ürün mimarisinin veya başarı ölçütünün yerine geçmez. Bu kayıt çalışan sürümün aşağıdaki her işi şimdiden güvenilir şekilde yaptığı iddiası değildir.

## Kullanıcının istediği yetenekler

| Alan | Genel kapsam |
| --- | --- |
| Tarayıcı | Kullanıcının istediği siteyi bulma/açma; sekmeler, oturumlar, kayıt/giriş, çok adımlı formlar, talep oluşturma, sipariş ve ödeme akışları, medya oynatma, yükleme/indirme, dosya seçici ve site içi gezinme. Chrome MCP ana yürütücüdür; yerel pencere gerektiğinde masaüstüne geçilir. |
| Uygulamalar | Windows uygulamalarını keşfetme, açma, odaklama ve kullanma; kurulum/kaldırma, ayarlar ve güncelleme ekranları; Electron/webview, erişilebilir yerel uygulama ve görsel/canvas arayüzleri. Kodlama araçlarının işlerini kullanıcının talimatıyla yönetme ve izleme. İsimler kapsam sınırı değildir. |
| Dosyalar ve cihazlar | Kullanıcının yetkili olduğu bağlı disk, çıkarılabilir aygıt ve ağ konumlarını keşfetme; arama, okuma, oluşturma, kopyalama, taşıma, yeniden adlandırma, silme ve istenen yere gönderme/yükleme. Kapalı/bağlı olmayan aygıt erişilebilir gibi gösterilmez; gerçek OS izinleri ve bağlantı durumu değerlendirilir. |
| Birleşik görevler | Tarayıcıda indirilen dosyayı bulma, uygulamada açıp düzenleme, kaydetme ve istenen yere yükleme gibi geçişleri aynı görevde tamamlama. Sonraki sesli yönlendirme önceki görevin güncel durumundan devam eder. |
| Süreklilik | Kısa komut, uzun iş, uygulama izleme, soru/izin, düzeltme, duraklatma ve devam aynı sohbet içinde kalır. Kullanıcı işlemleri canlı görür; yerel Dur/F8 model yanıtını beklemez. |
| Öğrenme | Doğrulanmış işlem sonuçları ve toparlanmalar kaynaklı deneyim olarak saklanır. Sonraki görevde yararlanılır; eski koordinat, öğe kimliği, parola veya onay körlemesine oynatılmaz. |

Bir uygulamanın/site içeriğinin veya başka bir ajanın talebi kullanıcı yetkisini genişletmez. Kullanıcının sipariş verme, silme, gönderme veya yayımlama talimatı varsa kapsamı korunur; henüz açıkça belirlenmemiş ürün/alıcı/tutar/hedef gibi önemli ayrıntılar tamamlanmadan işlem uydurulmaz. Zaten verilmiş belirli izin tekrar tekrar istenmez.

## Mevcut durumdan çıkarılan eksikler

- Genel ekran/girdi döngüsü, model rolleri, MCP araç keşfi, tarayıcı/masaüstü geçişi, izleme, izin, yerel Dur/F8 ve işlem deneyimi altyapısı vardır. Bunlar korunarak genişletilir.
- 0.6.2 ölçümleri, yalnız kesin ana sayfa açma ve bir form senaryosunu doğrular. Her site/uygulama veya karmaşık görev kabulü değildir. Son bulut masaüstü denemesindeki yanlış/tekrarlı odaklama sorunları ve odak değişimi genel görev güvenilirliğinin ayrıca sınanması gerektiğini gösterir.
- Mevcut native protokol ağırlıklı olarak ekran/UIAutomation ve gerçek girdi sağlar. Hızlı genel dosya işlemleri, uygulama keşfi ve paket yönetimi için amaç odaklı yerel araç katmanları ayrıca ele alınmalıdır; bunlar bugün tamamlanmış sayılmaz.
- Yönetici yardımcısı bugün geçici ve görev kapsamlıdır. İlk yetkilendirmeden sonra izin verilen yönetici işlerini sürekli yapabilecek bir aracı servis kurulmuş değildir.

## Teknik yön: genel yetenekler ve kısa yürütme yolu

Bu bölüm, kullanıcının genel kapsamını mevcut kodla karşılayacak uygulama yönünü kaydeder; belirli isimler için ayrı ayrı komut yazma yaklaşımı değildir.

1. **Ortak görev durumu:** gerçek istek, hedef nesneler, mevcut adım, tamamlanan etkiler, bekleyen izinler, sonuç kanıtı ve sonraki kullanıcı yönlendirmesi bir görevde tutulur. Sohbet modeli bağlamı devreder; işi yeniden anlattırmak veya başlangıca döndürmek gerekmez.
2. **Genel araç keşfi ve yönlendirme:** web için Chrome MCP; uygulama denetimleri için Windows erişilebilirliği/yerel araçlar; dosya ve uygulama yönetimi için şemalı OS işlemleri; gerekli yerde görsel fare/klavye. Yürütücü site/uygulama adına göre sabitlenmez. Aynı görev araçlar arasında geçebilir.
3. **Verimli planlama:** model bir sonraki anlamlı kararı verir. Bir formdaki bilinen alanları doldurma veya belirli dosyaları kopyalama gibi açık, doğrulanabilir işlemler araç katmanında birlikte yürüyebilir. Her tuş için yeniden büyük modele gidilmez; sonucu veya yetkisi belirsiz işlemler kör bir makroya dönüştürülmez.
4. **Güncel kanıt:** öğe/pencere/yol gerçekten doğrulanır. Doğru hedef seçilmeden girdi gönderilmez; zaman aşımı uygulamanın hiçbir şey yapmadığı varsayımıyla tekrar edilmez. Arayüzdeki mevcut durum devam noktasını belirler.
5. **Yerel öncelik:** sesli durdurma, F8, nesil iptali ve tuş/fare bırakma modelden bağımsız kalır. Birleşik/birlikte yürütülen işlemler de adımlar arasında iptal denetler; kullanıcı kontrolü kaybolmaz.
6. **Genel deneyim:** uygulama/sayfa görevlerinden doğrulanmış yöntemler geri çağrılır. Araç şeması ve gerçek nesne kimliği yeniden çözülür; önceden başarılı olmuş olması yeni izin sayılmaz.

## Yönetici yetkisi

Yönetici uygulamalarını kullanma, kurulum/kaldırma ve gerekli sistem işlemleri kapsam içindedir. Windows'un güvenli masaüstündeki gerçek UAC onayını sıradan otomasyonun kendi kendine vermesi hedef olarak yazılmaz. Microsoft, yükseltme için kullanıcı rızası/kimlik doğrulaması ve güvenli masaüstü ayrımını tanımlar: [UAC çalışma biçimi](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works).

Kullanıcının istediği kesintisiz yönetici işlemlerine yönelik teknik seçenek: kullanıcının ilk kurulum/yetkilendirmede gerçek Windows onayıyla açtığı, kimliği doğrulanan ve kullanıcı tarafından kapatılabilen yetkili yardımcı. Bunun oturum/görev kapsamı, kalıcılığı, yükseltilmiş süreç başlatma ve yönetici UI'sine erişimi ayrıca tasarlanıp sınanmalıdır. Bir aracı servisin varlığı, bütün güvenli ekranlara erişim veya tüm uygulamaların otomatik kontrolü kanıtı değildir. Mevcut geçici yardımcı bu seçenekle karıştırılmaz. UAC ilkesi veya kilit ekranı kapatılmaz.

## Hız ve başarı birlikte ölçülür

Tek bir siteyi açma süresi ürün hızı ölçütü olamaz. Her işte ilk gerçek eylem, toplam tamamlama, model bekleme, araç/girdi, gözlem, toparlanma ve yerel durdurma ayrı ölçülür. Başarısız ya da yanlış hedefte sonuçlanan hızlı işlem başarı sayılmaz. Ağdaki indirme/sayfa yüklemesi ve model sağlayıcısı beklemesi açıkça ayrılır.

Kabul; soğuk/açık uygulama, ilk/tekrar görev, çoklu pencere, çoklu monitör ve değişen arayüz durumlarında tekrarlı çalıştırmalarla yapılır. p50/p95, doğru tamamlama oranı, tekrar edilen etkiler ve kullanıcıdan gereksiz yardım isteme sayısı raporlanır. Henüz ölçülmemiş hız sınırları karşılanmış gibi açıklanmaz. Genel görevlerdeki tur sayısı ve sonuç başarısı, basit kısa yollar kadar önceliklidir.

## Sonraki uygulama ve kabul sırası

1. Genel görev devrini ve görev durumunu denetle: yapma isteğinde yönerge anlatmaya dönme, hedef karıştırma, tekrar odaklama ve geç/ilgili olmayan yanıtları ele al. Tek/çok adımlı istek, anaforik devam ve kullanıcı düzeltmesi testleri.
2. Aynı model turunda birden fazla genel aracı tanıtan karar sözleşmesini netleştir. Doğru yerde bounded işlem grubu, sonuç koşulu ve iptal; site/uygulama adına bağlı olmayan doğrulanmış yürütme.
3. Genel dosya/uygulama/kurulum araç katmanlarını ekle. Önce ayrı geçici dizinler, disk/aygıt benzetimleri ve kaldırılabilir test uygulaması; kullanıcının gerçek dosyaları/kurulu programları kabul testi için silinmez.
4. Tarayıcı↔masaüstü↔dosya geçişli görevleri çalıştır. Kayıt/giriş ve çok adımlı formda doğrulama/kullanıcı katkısı gereken durumlar; indirme/yükleme ve dosya seçicide kesintisiz devam.
5. Yönetici aracısının yetkilendirme ve yaşam döngüsünü ayrı doğrula. Kullanıcı yetkisi, bağlantı kesilmesi, hesap geçişi, iptal, kötü/tekrarlı istek ve gerçek yükseltilmiş UI kabulü.
6. Genel regresyon matrisi ve performans raporuyla teslim et. Önceden örneklerde kullanılmamış site/uygulama/isimler de testte bulunmalı; birkaç tanıdık ad üzerinden başarı ilan edilmemeli.

| Kabul grubu | En az doğrulanacak uçtan uca davranış |
| --- | --- |
| Web | Daha önce denenmemiş test sitesinde çok sayfalı form, kayıt/giriş, dosya yükleme/indirme, medya ve sekme yönetimi; talimatla devam/düzeltme. Gerçek sipariş yerine etkisiz test mağazasıyla sipariş akışı. |
| Masaüstü | Birden fazla türde test uygulamasında aç/odaklan/kullan/kaydet/kapat; boş erişilebilirlik ağacında görsele geçiş; kullanıcı odağı değiştirince yanlış pencereye yazmama. |
| Dosyalar | Unicode/uzun yollar, ad çakışması, birden çok sürücü, çıkarılabilir/erişilemeyen aygıt, toplu seçme/taşıma/kopyalama/ad değiştirme/silme; kısmi sonuç ve geri alma mümkün olduğunda kurtarma. |
| Kurulum ve yönetici | Test uygulamasını kur/kullan/kaldır; yükseltilmiş ve normal süreçler; izin/ret/iptal ve tekrar bağlantı. |
| Birleşik görev | Web'den indir → doğru dosyayı bul → uygulamada işle → kaydet → talimat verilen hedefe yükle; ortada Dur/Devam ve hedef değişikliği. |
| Performans | Aynı görevlerin tekrarlı p50/p95 süreleri ve doğru sonuç oranları; yerel Dur/F8 ve basılı giriş bırakma; hata sonrası kör tekrar olmaması. |

Bu belge kullanıcı kapsamının kaydı ve sonraki işlerin kabul çerçevesidir. Bu turda yeni bir kontrol motoru, dosya aracı veya yönetici servisi uygulanmış olarak işaretlenmez.
