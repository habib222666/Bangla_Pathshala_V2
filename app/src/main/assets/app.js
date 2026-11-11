let items=[];
let currentPoem=null;
let currentIndex=-1;
let showingFavorites=false;
let speaking=false;
let globalSearchMode=false;
let globalSearchResults=[];
let selectedClasses=[1];
let selectedPoemCategory = null;
let selectedClassTitle = "";
let poetBioRequestId = 0;

const SUPABASE_URL = "https" + String.fromCharCode(58,47,47) + "gycyxkieruvqvlucxzkl" + ".supabase.co";
const SUPABASE_KEY = "sb_publishable_xDwG72KglVj5qT6fF9Utig_zepfttD2";



const ADMIN_UID = "be427014-37d6-41a1-8474-a7b166e18c49";
const ADMIN_SESSION_KEY = "bp_poet_admin_session";
let adminSession = null;

function saveAdminSession(session) {
  adminSession = session;
  if (session) {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
  updateAdminLoginUI();
}

async function refreshAdminSession() {
  if (!adminSession || !adminSession.refresh_token) return null;

  try {
    const response = await fetch(
      SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refresh_token: adminSession.refresh_token
        })
      }
    );

    if (!response.ok) throw new Error("Session refresh failed");

    const data = await response.json();
    if (!data.user || data.user.id !== ADMIN_UID) {
      throw new Error("Unauthorized admin account");
    }

    data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
    saveAdminSession(data);
    return data;
  } catch (error) {
    saveAdminSession(null);
    return null;
  }
}

async function getValidAdminSession() {
  if (!adminSession) return null;

  if (Number(adminSession.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60) {
    return await refreshAdminSession();
  }

  return adminSession;
}

async function supabaseRequest(path="", options={}) {
  const session = await getValidAdminSession();
  const token = session && session.access_token
    ? session.access_token
    : SUPABASE_KEY;

  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Supabase HTTP error:", response.status, errorText);
    throw new Error("Supabase error " + response.status + ": " + errorText);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function updateAdminLoginUI() {
  const button = document.getElementById("adminLoginBtn");
  const form = document.getElementById("adminLoginForm");
  const logout = document.getElementById("adminLogoutBtn");
  const status = document.getElementById("adminLoginStatus");
  const modal = document.getElementById("adminLoginModal");

  const loggedIn = !!(adminSession && adminSession.user &&
    adminSession.user.id === ADMIN_UID);

  if (button) {
    button.classList.remove("hidden");
    button.innerHTML = loggedIn
      ? "<span>✓</span><small>এডমিন প্রবেশ করেছেন</small>"
      : "<span>🔐</span><small>এডমিন</small>";
  }

  if (form) form.classList.toggle("hidden", loggedIn);
  if (logout) logout.classList.toggle("hidden", !loggedIn);
  const poetControls = document.getElementById("poetPageAdminControls");
  if (poetControls) poetControls.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) {
    document.getElementById("editBtn")?.classList.add("hidden");
    document.getElementById("editArea")?.classList.add("hidden");
    document.getElementById("text")?.classList.remove("hidden");
    document.getElementById("addPoemBtn")?.parentElement?.remove();
    document.querySelectorAll(".deleteUserPoem").forEach(button => button.remove());
  } else if (currentPoem) {
    document.getElementById("editBtn")?.classList.remove("hidden");
  }
  document.dispatchEvent(new Event("admin-session-changed"));

  if (status) {
    status.textContent = loggedIn
      ? "এডমিন হিসেবে প্রবেশ করা হয়েছে।"
      : "কবি পরিচিতি পরিচালনার জন্য লগইন করুন।";
  }
}

async function restoreAdminSession() {
  try {
    const saved = localStorage.getItem(ADMIN_SESSION_KEY);
    if (saved) {
      adminSession = JSON.parse(saved);
      if (!adminSession.user || adminSession.user.id !== ADMIN_UID) {
        saveAdminSession(null);
      } else {
        await getValidAdminSession();
      }
    }
  } catch (error) {
    saveAdminSession(null);
  }

  updateAdminLoginUI();
  if (adminSession && adminSession.user && adminSession.user.id === ADMIN_UID) {
    await loadPoetProfilesAdmin();
  }
}

function initializeAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  const button = document.getElementById("adminLoginBtn");
  const close = document.getElementById("adminLoginClose");
  const form = document.getElementById("adminLoginForm");
  const logout = document.getElementById("adminLogoutBtn");
  const status = document.getElementById("adminLoginStatus");
  const password = document.getElementById("adminLoginPassword");

  button?.addEventListener("click", function() {
    modal?.classList.remove("hidden");
    updateAdminLoginUI();
  });

  close?.addEventListener("click", function() {
    modal?.classList.add("hidden");
  });

  modal?.addEventListener("click", function(event) {
    if (event.target === modal) modal.classList.add("hidden");
  });

  form?.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("adminLoginEmail").value.trim();
    const enteredPassword = password.value;
    const submit = document.getElementById("adminLoginSubmit");

    submit.disabled = true;
    submit.textContent = "যাচাই হচ্ছে...";
    status.textContent = "সার্ভারের সঙ্গে সংযোগ করা হচ্ছে...";

    try {
      const response = await fetch(
        SUPABASE_URL + "/auth/v1/token?grant_type=password",
        {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email,
            password: enteredPassword
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.message || data.error_description || "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।");
      }

      if (!data.user || data.user.id !== ADMIN_UID) {
        throw new Error("এই অ্যাকাউন্টটি অনুমোদিত এডমিন নয়।");
      }

      data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
      saveAdminSession(data);
      await loadPoetProfilesAdmin();
      render();
      password.value = "";
      status.textContent = "এডমিন হিসেবে সফলভাবে প্রবেশ করেছেন।";
    } catch (error) {
      status.textContent = "প্রবেশ করা যায়নি। ইমেইল ও পাসওয়ার্ড যাচাই করে আবার চেষ্টা করুন।";
      console.error("Admin login error:", error);
    } finally {
      submit.disabled = false;
      submit.textContent = "লগইন করুন";
    }
  });

  logout?.addEventListener("click", async function() {
    const session = adminSession;
    saveAdminSession(null);
    render();
    modal?.classList.add("hidden");

    if (session && session.access_token) {
      try {
        await fetch(SUPABASE_URL + "/auth/v1/logout", {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + session.access_token
          }
        });
      } catch (error) {
        console.warn("Supabase logout request failed:", error);
      }
    }
  });

  restoreAdminSession();
}

initializeAdminLogin();


// ===== POET PROFILE: READER + ADMIN =====

async function loadPoetProfileForReader(poetName) {
  const requestId = ++poetBioRequestId;
  const button = document.getElementById("poetBioButton");
  const panel = document.getElementById("poetBioPanel");
  const photo = document.getElementById("poetBioPhoto");

  if (button) button.classList.add("hidden");
  if (panel) panel.classList.add("hidden");
  if (photo) {
    photo.classList.add("hidden");
    photo.removeAttribute("src");
  }

  if (!poetName.trim()) return;

  try {
    const rows = await supabaseRequest(
      "poet_profiles?select=id,poet_name,birth_year,death_year,photo_url,short_bio,biography,sources&poet_name=eq." +
      encodeURIComponent(poetName.trim()) +
      "&limit=1"
    );

    if (requestId !== poetBioRequestId) return;

    if (!Array.isArray(rows) || !rows.length) return;

    const profile = rows[0];
    document.getElementById("poetBioName").textContent = profile.poet_name || "";
    document.getElementById("poetBioYears").textContent =
      [profile.birth_year, profile.death_year].filter(Boolean).join(" – ");
    document.getElementById("poetBioShort").textContent = profile.short_bio || "";
    document.getElementById("poetBioText").textContent = profile.biography || "";
    document.getElementById("poetBioText").style.whiteSpace = "pre-wrap";
    document.getElementById("poetBioSources").textContent =
      profile.sources ? "তথ্যসূত্র: " + profile.sources : "";

    if (profile.photo_url) {
      try {
        const url = new URL(profile.photo_url);
        if (url.protocol === "https:" || url.protocol === "http:") {
          photo.src = url.href;
          photo.classList.remove("hidden");
          photo.onerror = () => photo.classList.add("hidden");
        }
      } catch (_) {
        photo.classList.add("hidden");
      }
    }

    if (button) button.classList.remove("hidden");
  } catch (error) {
    console.error("Poet profile load error:", error);
  }
}

function initializePoetProfileReader() {
  const button = document.getElementById("poetBioButton");
  const panel = document.getElementById("poetBioPanel");
  const close = document.getElementById("poetBioClose");

  button?.addEventListener("click", () => {
    panel?.classList.remove("hidden");
  });

  close?.addEventListener("click", () => {
    panel?.classList.add("hidden");
  });
}

function resetPoetProfileForm() {
  const form = document.getElementById("poetProfileForm");
  if (form) form.reset();
  const id = document.getElementById("poetProfileId");
  if (id) id.value = "";
  const serial = document.getElementById("poetProfileSerial");
  if (serial) serial.value = "";
  const save = document.getElementById("poetProfileSave");
  if (save) save.textContent = "💾 সংরক্ষণ করুন";
  form?.classList.add("hidden");
}

function isPoetAdmin() {
  return !!(adminSession && adminSession.user && adminSession.user.id === ADMIN_UID);
}

async function loadPoetProfilesAdmin() {
  const list = document.getElementById("poetProfileList");
  if (!list || !isPoetAdmin()) return;

  list.textContent = "কবিদের তালিকা লোড হচ্ছে...";

  try {
    const rows = await supabaseRequest(
      "poet_profiles?select=id,poet_name,birth_year,death_year,serial_no&order=serial_no.asc,id.asc"
    );

    list.replaceChildren();

    const serialInput = document.getElementById("poetProfileSerial");
    if (serialInput && !document.getElementById("poetProfileId").value) {
      const maxSerial = Array.isArray(rows)
        ? rows.reduce((max, p) => Math.max(max, Number(p.serial_no) || 0), 0)
        : 0;
      serialInput.value = toBanglaNumber(maxSerial + 1);
    }

    if (!Array.isArray(rows) || !rows.length) {
      list.textContent = "এখনো কোনো কবির পরিচিতি যোগ করা হয়নি।";
      return;
    }

    rows.forEach(profile => {
      const item = document.createElement("div");
      item.className = "poet-admin-item";

      const name = document.createElement("strong");
      name.textContent = toBanglaNumber(profile.serial_no || "") + ". " + (profile.poet_name || "");
      item.appendChild(name);

      const years = document.createElement("span");
      years.textContent =
        [profile.birth_year, profile.death_year].filter(Boolean).join(" – ");
      item.appendChild(years);

      const actions = document.createElement("div");
      actions.className = "poet-admin-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "✏️ সম্পাদনা";
      edit.addEventListener("click", () => editPoetProfile(profile.id));
      actions.appendChild(edit);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "🗑 মুছুন";
      remove.addEventListener("click", () => deletePoetProfile(profile.id, profile.poet_name));
      actions.appendChild(remove);

      item.appendChild(actions);

      list.appendChild(item);
    });
  } catch (error) {
    list.textContent = "কবিদের তালিকা লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
    console.error("Poet profile list error:", error);
  }
}

