# Adres, OTP ve sipariş devamlılığı

Kullanıcının genel asistan talebindeki alışveriş, her siparişte adres teyidi, kayıtlı adresi önerme, yeni adresi hafızaya alma, cüzdan/kart ve OTP ile aynı işte devam gereksinimleri uygulanır. Bu, 0.8.1 açık kabul matrisinin sıradaki parçasıdır; gerçek sipariş veya ödeme test yetkisi verilmiş sayılmaz.

## Yaklaşım ve sınırlar

Mevcut Chrome MCP ve yerel hafıza/kasa korunur. Yalnız model yönergesine güvenmek yerine, sipariş başına yerel ve kalıcı bir durum makinesi eklenir. Her siteye özel kısa yollar genel yürütücünün yerini almaz. Alternatif olan site başına otomasyon veya yalnız prompt ile teyit, genel kapsam ve belirsiz gönderimden sonra tekrar etmeme gereksinimini karşılamaz. Bu seçim uygulayıcının teknik kararıdır; kullanıcının ayrıntılı mevcut gereksinimleri ve doğrudan devam talebi uygulama yetkisidir, yeni bir tasarım belgesine ayrı onay verdiği iddia edilmez.

Sipariş hedefi hesap + görev + Chrome bağlantısı/profil/sekme/origin ile bağlıdır. Yerel taslak, görünür ürün/tutar/adres/ödeme etiketi ve son gönderim düğmesini gerçek sayfa okumasıyla bağlar. Kullanıcıya aynı sohbet içinde bu bilgiler gösterilir; adres teyidi her yeni siparişte alınır. Son gönderim öncesi sayfa değişmişse eski onay kullanılmaz. Gizli kart/parola ve OTP normal katalog/sohbet/model çıktısına eklenmez.

Son gönderimden **önce** SQLite içinde deneme kaydı tutulur. Sonucu belirsiz, bağlantısı kopmuş veya uygulama yeniden başlamış gönderim otomatik tekrar edilmez; yalnız salt okunur durum doğrulaması ve kullanıcının yerel incelemesiyle çözülür. Bu, site/banka tarafında dağıtık exactly-once işlem garantisi değildir. Genel modelin bir sayfanın ödeme olduğunu hiç bildirmeden farklı araçlarla işlem yapması yalnız anahtar sözcüklerle evrensel olarak kanıtlanamaz; etkin sipariş aşamasında alternatif mutasyon yolları kapatılır ve bu sınır raporlanır.

## Uygulama planı

**Hedef:** Mevcut sohbette adres/ödeme teyidi, yerel OTP ve yeniden gönderilmeyen sipariş akışı.
**Mimari:** Ayrı `CheckoutFlow` kalıcı durum makinesi; `CheckoutTools` genel araç adaptörü; mevcut `InteractionWaits`, `BrowserMcp`, şifreli kasa ve sohbet kartına küçük entegrasyon.
**Teknoloji:** Mevcut Electron/CommonJS/SQLite/Chrome MCP; yeni bağımlılık yok.
**Spec:** Kullanıcının önceki ayrıntılı alışveriş gereksinimleri ve `obsidian-continuity-design.md`, `general-assistant-scope.md`.

### 1. Kalıcı sipariş ve tek gönderim

- [x] `src/checkout-flow.cjs`, `tests/checkout-flow.test.cjs`: hesap/görev/hedef bağlama; genel araçlarla hazırlanan sepet→yerel teyit→onay→gönderiliyor→belirsiz/sayfa sonucu gözlendi. Gönderimden önce durable işaret; eski sayfa/onay/hesap, paralel gönderim ve yeniden başlatma testleri önce RED, sonra GREEN.
- [x] Modelin `approved:true` iddiası yerel kullanıcı onayı yerine geçmez. Kalıcı kayıtlara OTP, kart, parola veya ham görüntü yazılmaz. Belirsiz etki tekrar gönderilemez.

### 2. Adres, seçim, OTP ve araç sınırları

- [x] `src/checkout-tools.cjs`, `tests/checkout-tools.test.cjs`: adresleri kaynaklı katalogdan öner, yerel yeni adresi kaydet; görünür sipariş özetiyle aynı sohbette teyit; cüzdan/kart etiketi. Genel araçlara ekle ve şemaları bağlamda koru.
- [x] `src/interaction-waits.cjs`, `src/device-services.cjs`: soru kimliği, bağlantı/sekme, süre ve iptal nesli; OTP yalnız yerel fill/submit, güncel alan kimliğini tekrar doğrula; geç yanıtı yeni göreve uygulama.
- [x] `src/browser-mcp.cjs`, `src/computer-agent.cjs`, `src/ui/chat-computer.js`: etkin siparişte son gönderim dedicated yol; alternatif click/Enter/script/native/process ile atlama engeli; soru/onay/dur/hesap değişimi korunur. Sonuç belirsizse yerel anlaşılır durum ve eski siparişi görüntüleme; kör yeniden ödeme yok.

### 3. Gerçek kabul ve teslim

- [x] Yerel sahte mağazada çok adımlı adres, tutar değişimi, cüzdan seçimi, yanlış/doğru OTP, tek sipariş, bağlantı kaybı ve tekrar isteme; gerçek Chrome ve gerçek sohbet UI/IPC. Gerçek müşteri hesabı, banka/kart veya alışveriş kullanılmaz.
- [x] Mevcut uzun işler, Dur/F8, hesap, STT/TTS ve klonlama regresyonları; bağımsız bütün değişiklik incelemesi ve bulguların RED/GREEN çözümü.
- [x] 0.8.2 imzasız test installer, kaynak/paket eşleşmesi/hash/boyut/blockmap, GitHub ve vault `Umay/Docs` güncel kopyaları. Eski 0.8.1 kurulumu değişmez; genel güncelleme yayını yapılmaz.

## İnceleme odağı

İptal sırasında geç OTP; aynı origin içinde tutar/adres değişimi; bağlantı/sekme kimliği yeniden kullanımı; gönderimin uygulandığı fakat yanıtın kaybolduğu durum; restart ve yeni görevde eski onayı/ödemeyi yineleme. Bunlar modül ve gerçek test mağazası kabulünde ayrı sınanır. Kapsamlı bütün siteler/profesyonel uygulamalar/gerçek saatler kabulü açık kalır.

## Gerçekleşen kabul

440 Node, 52 konuşma/klonlama regresyonu; gerçek Chrome yerel test mağazası, gerçek sohbet UI/IPC, aynı görevde gerçek ajan döngüsü (kontrollü sağlayıcı), arka plan Chrome/Windows ve son ASAR/MCP paket kontrolleri geçti. Ayrıntı ve ölçülmemiş sınırlar `Docs/checkout-verification.md` içinde. Banka mutabakatı ve genel mali semantik, gerçek siparişler ve bütün mağazalarda canlı model araç seçimi tamamlanmış sayılmaz.
