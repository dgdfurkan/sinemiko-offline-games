# Sinemiko Yolda

Sinem için internetsiz oyun koleksiyonu. Telefona ya da tablete bir kere ana ekrana eklenir, sonrası tamamen çevrimdışı: trende, yolda, uçakta çalışır.

**Adres:** https://dgdfurkan.github.io/sinemiko-offline-games/

## İçinde ne var

| Oyun | Tür | Ne yapıyorsun |
| --- | --- | --- |
| Dönerci Sinem | Dükkan | Döneri doğru pişmişken kes, siparişi sar, yetiştir |
| Kafe Sinemiko | Dükkan | Bardağı çizgisine kadar doldur, latte köpüğünü yap |
| Maraşlı Sinem | Dükkan | Topları külaha diz, müşteriyi kaçır, bahşiş topla |
| Takı Atölyesi | Dükkan | Kurallara uyan kolyeyi, bilekliği, küpeyi diz |
| Beden Fethi | Lab | Soruları bil, vücut haritasındaki organları fethet |
| Gen Makası | Lab | Kodonları çevir, hedef proteini yazdır |
| Nano Yolculuk | Lab | Damarın içinde uç, oksijen topla, pıhtıdan kaç |
| Antikor Atışı | Lab | Fırlatıcıyı ger, mikropları yık |
| Petri Kabı | Lab | Hücreleri birleştir, atomdan canlıya çık |
| Mitoz Fırtınası | Lab | Bir hücreye dokun, zincirleme bölünme başlasın |
| Damar Bağla | Lab | Aynı renkli uçları kesişmeden birleştir, kan aksın |
| Harf Kovanı | Kelime | İki sürüm: Harf Çiçeği (bölümün bütün kelimeleri) ve Petek Avı (hamleli kovan) |
| Biyo Bulmaca | Kelime | Laboratuvar terimlerinden kare bulmaca |
| Bee Koyun | Fizik | Köpekle sürüyü ağıla götür, her gün başka bir engel |
| Çiz Geç | Fizik | Tebeşirle çiz, çizdiğin düşsün, topu kalbe ulaştır |
| Atari Salonu | Eski tip | DNA Yılanı, Hücre Kırıcı, Virüs İstilası |
| Kahvehane | Eski tip | Furkan'a karşı tavla ve pişti |

Ana ekranda günlük görevler, yolculuk durakları, kıyafet dolabı ve favori/sıralama ayarı var.

## Nasıl çalışır

Derleme adımı yok. Saf HTML, CSS ve ES modülleri. Servis çalışanı bütün dosyaları önbelleğe alır, ikinci açılıştan sonra ağ gerekmez.

- `index.html` giriş, `js/main.js` yönlendirme ve tema
- `js/core/` ortak parçalar: ses, kayıt, arayüz, efekt, 3B yardımcıları, kare bekçisi
- `js/games/` oyunlar, her biri `mount(root, api)` döndürür
- `js/registry.js` oyun listesi, `js/art.js` kart çizimleri
- `data/words.txt` Türkçe kelime listesi, `js/data/questions.js` soru bankası
- `tools/build.py` `sw.js` dosyasını ve sürüm numarasını üretir, CSS'teki px değerlerini rem'e çevirir

### Geliştirme

```bash
python3 -m http.server 5180
python3 tools/build.py   # dosya ekledikten ya da CSS değiştirdikten sonra
```

CSS'i px ile yaz, `tools/build.py` rem'e çevirir. Kök yazı boyutu ekranla birlikte büyüdüğü için arayüz tablette kendiliğinden ölçeklenir.

## Telefona kurmak

- iPhone: Safari ile aç, paylaş düğmesi, "Ana Ekrana Ekle"
- Android: Chrome ile aç, menü, "Uygulamayı yükle"

İlk açılışta bütün dosyalar iner. Ondan sonra uçak modunda da açılır.