async function editPoetProfile(id) {
  if (!isPoetAdmin()) return;

  try {
    const rows = await supabaseRequest(
      "poet_profiles?select=*&id=eq." + encodeURIComponent(id) + "&limit=1"
    );

    if (!rows || !rows.length) {
      alert("কবির তথ্য পাওয়া যায়নি।");
      return;
    }

    const p = rows[0];
    document.getElementById("poetProfileId").value = p.id;
    document.getElementById("poetProfileSerial").value = toBanglaNumber(p.serial_no || 1);
    document.getElementById("poetProfileName").value = p.poet_name || "";
    document.getElementById("poetProfileBirth").value = p.birth_year || "";
    document.getElementById("poetProfileDeath").value = p.death_year || "";
    document.getElementById("poetProfilePhoto").value = p.photo_url || "";
    document.getElementById("poetProfileShort").value = p.short_bio || "";
    document.getElementById("poetProfileBiography").value = p.biography || "";
    document.getElementById("poetProfileSources").value = p.sources || "";
    document.getElementById("poetProfileSave").textContent = "💾 পরিবর্তন সংরক্ষণ করুন";
    document.getElementById("poetProfileForm").classList.remove("hidden");
    document.getElementById("poetProfileForm").scrollIntoView({behavior:"smooth", block:"start"});

    document.getElementById("poetProfileName").focus();
  } catch (error) {
    alert("কবির তথ্য খোলা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
  }
}

async function deletePoetProfile(id, poetName) {
  if (!isPoetAdmin()) return;
  if (!confirm('"' + poetName + '"-এর পরিচিতি মুছে ফেলতে চান?')) return;

  try {
    await supabaseRequest(
      "poet_profiles?id=eq." + encodeURIComponent(id),
      { method: "DELETE" }
    );
    resetPoetProfileForm();
    await loadPoetProfilesAdmin();
    await loadPublicPoetProfiles();
    alert("কবির পরিচিতি মুছে ফেলা হয়েছে।");
  } catch (error) {
    alert("কবির তথ্য মুছে ফেলা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
  }
}

function initializePoetProfileAdmin() {
  const form = document.getElementById("poetProfileForm");
  const cancel = document.getElementById("poetProfileCancel");
  const addButton = document.getElementById("poetProfileAddBtn");
  addButton?.addEventListener("click", () => {
    if (!isPoetAdmin()) return;
    resetPoetProfileForm();
    form?.classList.remove("hidden");
    form?.scrollIntoView({behavior:"smooth", block:"start"});
    document.getElementById("poetProfileName")?.focus();
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!isPoetAdmin()) {
      alert("কবি পরিচিতি পরিবর্তনের জন্য এডমিন হিসেবে প্রবেশ করতে হবে।");
      return;
    }

    const id = document.getElementById("poetProfileId").value.trim();
    const poetName = document.getElementById("poetProfileName").value.trim();
    if (!poetName) {
      alert("কবির নাম লিখুন।");
      return;
    }

    const serialText = document.getElementById("poetProfileSerial").value;
    const serialNo = Number(serialText.replace(/[০-৯]/g, d =>
      String("০১২৩৪৫৬৭৮৯".indexOf(d))
    ));
    if (!Number.isInteger(serialNo) || serialNo < 1) {
      alert("সঠিক ধনাত্মক ক্রমিক নম্বর দিন।");
      return;
    }

    const photoUrl = document.getElementById("poetProfilePhoto").value.trim();
    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Invalid protocol");
        }
      } catch (_) {
        alert("ছবির সঠিক ওয়েব ঠিকানা দিন।");
        return;
      }
    }

    const payload = {
      serial_no: serialNo,
      poet_name: poetName,
      birth_year: document.getElementById("poetProfileBirth").value.trim() || null,
      death_year: document.getElementById("poetProfileDeath").value.trim() || null,
      photo_url: photoUrl || null,
      short_bio: document.getElementById("poetProfileShort").value.trim() || null,
      biography: document.getElementById("poetProfileBiography").value.trim() || null,
      sources: document.getElementById("poetProfileSources").value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const save = document.getElementById("poetProfileSave");
    save.disabled = true;
    save.textContent = "সংরক্ষণ হচ্ছে...";

    try {
      if (id) {
        await supabaseRequest(
          "poet_profiles?id=eq." + encodeURIComponent(id),
          {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify(payload)
          }
        );
      } else {
        await supabaseRequest("poet_profiles", {
          method: "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify(payload)
        });
      }

      resetPoetProfileForm();
      await loadPoetProfilesAdmin();
      await loadPublicPoetProfiles();
      alert("কবির পরিচিতি সফলভাবে সংরক্ষণ হয়েছে।");
    } catch (error) {
      alert("কবির তথ্য সংরক্ষণ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
      console.error("Poet profile save error:", error);
    } finally {
      save.disabled = false;
      if (document.getElementById("poetProfileId").value) {
        save.textContent = "💾 পরিবর্তন সংরক্ষণ করুন";
      } else {
        save.textContent = "💾 সংরক্ষণ করুন";
      }
    }
  });

  cancel?.addEventListener("click", resetPoetProfileForm);
}

initializePoetProfileReader();
initializePoetProfileAdmin();

async function loadPoemsFromSupabase() {
  try {
    const rows = await supabaseRequest("poems?select=*&order=class.asc,user_added.asc,lesson.asc,id.asc");

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log("Supabase poems table is empty.");
      return false;
    }

    for (const key of Object.keys(classData)) {
      classData[key] = [];
    }

    for (const row of rows) {
      const poem = {
        id: row.id,
        class: row.class,
        lesson: row.lesson,
        title: row.title,
        poet: row.poet || "",
        source_page: row.source_page,
        is_excerpt: !!row.is_excerpt,
        text: row.text,
        userAdded: !!row.user_added,
        oldBook: !!row.old_book,
        maleAudioUrl: row.male_audio_url || "",
        femaleAudioUrl: row.female_audio_url || ""
      };

      if (!classData[String(poem.class)]) {
        classData[String(poem.class)] = [];
      }

      const target = classData[String(poem.class)];
      const duplicate = target.some(existing =>
        String(existing.title || "").trim().toLowerCase() === String(poem.title || "").trim().toLowerCase() &&
        String(existing.poet || "").trim().toLowerCase() === String(poem.poet || "").trim().toLowerCase() &&
        String(savedText(existing)).replace(/\s+/g," ").trim().toLowerCase() === String(poem.text || "").replace(/\s+/g," ").trim().toLowerCase()
      );
      if(!duplicate) target.push(poem);
    }

    Object.keys(classData).forEach(function(key){
      classData[key].sort(function(a, b){
        const aLesson = Number(a.lesson || 0);
        const bLesson = Number(b.lesson || 0);

        if(aLesson === 0 && bLesson !== 0) return 1;
        if(aLesson !== 0 && bLesson === 0) return -1;
        return aLesson - bLesson;
      });
    });

    console.log("Loaded poems from Supabase:", rows.length);
    return true;
  } catch (error) {
    console.error("Supabase load failed:", error);
    return false;
  }
}


const classData = {"1":[],"2":[],"3":[],"4":[],"5":[],"6":[],"7":[],"8":[],"9":[],"10":[],"11":[],"12":[]};

const home=document.querySelector("#home");
const library=document.querySelector("#library");
const reader=document.querySelector("#reader");
const list=document.querySelector("#list");
const search=document.querySelector("#search");
const darkModeBtn=document.querySelector("#darkModeBtn");

function updateDarkModeButton(){
  if(!darkModeBtn) return;
  darkModeBtn.textContent = document.body.classList.contains("dark")
    ? "☀️ লাইট মোড"
    : "🌙 ডার্ক মোড";
}

if(localStorage.getItem("darkMode") === "1"){
  document.body.classList.add("dark");
}

if(darkModeBtn){
  darkModeBtn.addEventListener("click", function(){
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark") ? "1" : "0"
    );
    updateDarkModeButton();
  });
}

updateDarkModeButton();
const favoriteFilter=document.querySelector("#favoriteFilter");
const editBtn=document.querySelector("#editBtn");
const speakBtn=document.querySelector("#speakBtn");
const reciteControls=document.querySelector("#reciteControls");
const pauseBtn=document.querySelector("#pauseBtn");
const resumeBtn=document.querySelector("#resumeBtn");
const stopBtn=document.querySelector("#stopBtn");
const editArea=document.querySelector("#editArea");

let activePoemAudio = null;

function stopPoemAudio() {
  if (activePoemAudio) {
    activePoemAudio.pause();
    activePoemAudio.currentTime = 0;
    activePoemAudio = null;
  }
}

async function uploadPoemAudio(poem, gender, file, button) {
  if (!isPoetAdmin()) {
    alert("শুধু Admin অডিও আপলোড করতে পারবেন।");
    return;
  }

  if (!poem || !poem.id || !file) return;

  const isMp3 = file.type === "audio/mpeg" ||
    file.name.toLowerCase().endsWith(".mp3");

  if (!isMp3) {
    alert("শুধু MP3 অডিও ফাইল নির্বাচন করুন।");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("MP3 ফাইলের আকার ১০ MB-এর বেশি হতে পারবে না।");
    return;
  }

  const oldLabel = button.textContent;
  button.disabled = true;
  button.textContent = "আপলোড হচ্ছে...";

  try {
    const session = await getValidAdminSession();

    if (!session || !session.access_token) {
      throw new Error("Admin session পাওয়া যায়নি। আবার Admin Login করুন।");
    }

    const objectPath = String(poem.id) + "/" + gender + ".mp3";
    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");

    const uploadResponse = await fetch(
      SUPABASE_URL + "/storage/v1/object/poem-audio/" + encodedPath,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + session.access_token,
          "Content-Type": "audio/mpeg",
          "x-upsert": "true"
        },
        body: file
      }
    );

    if (!uploadResponse.ok) {
      throw new Error("Storage upload failed: " +
        uploadResponse.status + " " + await uploadResponse.text());
    }

    const publicUrl =
      SUPABASE_URL + "/storage/v1/object/public/poem-audio/" + encodedPath;

    const field = gender + "_audio_url";

    await supabaseRequest(
      "poems?id=eq." + encodeURIComponent(poem.id),
      {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ [field]: publicUrl })
      }
    );

    poem[gender + "AudioUrl"] = publicUrl;

    renderPoemAudioPanel(poem);

    alert("MP3 সফলভাবে আপলোড ও সংরক্ষণ হয়েছে।");

  } catch (error) {
    console.error("Poem audio upload error:", error);
    alert("অডিও আপলোড করা যায়নি: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = oldLabel;
  }
}

async function deletePoemAudio(poem, gender) {
  if (!isPoetAdmin() || !poem || !poem.id) return;

  const label = gender === "male" ? "পুরুষ কণ্ঠ" : "নারী কণ্ঠ";
  if (!confirm(label + " MP3 মুছে ফেলতে চান?")) return;

  try {
    const session = await getValidAdminSession();
    if (!session || !session.access_token) {
      throw new Error("Admin session পাওয়া যায়নি।");
    }

    const field = gender + "_audio_url";
    const objectPath = String(poem.id) + "/" + gender + ".mp3";

    // প্রথমে Storage থেকে MP3 মুছতে হবে।
    const deleteResponse = await fetch(
      SUPABASE_URL + "/storage/v1/object/poem-audio",
      {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + session.access_token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prefixes: [objectPath] })
      }
    );

    if (!deleteResponse.ok) {
      throw new Error("Storage থেকে MP3 মুছতে ব্যর্থ: " +
        deleteResponse.status + " " + await deleteResponse.text());
    }

    // Storage delete সফল হলে Database URL পরিষ্কার হবে।
    await supabaseRequest(
      "poems?id=eq." + encodeURIComponent(poem.id),
      {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ [field]: null })
      }
    );

    poem[gender + "AudioUrl"] = "";
    stopPoemAudio();
    renderPoemAudioPanel(poem);

    alert("অডিও মুছে ফেলা হয়েছে।");
  } catch (error) {
    console.error("Poem audio delete error:", error);
    alert("অডিও মুছতে সমস্যা হয়েছে: " + error.message);
  }
}

