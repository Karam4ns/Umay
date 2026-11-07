# Uzun işler ve bağımsız izleyiciler

7 Kasım 2026 — 0.8.0 sonrası uygulama. Kullanıcı 0.8.0'ı kurarken geliştirmeye devam edilmesini istedi. Dayanak: kullanıcının uzun süreli uygulama kullanımı, kodlama araçlarını takip etme ve yeni yönlendirmede aynı yerden devam etme talepleri; `general-assistant-scope.md` ve 0.8.0 açık kabul matrisi.

## Amaç ve sözleşme

Umay'ın etkili görevi ile salt okunur izleme ayrılır. Kullanıcı başka bir iş verirken eski uygulamadaki beklenen durumu izlemeye devam edebilir. Gerçekleşen koşul yeni kullanıcı yetkisi sayılmaz; yalnız aynı asıl isteğin devam noktasını hazırlar. Hiçbir izleyici odak değiştirmez veya girdi göndermez. Girdi sahibi boşaldığında otomatik devam yalnız aynı oturumda açıkça izleme/devam talep edilmiş görevde mümkündür; F8/Dur tüm otomatik devamları yerelde durdurur. Yeniden açılışta otomatik iş oynatılmaz.

İzleyici kimliği hesap/cihaz, kaynak görev ve hedef pencere PID/handle veya Chrome profil/sekme/origin ile bağlanır. Pencere/sekme kapanması, profil değişimi, hassas aşama, bağlantı kopması, süre ve hesap değişimi açık durumdur; hedef değişmişken başarı sayılmaz. Kaynak durumu modele yeni işlem yetkisi vermez.

## Uygulama ve kabul sırası

- [ ] Ayrı salt okunur izleyici kayıtçısı, bounded koşullar, tek uçuş ve uzun süre/epoch denetimi; değişiklik, görünme/kaybolma ve kararlı sonuç.
- [ ] Kaydedilen bekleme ve hazır kuyruğu; yeni iş esnasında izlemeyi koruma; tek girdi sahibi, açık duraklatma/devam/iptal ve yeniden açılışta seçerek devam.
- [ ] Native arka plan pencere okuması ve Chrome'da seçili sekmeyi değiştirmeyen okuma; gizli/profil/kapalı hedef sınırları.
- [ ] Sohbet içinden araçlar ve görünen izleyici durumları; F8/Dur ve hesap çıkışı; bekleyen eski soruya yeni işin yanlışlıkla yanıt sayılmaması.
- [ ] Saatlerlik sanal zaman, çakışan yeni iş, koşul yarışı, gecikmiş okuma ve gerçek test uygulaması/Chrome kabulü. Gerçek saatlerlik ve profesyonel uygulama kabulü ayrı kalır.
- [ ] Tam regresyon, sürüm/paket kaynak eşleşmesi, GitHub ve vault belge kopyaları.

## Açık sınırlar

Bu dosyanın oluşturulması özelliğin tamamlandığı anlamına gelmez. 0.8.0 kurulumu ve gerçek kullanıcı oturumu test için değiştirilmez. Ödeme/adres ve diğer geniş kabul maddeleri kendi kayıtlarında açık kalır; birkaç izleme testi bunları kapatmaz.
