# Kullanılan Açık Kaynaklar

Bu projedeki oyun kodu bize ait. Yanında taşıdığımız hazır parçalar ve kaynaklar:

## Kütüphaneler

- **three.js** (`vendor/three.module.min.js`), sürüm 0.160.0, MIT Lisansı, telif hakkı 2010-2024 three.js yazarları. https://github.com/mrdoob/three.js
- **Matter.js** (`vendor/matter.min.js`), sürüm 0.19.0, MIT Lisansı, telif hakkı Liam Brummitt ve katkıda bulunanlar. https://github.com/liabru/matter-js

## Yazı Tipleri

`fonts/` klasöründeki dosyalar Google Fonts üzerinden alınmıştır ve SIL Open Font License 1.1 ile dağıtılır:

Paytone One, Nunito, Caveat, Press Start 2P, Pixelify Sans, Playfair Display, Bungee, Pacifico, Baloo 2, Exo 2, JetBrains Mono, Patrick Hand.

## Kelime Listesi

`data/words.txt` iki açık Türkçe kelime listesinin birleşimidir, 3-10 harf arası sözcükler süzülmüştür:

- https://github.com/mertemin/turkish-word-list
- https://github.com/CanNuhlar/Turkce-Kelime-Listesi

Birkaç sözcük (dna, rna, atp ve iki isim) elle eklenmiştir.

## Sesler ve Çizimler

Bütün sesler Web Audio ile çalışma anında üretilir, kayıt dosyası yoktur. Bütün çizimler ve simgeler bu proje için elle yazılmış SVG ve tuval çizimleridir.