function renderPoemAudioPanel(poem) {
  if (!poem) return;

  const readerEl = document.querySelector("#reader");
  const paper = readerEl ? readerEl.querySelector(".paper") : null;

  if (!readerEl || !paper) return;

  const previous = document.getElementById("poemAudioPanel");
  if (previous) previous.remove();

  const panel = document.createElement("section");
  panel.id = "poemAudioPanel";
  panel.className = "poem-audio-panel";
  panel.style.cssText =
    "margin:12px 0;padding:14px;border:1px solid #dce5ef;" +
    "border-radius:14px;background:#f7faff;";

  const heading = document.createElement("h3");
  heading.textContent = "🎧 কবিতার অডিও আবৃত্তি";
  heading.style.margin = "0 0 12px";
  panel.appendChild(heading);

  let hasAudio = false;

  [
    { gender: "male", label: "পুরুষ কণ্ঠ", property: "maleAudioUrl" },
    { gender: "female", label: "নারী কণ্ঠ", property: "femaleAudioUrl" }
  ].forEach(function (voice) {
    const url = poem[voice.property] || "";

    const section = document.createElement("div");
    section.style.cssText =
      "padding:10px;margin:8px 0;background:#fff;" +
      "border:1px solid #e1e8f0;border-radius:10px;";

    const label = document.createElement("strong");
    label.textContent = voice.label;
    label.style.display = "block";
    label.style.marginBottom = "8px";
    section.appendChild(label);

    if (url) {
      hasAudio = true;

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = url;
      audio.style.cssText = "width:100%;max-width:100%;";

      audio.addEventListener("play", function () {
        if (activePoemAudio && activePoemAudio !== audio) {
          activePoemAudio.pause();
        }
        activePoemAudio = audio;
      });

      audio.addEventListener("ended", function () {
        if (activePoemAudio === audio) activePoemAudio = null;
      });

      section.appendChild(audio);
    } else if (!isPoetAdmin()) {
      section.style.display = "none";
    } else {
      const empty = document.createElement("p");
      empty.textContent = "এখনো অডিও যোগ করা হয়নি।";
      section.appendChild(empty);
    }

    if (isPoetAdmin()) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/mpeg,.mp3";
      input.style.cssText = "display:block;width:100%;margin:8px 0;";

      const uploadButton = document.createElement("button");
      uploadButton.type = "button";
      uploadButton.textContent = url ? "🔄 MP3 পরিবর্তন করুন" : "⬆️ MP3 আপলোড করুন";
      uploadButton.style.cssText =
        "padding:8px 12px;margin:4px;border:0;border-radius:8px;" +
        "background:#e1edff;color:#174b91;";

      uploadButton.addEventListener("click", function () {
        if (!input.files || !input.files[0]) {
          alert("প্রথমে একটি MP3 ফাইল নির্বাচন করুন।");
          return;
        }
        uploadPoemAudio(poem, voice.gender, input.files[0], uploadButton);
      });

      section.appendChild(input);
      section.appendChild(uploadButton);

      if (url) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "🗑️ অডিও মুছুন";
        deleteButton.style.cssText =
          "padding:8px 12px;margin:4px;border:0;border-radius:8px;" +
          "background:#ffe8e8;color:#9b2525;";

        deleteButton.addEventListener("click", function () {
          deletePoemAudio(poem, voice.gender);
        });

        section.appendChild(deleteButton);
      }
    }

    panel.appendChild(section);
  });

  panel.style.display = (hasAudio || isPoetAdmin()) ? "block" : "none";
  readerEl.insertBefore(panel, paper);
}
const editText=document.querySelector("#editText");
const saveBtn=document.querySelector("#saveBtn");

const cancelBtn=document.querySelector("#cancelBtn");

// ===== Rich Text Editor =====

function richEditorPlainText(){
  const el = document.querySelector("#editText");
  return el ? el.innerText.trim() : "";
}

function cleanRichHTML(html){
  const temp = document.createElement("div");
  temp.innerHTML = html || "";

  temp.querySelectorAll("script,style,iframe,object,embed").forEach(el => el.remove());

  temp.querySelectorAll("*").forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value || "";

      if(name.startsWith("on")){
        el.removeAttribute(attr.name);
      }

      if(name === "href" || name === "src"){
        if(/^\s*javascript:/i.test(value)){
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  return temp.innerHTML.trim();
}

function poemHTMLToPlainText(value){
  if(!value) return "";

  const temp = document.createElement("div");
  temp.innerHTML = value;

  return (temp.innerText || temp.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

// Toolbar buttons
document.querySelectorAll("#richToolbar [data-cmd]").forEach(button => {
  button.addEventListener("click", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();
    document.execCommand(this.dataset.cmd, false, null);
  });
});


// Font size
const fontSizeSelect = document.querySelector("#fontSize");

// Font Style
const fontFamilySelect = document.querySelector("#fontFamily");

if(fontFamilySelect){
  fontFamilySelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand(
      "fontName",
      false,
      this.value
    );
  });
}

// Exact Font Size in pt
if(fontSizeSelect){
  fontSizeSelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand("fontSize", false, "7");

    editor.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement("span");
      span.style.fontSize = this.value + "pt";
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  });
}

// Leading / Line Spacing
const leadingSelect = document.querySelector("#leading");

if(leadingSelect){
  leadingSelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    const selection = window.getSelection();

    if(!selection || !selection.rangeCount){
      editor.style.lineHeight = this.value;
      return;
    }

    let node = selection.anchorNode;

    if(node && node.nodeType === Node.TEXT_NODE){
      node = node.parentElement;
    }

    const block = node && node.closest
      ? node.closest("p, div, h1, h2, h3, h4, h5, h6, li")
      : null;

    if(block && editor.contains(block)){
      block.style.lineHeight = this.value;
    }else{
      editor.style.lineHeight = this.value;
    }
  });
}

// Font Color
const fontColor = document.querySelector("#fontColor");

if(fontColor){
  fontColor.addEventListener("input", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand(
      "foreColor",
      false,
      this.value
    );
  });
}

// Paragraph / Heading
const formatBlock = document.querySelector("#formatBlock");

if(formatBlock){
  formatBlock.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    const tag = this.value;

    document.execCommand(
      "formatBlock",
      false,
      tag
    );
  });
}

// Clear formatting
const clearFormat = document.querySelector("#clearFormat");

if(clearFormat){
  clearFormat.addEventListener("click", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();
    document.execCommand("removeFormat", false, null);
  });
}

// Save rich text
if(saveBtn){

  saveBtn.addEventListener("click", async function(){

    if(!isPoetAdmin()){
      return;
    }

    if(!currentPoem) return;

    const editor = document.querySelector("#editText");

    if(!editor){
      return;
    }

    const plainText = richEditorPlainText();

    if(!plainText){
      alert("কবিতার লেখা খালি রাখা যাবে না।");
      return;
    }

    if(!currentPoem.id){
      alert("এই কবিতার অনলাইন তথ্যভান্ডারের পরিচিতি পাওয়া যায়নি।");
      return;
    }

    const richHTML = cleanRichHTML(editor.innerHTML);

    saveBtn.disabled = true;

    try{

      await supabaseRequest(
        "poems?id=eq." + encodeURIComponent(currentPoem.id),
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            text: richHTML
          })
        }
      );

      currentPoem.text = richHTML;

      document.querySelector("#text").innerHTML = richHTML;
      document.querySelector("#text").classList.remove("hidden");

      editArea.classList.add("hidden");
      editBtn.classList.remove("hidden");

      alert("কবিতা সফলভাবে সংরক্ষণ হয়েছে।");

      render();

    } catch(error){

      console.error("Poem update failed:", error);
      alert("কবিতা সংরক্ষণ করা যায়নি।");

    } finally {

      saveBtn.disabled = false;

    }
  });
}

if(cancelBtn){

  cancelBtn.addEventListener("click", function(){

    editArea.classList.add("hidden");

    document.querySelector("#text").classList.remove("hidden");

    editBtn.classList.remove("hidden");

  });

}

