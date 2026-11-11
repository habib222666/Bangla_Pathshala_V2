# বাংলা পাঠশালা — Android APK Project

এটি Android Studio-তে খোলার জন্য প্রস্তুত একটি Android project।
অ্যাপটি local WebView-তে বাংলা পাঠশালার v3 interface চালায়, তাই মূল কবিতা ও illustration assets APK-এর ভেতরেই থাকবে।

## কী আছে
- Class 1–3 structure
- Class 1-এর ৬টি কবিতা/ছড়া
- বই থেকে নেওয়া illustration assets
- Search
- Reading page
- ভবিষ্যতে Class 2 ও 3-এর data যোগ করার জায়গা

## APK বানানোর সহজ পদ্ধতি
1. Android Studio ইনস্টল করুন।
2. এই project folder খুলুন: `BanglaPathshala-Android`
3. Gradle sync শেষ হতে দিন।
4. উপরের Run ▶ চাপলে ফোনে/Emulator-এ চালাতে পারবেন।
5. APK চাইলে: **Build → Build APK(s)**।

## গুরুত্বপূর্ণ
এই project-এ এখানে APK binary বানানো হয়নি, কারণ এই পরিবেশে Android SDK/Gradle build toolchain নেই। Project source-টি Android Studio build করার জন্য তৈরি।
