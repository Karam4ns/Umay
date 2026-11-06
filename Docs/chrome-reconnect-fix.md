# Chrome kapandıktan sonra Netflix açma hatası — 0.6.1

## Gerçek hata

6 Kasım 2026, kurulu **0.6.0** üzerinde kullanıcının iki Netflix isteği yerel sohbet ve işlem günlüğünden incelendi. Sohbet modeli görevi doğru devretti. Görevler 14:21 ve 14:22 UTC'de, hiç işlem adımı uygulamadan **157/143 ms** içinde `BROWSER_TOOL_FAILED` ile başarısız oldu. Sesli okunan genel hata, bağlantı nedenini açıklamıyordu.

Kurulu uygulamanın aynı Umay Chrome profiline salt okunur MCP `list_pages` çağrısı yapıldı. Gerçek yanıt: **Could not connect to Chrome / ECONNREFUSED**. Chrome kapanmış, MCP yardımcısı ise önceki hata ayıklama portuna bağlı kalmıştı. `connect()` mevcut istemciyi döndürdüğünden `ChromeBrowser.ensure()` tekrar çalışmıyor; sonraki gözlemler de aynı kapalı porta gidiyordu. Bu durum temiz/geçici profille yapılan ilk açılış testlerinde görünmemişti.

## Dar düzeltme

- Yönetilen Chrome'da her `list_pages` öncesi profilin gerçek yerel uç noktası doğrulanır. Chrome kapalıysa aynı hesap profiliyle yeniden açılır.
- Uç nokta değiştiğinde eski MCP yardımcısı kapatılır; eski gözlem ve hazır bilgisi geçersiz kılınır; yeni uç noktasına yeni MCP istemcisi bağlanır. Sağlıklı uç noktasında aynı yardımcı kullanılır.
- Yenileme salt okunur gözlem tarafındadır. Tıklama, yazma veya gezinme çağrısı bağlantı hatası aldıysa kendiliğinden yeniden gönderilmez. Kullanıcı durdurduğunda devam eden uç nokta kontrolü yeni yardımcı başlatamaz.
- Bağlantının işlem sırasında kesilmesi, kullanıcıya Türkçe ve yeniden deneme yönlendirmesiyle bildirilir. Genel sayfa işlem hatasından ayrı `BROWSER_CONNECTION_LOST` kodu tutulur.
- MCP'nin `Başlık (adres)` biçimindeki metin sekme listesinden gerçek URL ayrıştırılır. Sayfa başlığı URL alanına karıştırılmaz; URL gizleme kuralları korunur.

Sunucu planlayıcısı, roller, STT/TTS, klonlama ve ses ayarlarında değişiklik yapılmadı. Bu düzeltme model yanıt süresini kısaltma iddiası taşımaz.

## Doğrulama

1. Önce iki yeni birim testi eski istemcide başarısız oldu. Gerçek, yalnız teste ait Chrome kapatılıp mevcut MCP istemcisiyle devam edildiğinde aynı **ECONNREFUSED** hatası üretildi.
2. Düzeltmeden sonra **215 Node testi** geçti. Uç nokta değişimi, eski yardımcının kapanışı, sağlıklı bağlantının korunması, eski gözlemin reddi, durdurma sırasında iptal, bağlantısı kesilen yazma/tıklamanın tekrar edilmemesi ve başlıklı URL biçimi kapsandı.
3. Gerçek Chrome kapatıldı → aynı MCP nesnesi Chrome'u yeniden açtı → Netflix'in gerçek başlık/adresi doğrulandı.
4. Gerçek ajan + MCP ile form doldur/tıkla/geri oku testi geçti. Uzun beklemeyi durdurma bu denemede **112 ms**; sayfa korunarak yeniden bağlantı geçti.
5. Gerçek Veriüssü API'sinde seçili **Alfa1.2 / Qwen3-VL** ile, görevden önce yalnız teste ait Chrome kapatıldı ve eski MCP istemcisi özellikle korundu. Normal sohbetten görev devriyle Chrome yeniden açıldı; Netflix **tek `navigate_page`** ile açıldı, gerçek DOM başlığı/adresi doğrulandı. Native Windows erişimi sıfır; işlem deneyimi kaydedildi. Görev devri **13,2 saniye**, toplam **26,7 saniye**. Bu tekil ölçümde model beklemesi devam eder.
6. Son paket kaynak/native/konuşma karşılaştırması: **47 uygulama dosyası ve 4 konuşma modülü** eşleşti. MCP'nin **361 çalışma dosyası**, sabitlenmiş 1.12.0 paketiyle aynı.
7. Son `app.asar` ve MCP çalışma ortamı proje dışında ayrı konuma taşınarak gerçek **0.6.1 Umay.exe** ile çalıştırıldı. Harici Node/npm ve proje bağımlılıklarına geri dönüş olmadan Chrome kapat/yeniden bağlan, gezinme, tıklama, DOM'dan geri okuma ve yardımcının kapanışı geçti.

Gerçek model testi ayrı Chrome profili ve geçici doğrulama oturumuyla yapıldı; kullanıcının açık uygulaması kapatılmadı. Geçici web oturumu test bitiminde iptal edildi. Sunucuya yeni kod dağıtımı gerekmedi.

## Kurulum teslimi

`dist/Umay Setup 0.6.1.exe`: **351.717.795 bayt**, SHA256 `73111777ba79ef855f0001149b5fa5d80c95d8d2c211d190c7e82c82780ac808`. SHA512/uzunluk `latest.yml` ile doğrulandı; blockmap üretildi. Installer, doğrulanan `dist/chrome-reconnect-0.6.1/win-unpacked` dizininden oluşturuldu; kaynak/native/konuşma eşleşmesi sonrasında tekrar kontrol edildi.

Kaynak ve doğrulama belgeleri GitHub'daki `codex/computer-model-roles` dalına teslim edilir. Önceki kullanıcı kararı gereği imzasız test installer'ıdır. Bu çalışmada genel güncelleme sunucusuna kurulum yüklenmedi ve çalışan kullanıcı uygulaması değiştirilmedi; düzeltmenin uygulamada çalışması için **0.6.1 kurulmalıdır**.