if(editBtn){

  editBtn.addEventListener("click", function(){

    if(!isPoetAdmin()){
      return;
    }

    if(!currentPoem) return;

    const editor = document.querySelector("#editText");

    if(!editor) return;

    editor.style.fontFamily =
      '"SolaimanLipi",sans-serif';

    const existing = savedText(currentPoem);

    /*
      পুরোনো কবিতা যদি plain text হয়,
      তাহলে সেটাকে paragraph/line break সহ editor-এ নেওয়া হবে।
      আর আগে থেকে HTML formatting থাকলে সেটাই রাখা হবে।
    */
    if(/<[^>]+>/.test(existing)){
      editor.innerHTML = existing;
    }else{
      editor.innerHTML = existing
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g,"<br>")}</p>`)
        .join("");
    }

    editArea.classList.remove("hidden");

    document.querySelector("#text").classList.add("hidden");

    editBtn.classList.add("hidden");

  });

}

// ===== Search + Favorite Filter =====

if(search){
  search.addEventListener("input", function(){
    runGlobalSearch(this.value);
  });
}

if(favoriteFilter){
  favoriteFilter.addEventListener("click", function(){
    showingFavorites = !showingFavorites;

    this.textContent = showingFavorites
      ? "♥ সব কবিতা"
      : "♡ প্রিয় কবিতা";

    render();
  });
}


/* ===== Dashboard top controls ===== */

const homeSearch=document.querySelector("#homeSearch");
const topSearchTitle=document.querySelector("#topSearchTitle");
const topSearchPoetSelect=document.querySelector("#topSearchPoetSelect");
const homeFavoriteBtn=document.querySelector("#homeFavoriteBtn");
const homeDarkModeBtn=document.querySelector("#homeDarkModeBtn");

/* ===== Top-right controls ===== */
const topFavorites=document.querySelector("#topFavorites");
const topSettings=document.querySelector("#topSettings");

if(topFavorites && homeFavoriteBtn){
  topFavorites.addEventListener("click", function(){
    homeFavoriteBtn.click();
  });
}

if(topSettings && homeDarkModeBtn){
  topSettings.addEventListener("click", function(){
    homeDarkModeBtn.click();
  });
}

/* Populate poet dropdown from all classes */
function populatePoetDropdown(){
  if(!topSearchPoetSelect) return;

  const poetMap = new Map();

  Object.keys(classData).forEach(function(key){
    (classData[key] || []).forEach(function(poem){
      const poet = String(poem.poet || "").trim();
      if(poet && !poetMap.has(poet.toLowerCase())){
        poetMap.set(poet.toLowerCase(), poet);
      }
    });
  });

  const poets = Array.from(poetMap.values())
    .sort(function(a,b){ return a.localeCompare(b, "bn"); });

  topSearchPoetSelect.innerHTML = '<option value="">সকল কবি</option>';

  poets.forEach(function(poet){
    const option = document.createElement("option");
    option.value = poet;
    option.textContent = poet;
    topSearchPoetSelect.appendChild(option);
  });
}

function runTopSearch(type, value){
  const q = String(value || "").trim().toLowerCase();

  if(!q){
    globalSearchMode = false;
    globalSearchResults = [];
    showHome();
    return;
  }

  const results = [];

  Object.keys(classData).forEach(function(key){
    (classData[key] || []).forEach(function(poem){
      const field = type === "poet"
        ? String(poem.poet || "")
        : String(poem.title || "");

      if(field.toLowerCase().includes(q)){
        results.push(poem);
      }
    });
  });

  home.classList.add("hidden");
  reader.classList.add("hidden");
  library.classList.remove("hidden");

  globalSearchMode = true;
  globalSearchResults = results;
  selectedClasses = [1];

  document.querySelector("#classTitle").textContent =
    "কবিতার নামে সার্চ ফলাফল";
  document.querySelector("#classCount").textContent =
    `পাওয়া গেছে: ${toBanglaNumber(results.length)} টি`;

  renderPoems(list, results);
}

function showPoetResults(poet){
  if(!poet){
    globalSearchMode = false;
    globalSearchResults = [];
    showHome();
    return;
  }

  const selected = poet.trim().toLowerCase();
  const results = [];

  Object.keys(classData).forEach(function(key){
    (classData[key] || []).forEach(function(poem){
      if(String(poem.poet || "").trim().toLowerCase() === selected){
        results.push(poem);
      }
    });
  });

  home.classList.add("hidden");
  reader.classList.add("hidden");
  library.classList.remove("hidden");

  globalSearchMode = true;
  globalSearchResults = results;
  selectedClasses = [1];

  document.querySelector("#classTitle").textContent = "কবি: " + poet;
  document.querySelector("#classCount").textContent =
    `পাওয়া গেছে: ${toBanglaNumber(results.length)} টি`;

  renderPoems(list, results);
}

if(topSearchTitle){
  topSearchTitle.addEventListener("input", function(){
    if(topSearchPoetSelect) topSearchPoetSelect.value = "";
    runTopSearch("title", this.value);
  });
}

if(topSearchPoetSelect){
  topSearchPoetSelect.addEventListener("change", function(){
    if(topSearchTitle) topSearchTitle.value = "";
    showPoetResults(this.value);
  });
}

function collectFavoritePoems(){
  const favoritePoems = [];
  for(let cls=1; cls<=12; cls++){
    (classData[String(cls)] || []).forEach(function(poem){
      if(isFavorite(poem)) favoritePoems.push(poem);
    });
  }
  return favoritePoems;
}

function openFavoritesPage(){
  const page = document.querySelector("#favoritePage");
  const list = document.querySelector("#favoriteList");
  if(!page || !list) return;

  home.classList.add("hidden");
  document.querySelector("#contents")?.classList.add("hidden");
  document.querySelector("#poetProfilesPage")?.classList.add("hidden");
  library.classList.add("hidden");
  reader.classList.add("hidden");
  page.classList.remove("hidden");

  const poems = collectFavoritePoems();
  document.querySelector("#favoritePageCount").textContent =
    `মোট প্রিয় কবিতা: ${toBanglaNumber(poems.length)} টি`;

  if(poems.length){
    renderPoems(list, poems);
  } else {
    list.innerHTML = '<div class="empty">এখনো কোনো প্রিয় কবিতা সংরক্ষিত নেই।</div>';
  }
  updateNav(null);
}

if(homeFavoriteBtn){
  homeFavoriteBtn.addEventListener("click", openFavoritesPage);
}

document.querySelector("#favoritePageHomeBtn")?.addEventListener("click", showHome);


function updateHomeDarkModeButton(){
  if(!homeDarkModeBtn) return;
  homeDarkModeBtn.textContent = document.body.classList.contains("dark")
    ? "☀️ লাইট মোড"
    : "🌙 ডার্ক মোড";
}

if(homeDarkModeBtn){
  homeDarkModeBtn.addEventListener("click", function(){
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark") ? "1" : "0"
    );
    updateHomeDarkModeButton();
    updateDarkModeButton();
  });
}

updateHomeDarkModeButton();

const classNames=["","প্রথম","দ্বিতীয়","তৃতীয়","চতুর্থ","পঞ্চম","ষষ্ঠ","সপ্তম","অষ্টম","নবম","দশম","একাদশ","দ্বাদশ"];

function displayClassName(classNo) {
  if (classNo === 9 || classNo === 10) return "নবম-দশম";
  if (classNo === 11 || classNo === 12) return "একাদশ-দ্বাদশ";
  return classNames[classNo] || classNo;
}

buildClassNav();

function favoriteKey(x){
  return "favorite_poem_"+x.class+"_"+x.lesson;
}

function isFavorite(x){
  return localStorage.getItem(favoriteKey(x)) === "1";
}

function toggleFavorite(x){
  const key=favoriteKey(x);
  if(isFavorite(x)) localStorage.removeItem(key);
  else localStorage.setItem(key,"1");
  const favoritePage = document.querySelector("#favoritePage");
  if(favoritePage && !favoritePage.classList.contains("hidden")){
    openFavoritesPage();
  } else if(!home.classList.contains("hidden")){
    showHome();
  } else {
    render();
  }
}

function savedText(x){
  return x && x.text ? x.text : "";
}

function poemCountText(c){
  const n=(classData[String(c)]||[]).length;
  return `মোট কবিতা: ${toBanglaNumber(n)} টি`;
}

let readerReturnPage = "library";

const backBtn=document.querySelector("#back");

if(backBtn){
  backBtn.addEventListener("click", function(){
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    if(window.Android && Android.stop) Android.stop();
    reader.classList.add("hidden");
    if(readerReturnPage === "contents"){
      document.querySelector("#contents")?.classList.remove("hidden");
    } else if(readerReturnPage === "favorites"){
      openFavoritesPage();
    } else {
      library.classList.remove("hidden");
    }
  });
}

window.__openPoem = function(c, i){
  const arr = classData[String(c)] || [];
  const poem = arr[Number(i)];
  if (poem) show(poem);
};

function poemCardColor(x, i){
  const titleColors = ["#7a159b","#0574d0","#dc214f","#6c18be","#e86b00","#cf0a8b","#168b39","#006bb9","#8a3ffc","#b44b00","#087f5b","#9c2c77","#3454d1","#a23e48","#2b9348","#7b2cbf","#c44536","#15616d","#9a031e","#4f772d","#6a4c93","#9c6644","#386641","#7f5539","#3a506b","#5f0f40","#3d405b","#8338ec","#006d77","#9b5de5"];
  const color = titleColors[(Number(i) < 0 ? 0 : Number(i)) % titleColors.length];
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  const tint = c => Math.round(255 - (255-c)*0.15);
  return "#" + [r,g,b].map(tint).map(v=>v.toString(16).padStart(2,"0")).join("");
}

function poemCardExcerpt(x, i){
  const raw = savedText(x) || x.text || "";
  const temp = document.createElement("div");
  temp.innerHTML = raw;
  if(!temp.textContent.trim()) return "";

  const blocks = [...temp.children];
  let previewHTML = "";

  if(blocks.length){
    const previewBox = document.createElement("div");
    blocks.forEach(block => {
      const clone = block.cloneNode(true);
      if(document.body.classList.contains("dark")){
        [clone, ...clone.querySelectorAll("*")].forEach(el => {
          el.style.removeProperty("color");
          el.style.removeProperty("background");
          el.style.removeProperty("background-color");
          el.style.removeProperty("-webkit-text-fill-color");
        });
      }
      previewBox.appendChild(clone);
    });
    previewHTML = previewBox.innerHTML;
  } else {
    previewHTML = temp.innerHTML.replace(/\r/g, "").replace(/\n/g, "<br>");
  }

  return `<div class="excerpt-lines">${previewHTML}</div>` +
    `<div class="excerpt-footer"><span class="read-more">..... আরও পড়ুন</span></div>`;
}
function poemCardHTML(x, i){
  const realIndex=(classData[String(x.class)]||[]).indexOf(x);
  const isDark = document.body.classList.contains("dark");
  const cardColor = isDark ? "#1e293b" : poemCardColor(x, i);
  const titleColor = isDark ? "#f8fafc" : ["#7a159b","#0574d0","#dc214f","#6c18be","#e86b00","#cf0a8b","#168b39","#006bb9","#8a3ffc","#b44b00","#087f5b","#9c2c77","#3454d1","#a23e48","#2b9348","#7b2cbf","#c44536","#15616d","#9a031e","#4f772d","#6a4c93","#9c6644","#386641","#7f5539","#3a506b","#5f0f40","#3d405b","#8338ec","#006d77","#9b5de5"][(Number(i)) % 30];
  const poetColor = isDark ? "#86efac" : ["#00695c","#ad1457","#283593","#ef6c00","#2e7d32","#6d4c41","#00838f","#c62828","#4527a0","#558b2f","#5d4037","#0277bd","#6a1b9a","#9e9d24","#37474f","#d84315","#1b5e20","#1565c0","#880e4f","#4e342e","#00897b","#bf360c","#303f9f","#33691e","#795548","#00796b","#e65100","#512da8","#827717","#263238"][(Number(i)) % 30];
  return `<div class="card" data-i="${i}" data-class="${x.class}" style="background:${cardColor} !important;">
    <div class="card-actions">
      ${!isPoetAdmin() ? "" : `<button class="deleteUserPoem" data-index="${realIndex}" data-class="${x.class}" type="button" onclick="event.preventDefault();event.stopPropagation();deleteUserPoem(this.dataset.class,this.dataset.index);return false;">🗑</button>`}
      <button class="favoriteBtn" data-fav="${i}" aria-label="প্রিয় কবিতা">${isFavorite(x) ? "❤️" : "♡"}</button>
    </div>
    <h3 style="color:${titleColor} !important;font-family:'SolaimanLipi',sans-serif;">${x.title}</h3>
    <div class="poet" style="color:${poetColor} !important;font-family:'SolaimanLipi',sans-serif;">${x.poet || "উল্লেখ নেই"}</div>

    <div class="excerpt">${poemCardExcerpt(x, i)}</div>

    ${globalSearchMode ? `<div class="global-class-label">শ্রেণি: ${classNames[Number(x.class)] || x.class}</div>` : ""}

  </div>`;
}

function bindPoemCards(container, arr){
  if(!container) return;
  container.querySelectorAll('.card').forEach(card=>{
    const i=Number(card.dataset.i);
    card.onclick=(ev)=>{
      if(ev.target.closest('.favoriteBtn') || ev.target.closest('.deleteUserPoem')) return;
      show(arr[i]);
    };
  });
  container.querySelectorAll('.favoriteBtn').forEach(btn=>btn.onclick=(ev)=>{ev.stopPropagation();toggleFavorite(arr[Number(btn.dataset.fav)]);});
;
}

function renderPoems(container, arr){
  if(!container) return;
  if(!arr.length){
    container.innerHTML='<div class="empty">এই শ্রেণিতে এখনো কোনো কবিতা যোগ করা হয়নি।</div>';
    return;
  }
  container.innerHTML=arr.map((x,i)=>poemCardHTML(x,i)).join('');
  bindPoemCards(container,arr);
}


function buildClassNav(){

  const nav = document.querySelector("#navClasses");

  if(!nav) return;

  nav.innerHTML = "";

  const classGroups = [
    { key: "1", classes: [1], label: "প্রথম" },
    { key: "2", classes: [2], label: "দ্বিতীয়" },
    { key: "3", classes: [3], label: "তৃতীয়" },
    { key: "4", classes: [4], label: "চতুর্থ" },
    { key: "5", classes: [5], label: "পঞ্চম" },
    { key: "6", classes: [6], label: "ষষ্ঠ" },
    { key: "7", classes: [7], label: "সপ্তম" },
    { key: "8", classes: [8], label: "অষ্টম" },
    { key: "9-10", classes: [9, 10], label: "নবম–দশম" },
    { key: "11-12", classes: [11, 12], label: "একাদশ–দ্বাদশ" }
  ];

  classGroups.forEach(group => {

    const btn = document.createElement("button");

    btn.className = "nav-class";

    btn.dataset.class = group.key;

    btn.type = "button";

    btn.innerHTML = `<span class="nav-icon">📚</span><span class="nav-label">${group.label} শ্রেণি</span><small class="class-count">কবিতা: ০টি</small>`;

    btn.addEventListener("click", function(){

      openClass(group.classes);

    });

    nav.appendChild(btn);

  });

}
function updateClassNavCounts(){
  document.querySelectorAll("#navClasses .nav-class").forEach(btn => {
    const classes = btn.dataset.class.split("-").map(Number);
    const total = classes.reduce((sum, cls) => {
      return sum + (classData[String(cls)] || []).length;
    }, 0);
    const countEl = btn.querySelector(".class-count");
    if(countEl) countEl.textContent = `কবিতা: ${toBanglaNumber(total)}টি`;
  });

  const totalPoems = Object.values(classData).reduce(
    (sum, poems) => sum + (poems || []).length, 0
  );
  const summary = document.getElementById("navClasses");
  if(summary) {
    summary.setAttribute(
      "data-summary",
      `১০টি শ্রেণি উপলব্ধ\n${toBanglaNumber(totalPoems)} টি কবিতা উপলব্ধ`
    );
  }
}

function updateNav(c){

  const classes = c == null
    ? []
    : (Array.isArray(c) ? c.map(Number) : [Number(c)]);

  selectedClasses = classes;

  document.querySelectorAll('.nav-class').forEach(b => {

    const key = b.dataset.class;

    let active = false;

    if(key === "9-10"){

      active = classes.includes(9) || classes.includes(10);

    } else if(key === "11-12"){

      active = classes.includes(11) || classes.includes(12);

    } else {

      active = classes.includes(Number(key));

    }

    b.classList.toggle('active', active);

  });

}
function openClass(c){
  document.querySelector("#contents")?.classList.add("hidden");


  globalSearchMode=false;

  globalSearchResults=[];

  const classes = Array.isArray(c) ? c.map(Number) : [Number(c)];
  selectedClasses = classes;
  selectedPoemCategory = null;


  items = classes.flatMap(cls => classData[String(cls)] || []);

  home.classList.add('hidden');

  reader.classList.add('hidden');

  library.classList.remove('hidden');

  let title = "";

  if(classes.length === 2 && classes[0] === 9 && classes[1] === 10){

    title = "নবম–দশম শ্রেণি";

  } else if(classes.length === 2 && classes[0] === 11 && classes[1] === 12){

    title = "একাদশ–দ্বাদশ শ্রেণি";

  } else {

    title = `${classNames[classes[0]]} শ্রেণি`;

  }

  selectedClassTitle = title;
  document.querySelector('#classTitle').textContent = title;

  document.querySelector('#classCount').textContent = `${toBanglaNumber(items.length)} টি কবিতা`;

  if(search) search.value='';

  showingFavorites=false;

  if(favoriteFilter) favoriteFilter.textContent='♡ প্রিয় কবিতা';

  updateNav(classes);

  render();

}
function showHome(){
  document.querySelector("#contents")?.classList.add("hidden");
  document.querySelector("#poetProfilesPage")?.classList.add("hidden");
  document.querySelector("#favoritePage")?.classList.add("hidden");
  home.classList.remove("hidden");
  library.classList.add("hidden");
  reader.classList.add("hidden");
  document.querySelector('#homeClassTitle').textContent="শ্রেণি ভিত্তিক কবিতা সমূহ";
  document.querySelector('#homeClassCount').textContent="পছন্দের শ্রেণি নির্বাচন করুন";
  const homeList = document.querySelector('#homeList');
  if(homeList){
    homeList.innerHTML='<div class="empty">উপরের সকল শ্রেণি থেকে যেকোনো একটি শ্রেণি নির্বাচন করুন।</div>';
  }
  updateNav(null);
}


let publicPoetProfiles = [];

async function loadPublicPoetProfiles(){
  const list = document.querySelector("#poetProfilesList");
  if(!list) return;

  list.innerHTML = '<div class="empty">কবিদের তালিকা লোড হচ্ছে...</div>';

  try {
    const url = SUPABASE_URL +
      "/rest/v1/poet_profiles?select=id,poet_name,birth_year,death_year,photo_url,short_bio,biography,sources,serial_no&order=serial_no.asc,id.asc";

    const response = await fetch(url, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY
      }
    });

    if(!response.ok) throw new Error("কবিদের তথ্য লোড করা যায়নি (" + response.status + ")");

    const rows = await response.json();
    publicPoetProfiles = Array.isArray(rows) ? rows : [];
    const homePoetCount = document.querySelector("#homePoetCount");
    if(homePoetCount){
      homePoetCount.textContent =
        toBanglaNumber(publicPoetProfiles.length) + " জন কবি উপলব্ধ";
    }

    list.replaceChildren();

    if(!publicPoetProfiles.length){
      list.innerHTML = '<div class="empty">এখনো কোনো কবির পরিচিতি সংরক্ষিত নেই।</div>';
      return;
    }

    publicPoetProfiles.forEach(function(poet, index){
      const button = document.createElement("button");
      button.type = "button";
      button.className = "poet-public-card";

      const name = document.createElement("span");
      name.className = "poet-public-card-name";
      name.textContent = toBanglaNumber(poet.serial_no) + ". " + (poet.poet_name || "নাম উল্লেখ নেই");

      const years = document.createElement("span");
      years.className = "poet-public-card-years";
      years.textContent = [poet.birth_year, poet.death_year].filter(Boolean).join(" — ") || "জীবনকাল উল্লেখ নেই";

      const arrow = document.createElement("span");
      arrow.className = "poet-public-card-arrow";
      arrow.textContent = "›";

      const photo = document.createElement("img");
      photo.className = "poet-public-card-photo";
      photo.alt = poet.poet_name || "কবির ছবি";
      photo.loading = "lazy";

      if(poet.photo_url){
        try {
          const photoUrl = new URL(poet.photo_url, location.href);
          if(photoUrl.protocol === "https:" || photoUrl.protocol === "http:"){
            photo.src = photoUrl.href;
          }
        } catch(error) {
          console.warn("Invalid poet photo URL:", poet.poet_name);
        }
      }

      photo.addEventListener("error", function(){
        photo.classList.add("hidden");
      });

      const info = document.createElement("span");
      info.className = "poet-public-card-info";
      info.append(name, years);

      button.append(photo, info, arrow);
      button.addEventListener("click", function(){
        openPublicPoetProfile(index);
      });
      list.appendChild(button);
    });

  } catch(error) {
    console.error("Public poet profiles:", error);
    list.innerHTML = '<div class="empty">কবিদের তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</div>';
  }
}

function openPublicPoetProfile(index){
  const poet = publicPoetProfiles[index];
  if(!poet) return;

  const list = document.querySelector("#poetProfilesList");
  const detail = document.querySelector("#poetProfileDetail");
  if(!list || !detail) return;

  document.querySelector("#publicPoetName").textContent = poet.poet_name || "নাম উল্লেখ নেই";
  document.querySelector("#publicPoetYears").textContent =
    [poet.birth_year, poet.death_year].filter(Boolean).join(" — ");

  document.querySelector("#publicPoetShort").textContent = poet.short_bio || "";

  const biography = document.querySelector("#publicPoetBiography");
  biography.textContent = poet.biography || poet.short_bio || "বিস্তারিত জীবনী এখনো যোগ করা হয়নি।";

  const sourcesWrap = document.querySelector("#publicPoetSourcesWrap");
  const sources = document.querySelector("#publicPoetSources");
  sources.textContent = poet.sources || "";
  sourcesWrap.classList.toggle("hidden", !poet.sources);

  const photo = document.querySelector("#publicPoetPhoto");
  photo.removeAttribute("src");
  photo.classList.add("hidden");

  if(poet.photo_url){
    try {
      const photoUrl = new URL(poet.photo_url, location.href);
      if(photoUrl.protocol === "https:" || photoUrl.protocol === "http:"){
        photo.src = photoUrl.href;
        photo.classList.remove("hidden");
      }
    } catch(error) {
      console.warn("Invalid poet photo URL:", error);
    }
  }

  list.classList.add("hidden");
  detail.classList.remove("hidden");
  detail.scrollIntoView({behavior:"smooth", block:"start"});
}

function showPoetProfilesPage(){
  home.classList.add("hidden");
  document.querySelector("#favoritePage")?.classList.add("hidden");
  document.querySelector("#contents")?.classList.add("hidden");
  library.classList.add("hidden");
  reader.classList.add("hidden");

  const page = document.querySelector("#poetProfilesPage");
  const detail = document.querySelector("#poetProfileDetail");
  const list = document.querySelector("#poetProfilesList");

  if(!page || !detail || !list) return;

  detail.classList.add("hidden");
  list.classList.remove("hidden");
  page.classList.remove("hidden");
  updateNav(null);
  loadPublicPoetProfiles();
}

document.querySelector("#homePoetProfilesBtn")?.addEventListener("click", showPoetProfilesPage);
loadPublicPoetProfiles();

document.querySelector("#poetProfilesHomeBtn")?.addEventListener("click", showHome);

document.querySelector("#poetProfileBackToList")?.addEventListener("click", function(){
  document.querySelector("#poetProfileDetail")?.classList.add("hidden");
  document.querySelector("#poetProfilesList")?.classList.remove("hidden");
});

function toBanglaNumber(n){
  return String(n).replace(/[0-9]/g, function(d){ return "০১২৩৪৫৬৭৮৯"[Number(d)]; });
}

function renderContents(classes, category){
  const contents=document.querySelector("#contents");
  const className=document.querySelector("#contentsClassName");
  const wrap=document.querySelector("#contentsTableWrap");
  const heading=document.querySelector("#contentsHeading");
  if(!contents || !className || !wrap) return;

  const categoryLabel = category === "old" ? "পুরোনো কবিতা"
    : category === "current" ? "বর্তমান কবিতা" : "";

  if(heading){
    heading.textContent = category === "old" ? "📖 পুরোনো কবিতার সূচিপত্র"
      : category === "current" ? "📖 বর্তমান কবিতার সূচিপত্র" : "📖 সূচিপত্র";
  }

  const classList = Array.isArray(classes) ? classes.map(Number) : [];
  const allClasses = classList.length === 12 &&
    classList.every((c,i) => c === i + 1);

  if(allClasses){
    className.textContent="সকল শ্রেণির কবিতার তালিকা";
  } else if(classList.length===2 && classList[0]===9 && classList[1]===10){
    className.textContent="নবম–দশম শ্রেণি";
  } else if(classList.length===2 && classList[0]===11 && classList[1]===12){
    className.textContent="একাদশ–দ্বাদশ শ্রেণি";
  } else {
    className.textContent=(classNames[classList[0]] || classList[0])+" শ্রেণি";
  }
  if(categoryLabel) className.textContent += " — " + categoryLabel;

  const poems=[];
  classList.forEach(function(c){
    (classData[String(c)] || []).forEach(function(poem,index){
      const matches = !category ||
        (category === "old" ? poem.oldBook === true : poem.oldBook !== true);
      if(matches) poems.push({poem:poem,classNo:c,index:index});
    });
  });

  if(poems.length===0){
    wrap.innerHTML="<div class=\"contents-empty\">এই বিভাগে কোনো কবিতা পাওয়া যায়নি।</div>";
    return;
  }

  const lastColumn = allClasses ? "<th>শ্রেণি</th>" : "";
  wrap.innerHTML=`<table class="contents-table">
    <thead><tr><th>নং</th><th>কবিতার নাম</th><th>কবির নাম</th>${lastColumn}</tr></thead>
    <tbody>${poems.map(function(entry,i){
      const poem=entry.poem;
      const typeText = allClasses ? displayClassName(entry.classNo) : "";
      return `<tr data-class="${entry.classNo}" data-index="${entry.index}">
        <td>${toBanglaNumber(i+1)}</td>
        <td>${poem.title || "নাম নেই"}</td>
        <td>${poem.poet || "—"}</td>
        ${allClasses ? `<td>${typeText}</td>` : ""}
      </tr>`;
    }).join("")}</tbody>
  </table>`;

  wrap.querySelectorAll("tbody tr").forEach(function(row){
    row.addEventListener("click", function(){
      const arr=classData[String(this.dataset.class)] || [];
      const poem=arr[Number(this.dataset.index)];
      if(poem) show(poem);
    });
  });
}

function openAllCategoryContents(category){
  home.classList.add("hidden");
  library.classList.add("hidden");
  reader.classList.add("hidden");
  document.querySelector("#contents").classList.remove("hidden");
  renderContents(Array.from({length:12}, (_,i) => i+1), category);
}

document.getElementById("currentAllContentsBtn")?.addEventListener("click", function(){
  openAllCategoryContents("current");
});

document.getElementById("oldAllContentsBtn")?.addEventListener("click", function(){
  openAllCategoryContents("old");
});

const navHome=document.querySelector("#navHome");
const homeBtn=document.querySelector("#homeBtn");

if(navHome){
  navHome.addEventListener("click", function(){
    showHome();
  });
}

if(homeBtn){
  homeBtn.addEventListener("click", function(){
    showHome();
  });
}

function runGlobalSearch(q){
  q=(q||"").trim().toLowerCase();
  if(!q){
    openClass(1);
    return;
  }
  globalSearchMode=true;
  selectedPoemCategory = null;
  globalSearchResults=[];
  for(let c=1;c<=12;c++){
    (classData[String(c)]||[]).forEach(x=>{
      const hay=(String(x.title||"")+" "+String(x.poet||"")).toLowerCase();
      if(hay.includes(q)) globalSearchResults.push(x);
    });
  }
  items=globalSearchResults;
  home.classList.add("hidden");
  reader.classList.add("hidden");
  library.classList.remove("hidden");
  document.querySelector('#classTitle').textContent='সব শ্রেণিতে সার্চ ফলাফল';
  document.querySelector('#classCount').textContent=`পাওয়া গেছে: ${toBanglaNumber(globalSearchResults.length)} টি`;
  showingFavorites=false;
  if(favoriteFilter) favoriteFilter.textContent='♡ প্রিয় কবিতা';
  render();
}

function render(){
  const categoryCards = document.getElementById("poemCategoryCards");
  const categoryBack = document.getElementById("poemCategoryBack");
  const poemList = document.getElementById("list");
  const adminRow = document.getElementById("poemAdminButtonRow");

  const choosingCategory = !globalSearchMode && !showingFavorites && !selectedPoemCategory;

  if (categoryCards) categoryCards.classList.toggle("hidden", !choosingCategory);
  if (categoryBack) categoryBack.classList.toggle("hidden", choosingCategory || globalSearchMode);
  const categoryContentsBtn = document.getElementById("categoryContentsBtn");
  if(categoryContentsBtn){
    categoryContentsBtn.textContent = selectedPoemCategory === "old"
      ? "📖 পুরোনো কবিতার সূচিপত্র"
      : "📖 বর্তমান কবিতার সূচিপত্র";
  }
  if (poemList) poemList.classList.toggle("hidden", choosingCategory);

  if (adminRow) {
    adminRow.classList.toggle("hidden", choosingCategory || globalSearchMode);
    const currentButton = document.getElementById("addPoemBtn");
    const oldButton = document.getElementById("oldBookPoemBtn");
    if (currentButton) currentButton.classList.toggle("hidden", selectedPoemCategory === "old");
    if (oldButton) oldButton.classList.toggle("hidden", selectedPoemCategory !== "old");
  }

  const q = (search ? search.value : '').trim().toLowerCase();
  let a = items.filter(x =>
    (String(x.title || "") + " " + (x.poet || "")).toLowerCase().includes(q)
  );

  if (!globalSearchMode && selectedPoemCategory) {
    a = a.filter(x =>
      selectedPoemCategory === "old" ? x.oldBook === true : x.oldBook !== true
    );
  }

  if (showingFavorites) a = a.filter(isFavorite);
  if (poemList) renderPoems(poemList, a);

  if (!globalSearchMode && !showingFavorites) {
    const categoryName = selectedPoemCategory === "old"
      ? "পুরোনো কবিতা"
      : selectedPoemCategory === "current" ? "বর্তমান কবিতা" : "";

    const titleEl = document.querySelector('#classTitle');
    if (titleEl) {
      titleEl.textContent = categoryName
        ? `${selectedClassTitle} — ${categoryName}`
        : selectedClassTitle;
    }

    const countEl = document.querySelector('#classCount');
    if (countEl) {
      countEl.textContent = choosingCategory
        ? `মোট কবিতা: ${toBanglaNumber(items.length)} টি`
        : `পাওয়া গেছে: ${toBanglaNumber(a.length)} টি`;
    }
  } else if (globalSearchMode) {
    const countEl = document.querySelector('#classCount');
    if (countEl) countEl.textContent = `পাওয়া গেছে: ${toBanglaNumber(a.length)} টি`;
  }
}


const currentPoemsCard = document.getElementById("currentPoemsCard");
if (currentPoemsCard) currentPoemsCard.addEventListener("click", function(){
  selectedPoemCategory = "current";
  render();
});

const oldPoemsCard = document.getElementById("oldPoemsCard");
if (oldPoemsCard) oldPoemsCard.addEventListener("click", function(){
  selectedPoemCategory = "old";
  render();
});

const backToPoemCategories = document.getElementById("backToPoemCategories");
if (backToPoemCategories) backToPoemCategories.addEventListener("click", function(){
  selectedPoemCategory = null;
  const box = document.getElementById("newPoemBox");
  if (box) box.remove();
  render();
});

function show(x){
  readerReturnPage = document.querySelector("#contents")?.classList.contains("hidden") === false
    ? "contents"
    : document.querySelector("#favoritePage")?.classList.contains("hidden")
      ? "library" : "favorites";
  stopPoemAudio();
  currentPoem=x;

  library.classList.add("hidden");
  document.querySelector("#contents")?.classList.add("hidden");
  reader.classList.remove("hidden");

  document.querySelector("#meta").textContent=
    `শ্রেণি: ${classNames[x.class]}`;

  document.querySelector("#title").textContent=x.title;

  document.querySelector("#poet").textContent=
    x.poet ? x.poet : "";
  loadPoetProfileForReader(x.poet || "");

  const poemTextEl = document.querySelector("#text");
  const displayText = savedText(x);

  poemTextEl.style.fontFamily =
    '"SolaimanLipi",sans-serif';

  poemTextEl.innerHTML =
    /<[^>]+>/.test(displayText)
      ? displayText
      : displayText.replace(/\\n/g, "<br>");

  editArea.classList.add("hidden");
  document.querySelector("#text").classList.remove("hidden");
  editBtn.classList.toggle("hidden", !isPoetAdmin());
  if(reciteControls){
    reciteControls.classList.remove("hidden");
  }
  renderPoemAudioPanel(x);
  if(speakBtn){

  speakBtn.onclick=()=>{

    if(!currentPoem) return;
    stopPoemAudio();

    const title=currentPoem.title || "";

    const poet=currentPoem.poet ? `কবি: ${currentPoem.poet}` : "";

    const poem=savedText(currentPoem);

    const fullText=[title,poet,poem].filter(Boolean).join("\\n");

    // Android app: existing native speech
    if(window.Android && typeof Android.speak === "function"){

      Android.speak(fullText);

      speakBtn.textContent="🎙️ আবৃত্তি চলছে";

      if(reciteControls) reciteControls.classList.remove("hidden");

      return;

    }

    // Web browser: Speech Synthesis
    if("speechSynthesis" in window){

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(fullText);

      utterance.lang = "bn-BD";
      utterance.rate = 0.85;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();

      const bengaliVoice = voices.find(v =>
        v.lang && v.lang.toLowerCase().startsWith("bn")
      );

      if(bengaliVoice){
        utterance.voice = bengaliVoice;
      }

      utterance.onstart = () => {
        speakBtn.textContent="🎙️ আবৃত্তি চলছে";
        if(reciteControls) reciteControls.classList.remove("hidden");
      };

      utterance.onend = () => {
        speakBtn.textContent="🎙️ আবৃত্তি শুরু";
      };

      utterance.onerror = () => {
        speakBtn.textContent="🎙️ আবৃত্তি শুরু";
      };

      window.speechSynthesis.speak(utterance);

      return;

    }

    alert("এই ব্রাউজারে আবৃত্তির সুবিধা পাওয়া যাচ্ছে না।");

  };

}
}

let isPaused=false;

if(pauseBtn){
  pauseBtn.onclick=()=>{
    if(activePoemAudio){
      activePoemAudio.pause();
      isPaused=true;
      pauseBtn.textContent="▶️ চালাও";
      return;
    }
    if(window.Android && typeof Android.pause === "function"){
      Android.pause();
      isPaused=true;
      pauseBtn.textContent="▶️ চালাও";
      return;
    }
    if(window.speechSynthesis){
      window.speechSynthesis.pause();
      isPaused=true;
      pauseBtn.textContent="▶️ চালাও";
    }
  };
}

if(resumeBtn){
  resumeBtn.onclick=()=>{
    if(activePoemAudio && activePoemAudio.paused){
      const result=activePoemAudio.play();
      if(result && typeof result.catch === "function"){
        result.catch(error=>console.error("Audio resume error:",error));
      }
      isPaused=false;
      pauseBtn.textContent="Ⅱ বিরতি";
      return;
    }
    if(window.Android && typeof Android.resume === "function"){
      Android.resume();
      isPaused=false;
      pauseBtn.textContent="Ⅱ বিরতি";
      return;
    }
    if(window.speechSynthesis){
      window.speechSynthesis.resume();
      isPaused=false;
      pauseBtn.textContent="Ⅱ বিরতি";
    }
  };
}

if(stopBtn){
  stopBtn.onclick=()=>{
    stopPoemAudio();
    if(window.Android && typeof Android.stop === "function"){
      Android.stop();
    }
    if(window.speechSynthesis){
      window.speechSynthesis.cancel();
    }
    isPaused=false;
    if(pauseBtn) pauseBtn.textContent="Ⅱ বিরতি";
    if(speakBtn) speakBtn.textContent="🎙️ আবৃত্তি শুরু";
  };
}

window.addEventListener("beforeunload",()=>{
  stopPoemAudio();
  if(window.Android && typeof Android.stop === "function"){
    Android.stop();
  }
  if(window.speechSynthesis){
    window.speechSynthesis.cancel();
  }
});


/* ===== নতুন কবিতা যোগ করার ব্যবস্থা ===== */
(function () {
  const classNames12 = [
    "", "প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম",
    "ষষ্ঠ", "সপ্তম", "অষ্টম", "নবম", "দশম", "একাদশ", "দ্বাদশ"
  ];

  let addPoemClass = null;

  // ১-১২ শ্রেণির জন্য data তৈরি
  for (let i = 1; i <= 12; i++) {
    if (!classData[i]) classData[i] = [];
  }
  document.addEventListener("admin-session-changed", function () {
  if (isPoetAdmin()) {
  addButton();
  } else {
  document.getElementById("addPoemBtn")?.parentElement?.remove();
  document.querySelectorAll(".deleteUserPoem").forEach(button => button.remove());
  }

  const reader = document.getElementById("reader");
  if (currentPoem && reader && !reader.classList.contains("hidden")) {
    renderPoemAudioPanel(currentPoem);
  }
  });

  function addButton() {
    if(!isPoetAdmin()){
      return;
    }
    const library = document.getElementById("library");
    if (!library || document.getElementById("addPoemBtn")) return;

    const btn = document.createElement("button");
    btn.id = "addPoemBtn";
    btn.textContent = "📚 ➕ নতুন কবিতা যোগ করুন";
    btn.style.cssText =
      "display:inline-block;flex:1;min-width:0;margin:0;padding:12px 10px;border:0;border-radius:12px;font-size:16px;cursor:pointer;background:#ffe0ec;";

    const bar = library.querySelector(".bar");
    if (bar) bar.after(btn);
    else library.prepend(btn);

    btn.onclick = function () {
      showPoemForm();
    };

    const oldBookBtn = document.createElement("button");
    oldBookBtn.id = "oldBookPoemBtn";
    oldBookBtn.textContent = "📚 পুরোনো বইয়ের কবিতা যোগ করুন";
    oldBookBtn.style.cssText =
      "display:inline-block;flex:1;min-width:0;margin:0;padding:12px 10px;border:0;border-radius:12px;font-size:16px;cursor:pointer;background:#e8e0ff;";

    const buttonRow = document.createElement("div");
    buttonRow.id = "poemAdminButtonRow";
    buttonRow.style.cssText = "display:flex;gap:10px;width:100%;margin:12px 0;";
    const tools = library.querySelector(".section-tools");
    if (tools) tools.after(buttonRow);
    else library.prepend(buttonRow);
    buttonRow.append(btn, oldBookBtn);
    buttonRow.classList.add("hidden");
    render();

    oldBookBtn.onclick = function () {
      showOldBookPoemForm();
    };
  }

  function showOldBookPoemForm() {
    if(!isPoetAdmin()){
      return;
    }

    if (Array.isArray(selectedClasses) && selectedClasses.length > 0) {
      if (selectedClasses.includes(9) && selectedClasses.includes(10)) {
        addPoemClass = 9;
      } else if (selectedClasses.includes(11) && selectedClasses.includes(12)) {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(selectedClasses[0]);
      }
    }

    if (!addPoemClass) {
      alert("আগে একটি শ্রেণি নির্বাচন করুন।");
      return;
    }

    let old = document.getElementById("newPoemBox");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "newPoemBox";
    box.style.cssText =
      "background:#fff;padding:16px;border-radius:16px;margin:12px 0;box-shadow:0 2px 10px #0002;";

    box.innerHTML = `
      <h3>📚 পুরোনো বইয়ের কবিতা যোগ করুন</h3>

      <input id="oldPoemLesson" type="number" min="1"
        placeholder="পুরোনো বইয়ের পাঠ/ক্রমিক নম্বর"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="oldPoemTitle"
        placeholder="কবিতার নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="oldPoemPoet"
        placeholder="কবির নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <textarea id="oldPoemText" rows="10"
        placeholder="কবিতার লেখা"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;"></textarea>

      <button id="saveOldPoem"
        style="padding:10px 16px;border:0;border-radius:10px;background:#e8e0ff;cursor:pointer;">
        💾 পুরোনো কবিতা সংরক্ষণ
      </button>

      <button id="cancelOldPoem"
        style="padding:10px 16px;border:0;border-radius:10px;background:#eee;cursor:pointer;margin-left:6px;">
        বাতিল
      </button>
    `;

    const list = document.getElementById("list");
    if (list) list.before(box);

    document.getElementById("cancelOldPoem").onclick = function () {
      box.remove();
    };

    document.getElementById("saveOldPoem").onclick = async function () {
      if(!isPoetAdmin()){
        return;
      }

      const lesson = Number(document.getElementById("oldPoemLesson").value);
      const title = document.getElementById("oldPoemTitle").value.trim();
      const poet = document.getElementById("oldPoemPoet").value.trim();
      const text = document.getElementById("oldPoemText").value.trim();

      if (!lesson || lesson < 1) {
        alert("পুরোনো বইয়ের পাঠ/ক্রমিক নম্বর দিতে হবে।");
        return;
      }

      if (!title || !text) {
        alert("কবিতার নাম এবং কবিতার লেখা দিতে হবে।");
        return;
      }

      const saveButton = document.getElementById("saveOldPoem");
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.6";
      }

      const poemKey =
        "old-book-class-" + Number(addPoemClass) +
        "-lesson-" + lesson +
        "-title-" + title.toLowerCase() +
        "-text-" + text.toLowerCase();

      try {
        const existingRows = await supabaseRequest(
          "poems?select=*&poem_key=eq." +
          encodeURIComponent(poemKey) +
          "&limit=1"
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          alert("এই পুরোনো বইয়ের কবিতাটি ইতিমধ্যে অনলাইন তথ্যভান্ডারে আছে।");
          box.remove();
          return;
        }

        const rows = await supabaseRequest("poems", {
          method: "POST",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            poem_key: poemKey,
            class: Number(addPoemClass),
            lesson: lesson,
            title: title,
            poet: poet,
            source_page: null,
            is_excerpt: false,
            text: text,
            user_added: true,
            old_book: true
          })
        });

        if (!Array.isArray(rows) || !rows[0] || !rows[0].id) {
          throw new Error("Supabase save failed");
        }

        const row = rows[0];

        const poem = {
          id: row.id,
          class: row.class,
          lesson: row.lesson,
          title: row.title,
          poet: row.poet || "",
          source_page: row.source_page,
          is_excerpt: !!row.is_excerpt,
          text: row.text,
          userAdded: !!row.user_added,
          oldBook: true,
          maleAudioUrl: row.male_audio_url || "",
          femaleAudioUrl: row.female_audio_url || ""
        };

        if (!classData[addPoemClass]) {
          classData[addPoemClass] = [];
        }

        classData[addPoemClass].push(poem);

        box.remove();
        items = classData[addPoemClass] || [];
        render();

        alert("পুরোনো বইয়ের কবিতা সফলভাবে যোগ হয়েছে।");

      } catch (err) {
        console.error("Old book poem save error:", err);
        alert("পুরোনো বইয়ের কবিতা সংরক্ষণ করা যায়নি.");

        if (saveButton) {
          saveButton.disabled = false;
          saveButton.style.opacity = "1";
        }
      }
    };
  }

  function showPoemForm() {
    if(!isPoetAdmin()){
      return;
    }

    // Combined class হলে প্রথম class-এ নতুন কবিতা সংরক্ষণ
    if (Array.isArray(selectedClasses) && selectedClasses.length > 0) {
      if (selectedClasses.includes(9) && selectedClasses.includes(10)) {
        addPoemClass = 9;
      } else if (selectedClasses.includes(11) && selectedClasses.includes(12)) {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(selectedClasses[0]);
      }
    }

    let old = document.getElementById("newPoemBox");
    if (old) old.remove();

    let duplicateFound = false;
    const box = document.createElement("div");
    box.id = "newPoemBox";
    box.style.cssText =
      "background:#fff;padding:16px;border-radius:16px;margin:12px 0;box-shadow:0 2px 10px #0002;";

    box.innerHTML = `
      <h3>➕ নতুন কবিতা যোগ করুন</h3>

      <input id="newPoemTitle"
        placeholder="কবিতার নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="newPoemPoet"
        placeholder="কবির নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <textarea id="newPoemText"
        placeholder="এখানে কবিতাটি লিখুন বা পেস্ট করুন"
        rows="10"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;"></textarea>

      <button id="saveNewPoem"
        style="padding:11px 18px;border:0;border-radius:10px;background:#dff5e1;cursor:pointer;">
        💾 সংরক্ষণ
      </button>

      <button id="cancelNewPoem"
        style="padding:11px 18px;border:0;border-radius:10px;background:#eee;cursor:pointer;margin-left:6px;">
        বাতিল
      </button>
    `;

    const list = document.getElementById("list");
    if (list) list.before(box);

    document.getElementById("cancelNewPoem").onclick = function () {
      box.remove();
    };

    document.getElementById("saveNewPoem").onclick = async function () {
      if(!isPoetAdmin()){
        return;
      }
      const title = document.getElementById("newPoemTitle").value.trim();
      const poet = document.getElementById("newPoemPoet").value.trim();
      const text = document.getElementById("newPoemText").value.trim();

      if (!title || !text) {
        alert("কবিতার নাম এবং কবিতার লেখা দিতে হবে।");
        return;
      }

      if (!addPoemClass) {
        alert("আগে একটি শ্রেণি নির্বাচন করুন।");
        return;
      }

      const saveButton = document.getElementById("saveNewPoem");

      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.6";
      }

      const poemKey =
        "class-" + Number(addPoemClass) +
        "-title-" + title.toLowerCase() +
        "-text-" + text.toLowerCase();

      try {
        // আগে Supabase-এ duplicate আছে কি না দেখি
        const existingRows = await supabaseRequest(
          "poems?select=*&poem_key=eq." +
          encodeURIComponent(poemKey) +
          "&limit=1"
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          alert("এই কবিতাটি ইতিমধ্যে অনলাইন তথ্যভান্ডারে আছে।");
          box.remove();
          return;
        }

        // একই Class-এর নতুন কবিতার পরবর্তী lesson number নির্ধারণ
        const userAddedRows = await supabaseRequest(
          "poems?select=lesson&class=eq." +
          Number(addPoemClass) +
          "&order=lesson.desc&limit=1"
        );

        let nextLesson = 1;

        if (Array.isArray(userAddedRows) && userAddedRows.length > 0) {
          const maxLesson = Number(userAddedRows[0].lesson || 0);
          nextLesson = maxLesson + 1;
        }

        // Supabase-এ নতুন কবিতা তৈরি
        const rows = await supabaseRequest("poems", {
          method: "POST",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            poem_key: poemKey,
            class: Number(addPoemClass),
            lesson: nextLesson,
            title: title,
            poet: poet,
            source_page: null,
            is_excerpt: false,
            text: text,
            user_added: true
          })
        });

        if (!Array.isArray(rows) || !rows[0] || !rows[0].id) {
          throw new Error("Supabase নতুন কবিতার ID ফেরত দেয়নি।");
        }

        // Supabase-এর returned row-টাই app-এর data হিসেবে ব্যবহার
        const row = rows[0];

        const poem = {
          id: row.id,
          class: row.class,
          lesson: row.lesson,
          title: row.title,
          poet: row.poet || "",
          source_page: row.source_page,
          is_excerpt: !!row.is_excerpt,
          text: row.text,
          userAdded: !!row.user_added,
          oldBook: !!row.old_book,
          maleAudioUrl: row.male_audio_url || "",
          femaleAudioUrl: row.female_audio_url || ""
        };

        if (!classData[addPoemClass]) {
          classData[addPoemClass] = [];
        }

        classData[addPoemClass].push(poem);

        console.log("New poem synced to Supabase:", poem.id);

        box.remove();

        items = classData[addPoemClass] || [];
        render();

        setTimeout(enablePoemDeleteButtons, 50);

        alert("কবিতাটি সফলভাবে যোগ হয়েছে।");

      } catch (error) {
        console.error("New poem sync failed:", error);

        if (saveButton) {
          saveButton.disabled = false;
          saveButton.style.opacity = "1";
        }

        alert("কবিতা অনলাইনে সংরক্ষণ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
      }
    };

  }


  // ===== যোগ করা কবিতা Delete করার ব্যবস্থা =====
  function enablePoemDeleteButtons() {
    if(!isPoetAdmin()){
      return;
    }
    document.querySelectorAll(".deleteUserPoem").forEach(function (btn) {
      if (btn.dataset.ready === "1") return;

      btn.dataset.ready = "1";

      btn.addEventListener("click", async function (e) {
        e.stopPropagation();

        const index = Number(btn.dataset.index);
        const cls = Number(btn.dataset.class);

        if (!confirm("এই কবিতাটি মুছে ফেলতে চান?")) return;

        const poemToDelete =
          classData[cls] && classData[cls][index]
            ? classData[cls][index]
            : null;

        if (!poemToDelete) {
          alert("এই কবিতাটি পাওয়া যায়নি।");
          return;
        }

        // Supabase ID ছাড়া কোনো poem delete করা হবে না
        if (!poemToDelete.id) {
          alert("এই কবিতার অনলাইন তথ্যভান্ডারের পরিচিতি পাওয়া যায়নি।");
          return;
        }

        btn.disabled = true;

        try {
          await supabaseRequest(
            "poems?id=eq." + encodeURIComponent(poemToDelete.id),
            {
              method: "DELETE",
              headers: {
                "Prefer": "return=minimal"
              }
            }
          );

          console.log(
            "Poem deleted from Supabase:",
            poemToDelete.id
          );

          // Supabase delete সফল হওয়ার পরেই UI থেকে remove
          classData[cls].splice(index, 1);

          items = classData[cls] || [];

          render();

          setTimeout(enablePoemDeleteButtons, 50);

          alert("কবিতাটি সফলভাবে মুছে ফেলা হয়েছে।");

        } catch (error) {
          console.error("Poem delete sync failed:", error);

          btn.disabled = false;

          alert("অনলাইন তথ্যভান্ডার থেকে কবিতা মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        }
      });
    });
  }

  // render হওয়ার পর Delete button চালু করা
  const originalRenderForDelete = render;
  render = function () {
    originalRenderForDelete();
    setTimeout(enablePoemDeleteButtons, 30);
  };

  // শ্রেণির button-এ click হলে কোন শ্রেণি খোলা হয়েছে সেটা মনে রাখা
  document.querySelectorAll(".nav-class").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.dataset.class;

      if (key === "9-10") {
        addPoemClass = 9;
      } else if (key === "11-12") {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(key);
      }

      setTimeout(addButton, 50);
    });
  });

  if (!home.classList.contains("hidden")) showHome();
})();
    
// ===== Supabase Cloud Sync =====
async function initializeCloudSync() {
  console.log("Cloud sync starting...");

  const loaded = await loadPoemsFromSupabase();
  populatePoetDropdown();

  if (loaded) {
    updateClassNavCounts();
    items = classData[1] || [];

    if (!home.classList.contains("hidden")) {
      showHome();
    } else {
      render();
    }

    console.log("Cloud sync completed.");
  } else {
    console.log("Cloud sync loaded no poems.");
  }
}
initializeCloudSync();



/* Ensure dynamically rendered read buttons stay compact on every render. */
(function(){
  function compactReadButtons(){
    document.querySelectorAll(".card .readBtn, .globalSearchCard .readBtn").forEach(function(btn){
      btn.style.setProperty("width","fit-content","important");
      btn.style.setProperty("min-width","0","important");
      btn.style.setProperty("max-width","max-content","important");
      btn.style.setProperty("height","30px","important");
      btn.style.setProperty("min-height","0","important");
      btn.style.setProperty("padding","4px 9px","important");
      btn.style.setProperty("font-size","12px","important");
      btn.style.setProperty("line-height","1","important");
      btn.style.setProperty("border-radius","8px","important");
    });
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", compactReadButtons);
  }else{
    compactReadButtons();
  }
  if(document.body){
    new MutationObserver(compactReadButtons).observe(document.body,{childList:true,subtree:true});
  }
})();

const categoryContentsBtn=document.querySelector("#categoryContentsBtn");
if(categoryContentsBtn){
  categoryContentsBtn.addEventListener("click", function(){
    home.classList.add("hidden");
    library.classList.add("hidden");
    reader.classList.add("hidden");
    document.querySelector("#contents").classList.remove("hidden");
    renderContents(selectedClasses, selectedPoemCategory);
  });
}


// ===== Bangla Pathshala: PDF / Print =====
function bpPrintPoems(poems, documentTitle) {
  if (!Array.isArray(poems) || poems.length === 0) {
    alert("প্রিন্ট করার মতো কোনো কবিতা পাওয়া যায়নি।");
    return;
  }

  let root = document.getElementById("bpPrintRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "bpPrintRoot";
    document.body.appendChild(root);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }

  function poemBody(poem) {
    const raw = String(savedText(poem) || "");
    const holder = document.createElement("div");

    if (/<[a-z][\s\S]*>/i.test(raw)) {
      holder.innerHTML = raw;
    } else {
      holder.textContent = raw;
      return esc(holder.textContent).replace(/\r?\n/g, "<br>");
    }

    holder.querySelectorAll("script,iframe,object,embed,form,button").forEach(el => el.remove());
    holder.querySelectorAll("*").forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (/^on/i.test(attr.name) || (attr.name === "href" && /^\s*javascript:/i.test(attr.value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return holder.innerHTML;
  }

  const poemHtml = poems.map(function(poem, index) {
    const classNo = Number(poem.class);
    const classLabel = displayClassName(classNo) + " শ্রেণি";
    return `
      <section class="bp-print-poem">
        <div class="bp-print-meta">${esc(classLabel)}</div>
        <h2>${esc(poem.title || "নাম নেই")}</h2>
        ${poem.poet ? `<div class="bp-print-poet">${esc(poem.poet)}</div>` : ""}
        <div class="bp-print-text">${poemBody(poem)}</div>
      </section>`;
  }).join("");

  root.innerHTML = `
    <style>
      @font-face {
        font-family: "BPPrintFont";
        src: url("fonts/SolaimanLipi.ttf") format("truetype");
        font-weight: 400;
      }
      #bpPrintRoot {
        display: none;
        background: #fff;
        color: #111;
        font-family: "BPPrintFont", "SolaimanLipi", sans-serif;
      }
      #bpPrintRoot .bp-print-heading {
        text-align: center;
        font-size: 25px;
        margin: 0 0 24px;
        padding-bottom: 12px;
        border-bottom: 1px solid #bbb;
      }
      #bpPrintRoot .bp-print-poem {
        break-after: page;
        page-break-after: always;
        padding: 0;
        color: #111;
      }
      #bpPrintRoot .bp-print-poem:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      #bpPrintRoot h2 {
        text-align: center;
        font-size: 25px;
        font-weight: bold;
        margin: 12px 0;
      }
      #bpPrintRoot .bp-print-meta {
        text-align: left;
        font-size: 15px;
        margin: 5px 0 12px;
      }
      #bpPrintRoot .bp-print-poet {
        text-align: center;
        font-size: 15px;
        margin: 5px 0 40px;
      }
      #bpPrintRoot .bp-print-text {
        font-size: 21px;
        line-height: 1.9;
        white-space: normal;
        overflow-wrap: anywhere;
        margin-left: 150px;
        margin-right: 150px;
      }
      #bpPrintRoot .bp-print-text p {
        margin: 0 0 8px;
      }
      #bpPrintRoot .bp-print-text img {
        max-width: 100%;
        height: auto;
      }
      @page { size: A4; margin: 18mm 16mm; }
      @media print {
        html, body {
          display: block !important;
          background: #fff !important;
          color: #111 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body > *:not(#bpPrintRoot) {
          display: none !important;
        }
        body > #bpPrintRoot {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          width: 100% !important;
          background: #fff !important;
          color: #111 !important;
        }
        #bpPrintRoot * {
          visibility: visible !important;
          color: #111 !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
      }
    </style>
    ${documentTitle ? `<h1 class="bp-print-heading">${esc(documentTitle)}</h1>` : ""}
    ${poemHtml}
  `;

  const startPrint = function() {
    if (window.Android && typeof window.Android.printPage === "function") {
      window.Android.printPage();
    } else {
      window.print();
    }
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startPrint).catch(startPrint);
  } else {
    setTimeout(startPrint, 250);
  }
}

function printAllCategoryPoems(category){
  const allPoems = [];
  for(let c = 1; c <= 12; c++){
    allPoems.push(...(classData[String(c)] || []));
  }
  const poems = allPoems.filter(poem =>
    category === "old" ? poem.oldBook === true : poem.oldBook !== true
  );
  const title = category === "old"
    ? "বাংলাপাঠশালা — পুরোনো সকল শ্রেণির কবিতা"
    : "বাংলাপাঠশালা — বর্তমান সকল শ্রেণির কবিতা";
  bpPrintPoems(poems, title);
}

document.getElementById("currentAllPrintBtn")?.addEventListener("click", function(){
  printAllCategoryPoems("current");
});

document.getElementById("oldAllPrintBtn")?.addEventListener("click", function(){
  printAllCategoryPoems("old");
});

document.getElementById("printClassBtn")?.addEventListener("click", function() {
  if (!selectedClasses || selectedClasses.length === 0) {
    alert("আগে একটি শ্রেণি নির্বাচন করুন।");
    return;
  }
  const poems = selectedClasses.flatMap(c => classData[String(c)] || []);
  const title = selectedClasses.length === 2 && selectedClasses[0] === 9
    ? "নবম–দশম শ্রেণির কবিতা"
    : selectedClasses.length === 2 && selectedClasses[0] === 11
      ? "একাদশ–দ্বাদশ শ্রেণির কবিতা"
      : (classNames[selectedClasses[0]] || selectedClasses[0]) + " শ্রেণির কবিতা";
  bpPrintPoems(poems, title);
});

document.getElementById("printPoemBtn")?.addEventListener("click", function() {
  if (currentPoem) {
    bpPrintPoems([currentPoem], "");
  }
});
