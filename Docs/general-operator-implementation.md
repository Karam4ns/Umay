# Genel asistan yürütücüsü — uygulama planı

Dayanak: `Docs/general-assistant-scope.md`. Kullanıcı 6 Kasım 2026'da bu kapsamın uygulanmasına tam yetki verdi. Aynı dal/çalışma alanında, mevcut ses ve sunucu entegrasyonunu koruyarak ilerlenir.

## Arabirimler

Dosya ve uygulama araçları `definitions()` ile `{name,description,inputSchema}` döndürür; `perform(name,args,{signal,check,taskId})` gerçek yapılandırılmış sonuç döndürür. `check()` iptal/hesap neslini doğrular. İşlem sonuçları sınırlı sayfalarla modele iletilir; ham içerik deneyim hafızasına kopyalanmaz. Sistem araçları, Chrome MCP ve Windows UI aynı görev durumunu paylaşır.

## Sıra ve bağımlılıklar

1. [x] Genel dosya araçları: kökler/aygıtlar, listeleme/arama, stat/sürüm, metin okuma/yazma, klasör, kopyala/taşı/ad değiştir/geri dönüşüme gönder/aç. Çakışma, Unicode, kopan aygıt, kısmi işlem, iptal ve değişen kaynak testleri. Dosya araçları `src/system-files.cjs`; uygulama katmanından bağımsız.
2. [x] Genel uygulama ve süreç araçları: kurulu/başlatılabilir uygulama keşfi, uygulama başlatma, paket arama/kur/kaldır, gerçek süreç çalıştırma/izleme/durdurma. Komut adı/argümanlar shell birleştirmesine verilmez; yalnız aracın oluşturduğu işler iptal edilir. `src/system-apps.cjs`, `src/process-jobs.cjs`.
3. [x] Sistem araç kayıtçısı, bağlam ve sayfalı sonuç; hesabı/görevi/iptali doğrulayan yürütücü. Genel araç ve tarayıcı/masaüstü geçişi; az sayıda doğrulanmış işlemden oluşan gruplar; her işlem arasında güncel yetki/iptal/sonuç kontrolü.
4. [x] Yönetici yardımcısının kullanıcı tarafından başlatılan yetkili oturumunu görevler arasında koruma; oturum/hesap/çıkış ve iptal yaşam döngüsü; sistem araçlarına gerçek yükseltilmiş çalışma yolu. İlk gerçek UAC onayı kullanıcıya ait kalır.
5. [x] Sunucu görev devri ve planlayıcı sözleşmesini genel araçlar için genişletme. Site/uygulama adlarına sabitlenme yok; sürüm yetenekleriyle eski istemci uyumu. İzole HTTP/DB testinden sonra dağıtım.
6. [ ] Yeni ve farklı test siteleri/uygulamalar, çok adımlı dosya↔web↔uygulama, indirme/yükleme, hata/toparlanma ve yerel durdurma kabulü. Gerçek Windows ve paket kabulü, hız/başarı raporu, kurulum ve GitHub.

## Korunacak özellikler

Sohbetten doğrudan iş devri, gerçek kullanıcı yetkisi, sonuç kanıtı, canlı işlem durumu, Dur/F8, eski yanıt neslini reddetme, model rolleri, varsayılan tarayıcıyla hesap bağlama, STT/TTS ve klonlama. Testler yalnız geçici dosya, test sitesi ve kaldırılabilir test uygulaması üzerinde yan etki üretir. Kullanıcının mevcut uygulamaları/dosyaları test amacıyla silinmez veya değiştirilmez.

## Bağımlılık kontrolü

| Üreten | Tüketen | Sözleşme |
| --- | --- | --- |
| Dosya araçları | Kayıtçı/worker | definitions/perform, AbortSignal ve check, yapılandırılmış gerçek sonuç |
| Uygulama/süreç araçları | Kayıtçı/worker | Aynı sözleşme, taskId ile iş sahipliği, kapatılabilen işler |
| Kayıtçı | Ajan/sunucu | system_tool/tools/result, gerçek araç şemaları, güncel gözlem, eski istemciye yeni eylem yok |
| Yetkili worker | Kayıtçı/yerel yardımcı | Doğrulanmış bağlantı, yalnız uygulama kaynağından çalıştırıcı, hesap/iptal yaşam döngüsü |

Ön kontrol kararı: kullanıcı uygulama/GitHub/sunucu kapsamını açıkça yetkilendirdi; rutin uygulama adımlarında tekrar onay istenmez. Ürün içindeki gerçek kullanıcının belirli işlem yetkisi ve Windows UAC süreci korunur. Her işin uygulandığı iddiası test kanıtına dayanır; eksik kabul açık tutulur.

## Son durum — 0.7.0

İlk beş uygulama katmanı tamamlandı. Birleşik gerçek araç akışı, gerçek modellerle dosya/sonraki mesaj, uygulama yaşam döngüsü, Windows/F8, ses, ayarlar ve paketlenmiş Chrome/yönetici worker kabulü geçti. Ölçümler, başarısız denemeler ve açık geniş donanım/uygulama/hız matrisi `general-operator-verification.md` içinde. 6. adım genel ve sınırsız kabul tamamlandı diye işaretlenmez; doğrulanmış installer/GitHub teslimi raporda ayrıca kaydedilir.

Native araç çağrısı: güncel sistem/MCP şemaları sağlayıcı fonksiyonlarına bağlandı; değişmeyen yerel protokol, gerçek izin/sürüm/iptal kontrolleri ve desteklemeyen sağlayıcıda JSON geri dönüşü korunur. Önceki metin protokolüyle yakalanan model tekrarları ve son kabul `general-operator-verification.md` içinde.

7 Kasım teslim durumu: 0.7.0 test installer'ı üretildi ve kaynak/hash eşleşmesi doğrulandı. Alfa1.2-vision ile gerçek sohbet → dosya/sonraki komut → Chrome formu/POST → dosya zinciri ayrı profillerde 2/2 geçti. Kullanıcı izniyle bu cihazda bilgisayar rolü bu modele atandı; sohbet rolü aynı. Genel 6. adım açık kalır: son Windows odak tekrarı, ilk standart UAC ve geniş uygulama/aygıt/p95 matrisi tamamlanmadı. GitHub kaynak teslimi aynı `codex/computer-model-roles` dalındadır; installer yerel `dist/Umay Setup 0.7.0.exe` dosyasıdır, GitHub release binary'si veya genel otomatik güncelleme yayını değildir.
