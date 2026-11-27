/* Skill Squad workspace — static client for the Supabase command boundary.
   No build step: everything below runs directly in the browser. */

const copy = {
  en: {
    "nav.skip": "Skip to content",
    "ws.back": "Back to site",
    "ws.kicker": "WORKSPACE",
    "ws.title": 'Describe a routine.<br /><span>Get a skill.</span>',
    "ws.lede": "Write what you want in plain language. Skill Squad drafts a playbook with steps and guardrails, and stores it for your organization.",
    "ws.signin": "Sign in",
    "ws.signup": "Create account",
    "ws.email": "Email",
    "ws.password": "Password",
    "ws.passwordHint": "At least 8 characters.",
    "ws.signinSubmit": "Sign in",
    "ws.signupSubmit": "Create account",
    "ws.signedInAs": "Signed in as",
    "ws.signout": "Sign out",
    "ws.describe": "What should this skill do?",
    "ws.describePlaceholder": "e.g. When a new supplier writes, check the offer, collect the missing documents and prepare a short summary for me.",
    "ws.describeHint": "Plain language. Up to 4000 characters.",
    "ws.draft": "Draft with AI",
    "ws.draftHint": "You review and edit the draft before saving.",
    "ws.name": "Name",
    "ws.whenToUse": "When to use it",
    "ws.description": "Description",
    "ws.steps": "Steps",
    "ws.stepsPlaceholder": "Check the offer :: Read the request and list what is missing.\nCollect documents :: Ask for the missing files.",
    "ws.stepsHint": "One step per line, as “Title :: detail”. Up to 8 steps.",
    "ws.guardrails": "Guardrails",
    "ws.guardrailsPlaceholder": "Never send messages without approval.\nNever invent prices.",
    "ws.guardrailsHint": "One per line. Up to 6.",
    "ws.save": "Save skill",
    "ws.list": "Your skills",
    "ws.reload": "Refresh",
    "ws.empty": "No skills yet. Describe one above.",
    "ws.footLeft": "Skill Squad Core · private to your organization",
    "ws.footRight": "Back to skillsquad",
    okSaved: "Skill saved as a draft.",
    okDraft: "Draft ready. Review it before saving.",
    okSignedOut: "Signed out.",
    okReloaded: "List refreshed.",
    needConfig: "Supabase is not configured yet. Add supabaseUrl and supabaseAnonKey to site.config.js.",
    needEmail: "Enter your email and a password of at least 8 characters.",
    needSource: "Describe the skill you want first.",
    needFields: "Add a name and at least one step.",
    checkEmail: "Account created. Confirm your email address, then sign in.",
    noDraftService: "AI drafting is not available right now. Fill the fields by hand and save.",
    saving: "Saving…",
    drafting: "Drafting…",
    loading: "Loading…",
    activate: "Activate",
    archive: "Archive",
    confirmArchive: "Archive this skill? It stays readable but cannot be used.",
    errGeneric: "Something went wrong. Try again.",
  },
  bg: {
    "nav.skip": "Към съдържанието",
    "ws.back": "Обратно към сайта",
    "ws.kicker": "РАБОТНО ПРОСТРАНСТВО",
    "ws.title": 'Опишете рутина.<br /><span>Получете умение.</span>',
    "ws.lede": "Напишете какво искате на обикновен език. Skill Squad изготвя чернова със стъпки и ограничения и я запазва за вашата организация.",
    "ws.signin": "Вход",
    "ws.signup": "Регистрация",
    "ws.email": "Имейл",
    "ws.password": "Парола",
    "ws.passwordHint": "Поне 8 знака.",
    "ws.signinSubmit": "Влезте",
    "ws.signupSubmit": "Създайте профил",
    "ws.signedInAs": "Влезли сте като",
    "ws.signout": "Изход",
    "ws.describe": "Какво трябва да прави това умение?",
    "ws.describePlaceholder": "напр. Когато нов доставчик пише, провери офертата, събери липсващите документи и ми подготви кратко резюме.",
    "ws.describeHint": "Обикновен език. До 4000 знака.",
    "ws.draft": "Чернова с AI",
    "ws.draftHint": "Преглеждате и редактирате черновата преди запис.",
    "ws.name": "Име",
    "ws.whenToUse": "Кога се използва",
    "ws.description": "Описание",
    "ws.steps": "Стъпки",
    "ws.stepsPlaceholder": "Провери офертата :: Прочети запитването и отбележи какво липсва.\nСъбери документи :: Поискай липсващите файлове.",
    "ws.stepsHint": "Една стъпка на ред, като „Заглавие :: описание“. До 8 стъпки.",
    "ws.guardrails": "Ограничения",
    "ws.guardrailsPlaceholder": "Никога не изпращай съобщения без одобрение.\nНикога не измисляй цени.",
    "ws.guardrailsHint": "По едно на ред. До 6.",
    "ws.save": "Запази умение",
    "ws.list": "Вашите умения",
    "ws.reload": "Обнови",
    "ws.empty": "Още няма умения. Опишете едно по-горе.",
    "ws.footLeft": "Skill Squad Core · само за вашата организация",
    "ws.footRight": "Обратно към skillsquad",
    okSaved: "Умението е запазено като чернова.",
    okDraft: "Черновата е готова. Прегледайте я преди запис.",
    okSignedOut: "Излязохте.",
    okReloaded: "Списъкът е обновен.",
    needConfig: "Supabase още не е конфигуриран. Добавете supabaseUrl и supabaseAnonKey в site.config.js.",
    needEmail: "Въведете имейл и парола с поне 8 знака.",
    needSource: "Първо опишете какво трябва да прави умението.",
    needFields: "Добавете име и поне една стъпка.",
    checkEmail: "Профилът е създаден. Потвърдете имейла си и след това влезте.",
    noDraftService: "AI черновата не е налична в момента. Попълнете полетата ръчно и запазете.",
    saving: "Запазване…",
    drafting: "Изготвяне…",
    loading: "Зареждане…",
    activate: "Активирай",
    archive: "Архивирай",
    confirmArchive: "Да се архивира ли умението? Остава четливо, но неизползваемо.",
    errGeneric: "Нещо се обърка. Опитайте отново.",
  },
};

const SKILL_MAX_STEPS = 8;
const SKILL_MAX_GUARDRAILS = 6;
const SKILL_SOURCE_MAX_LENGTH = 4000;

const supportedLanguages = Object.keys(copy);
const languageKey = "skill-squad-language";

function getSavedLanguage() {
  try {
    const saved = localStorage.getItem(languageKey);
    if (supportedLanguages.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return document.documentElement.lang === "bg" ? "bg" : "en";
}

let language = getSavedLanguage();

function t(key) {
  return copy[language][key] ?? copy.en[key] ?? key;
}

function setLanguage(next) {
  language = supportedLanguages.includes(next) ? next : "en";
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  const toggle = document.querySelector(".lang-toggle");
  if (toggle) {
    toggle.textContent = language === "en" ? "BG" : "EN";
    toggle.setAttribute("aria-label", language === "en" ? "Превключи на български" : "Switch to English");
  }
  const submit = document.getElementById("auth-submit");
  if (submit) {
    const mode = document.querySelector(".ws-tab.is-active")?.dataset.mode ?? "signin";
    submit.querySelector("span").textContent = t(mode === "signup" ? "ws.signupSubmit" : "ws.signinSubmit");
  }
  try { localStorage.setItem(languageKey, language); } catch { /* storage unavailable */ }
}

/* ---------- DOM ---------- */

const statusEl = document.getElementById("ws-status");
const authPanel = document.getElementById("auth-panel");
const appPanel = document.getElementById("app-panel");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const userEl = document.getElementById("ws-user");
const skillForm = document.getElementById("skill-form");
const sourceEl = document.getElementById("skill-source");
const nameEl = document.getElementById("skill-name");
const whenEl = document.getElementById("skill-when");
const descriptionEl = document.getElementById("skill-description");
const stepsEl = document.getElementById("skill-steps");
const guardrailsEl = document.getElementById("skill-guardrails");
const listEl = document.getElementById("skill-list");
const emptyEl = document.getElementById("skill-empty");
const draftBtn = document.getElementById("draft-btn");
const saveBtn = document.getElementById("save-btn");

let authMode = "signin";

function setStatus(message, kind) {
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = "ws-status" + (kind ? " is-" + kind : "");
}

function showAuth() {
  authPanel.hidden = false;
  appPanel.hidden = true;
}

function showApp(email) {
  authPanel.hidden = true;
  appPanel.hidden = false;
  userEl.textContent = email || "";
}

/* ---------- Supabase client ---------- */

const config = window.SKILL_SQUAD_CONFIG || {};
const supabaseUrl = (config.supabaseUrl || "").replace(/\/$/, "");
const supabaseAnonKey = config.supabaseAnonKey || "";
const configured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase = null;
let organizationId = "";
let session = null;

function client() {
  if (!configured) return null;
  if (!supabase) {
    if (!window.supabase || typeof window.supabase.createClient !== "function") return null;
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return supabase;
}

/* ---------- Organization ---------- */

/** Mirrors ensure-organization.ts: a registered user always ends up with one org. */
async function ensureOrganization(sb, user) {
  const { data: membership, error: membershipError } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (membership?.organization_id) return membership.organization_id;

  const fallbackName = (user.email || "Organization").split("@")[0] || "Organization";
  const { data: org, error: orgError } = await sb
    .from("organizations")
    .insert({ name: fallbackName, owner_user_id: user.id })
    .select("id")
    .single();

  if (orgError || !org?.id) {
    throw new Error(orgError?.message || "Could not create organization");
  }

  const { error: linkError } = await sb.from("organization_memberships").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (linkError) throw new Error(linkError.message);
  return org.id;
}

/* ---------- Skills ---------- */

function parseSteps(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, SKILL_MAX_STEPS)
    .map((line) => {
      const [title, ...rest] = line.split("::");
      const cleanTitle = title.trim().slice(0, 120);
      const detail = rest.join("::").trim().slice(0, 600);
      return { title: cleanTitle, detail: detail || cleanTitle };
    })
    .filter((step) => step.title);
}

function parseGuardrails(text) {
  const seen = new Set();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line.length <= 600)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SKILL_MAX_GUARDRAILS);
}

function renderSkills(rows) {
  listEl.textContent = "";
  emptyEl.hidden = rows.length > 0;

  rows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "ws-item";

    const top = document.createElement("div");
    top.className = "ws-item-top";

    const title = document.createElement("h3");
    title.textContent = row.name;
    top.appendChild(title);

    const tag = document.createElement("span");
    tag.className = "ws-tag is-" + row.status;
    tag.textContent = row.status;
    top.appendChild(tag);

    item.appendChild(top);

    if (row.description) {
      const description = document.createElement("p");
      description.textContent = row.description;
      item.appendChild(description);
    }

    if (row.when_to_use) {
      const when = document.createElement("p");
      when.textContent = "→ " + row.when_to_use;
      item.appendChild(when);
    }

    const steps = Array.isArray(row.steps) ? row.steps : [];
    if (steps.length) {
      const ol = document.createElement("ol");
      steps.forEach((step) => {
        const li = document.createElement("li");
        const stepTitle = step && typeof step === "object" ? step.title : String(step ?? "");
        const stepDetail = step && typeof step === "object" ? step.detail : "";
        const strong = document.createElement("b");
        strong.textContent = stepTitle || "";
        li.appendChild(strong);
        if (stepDetail && stepDetail !== stepTitle) {
          li.appendChild(document.createTextNode(" — " + stepDetail));
        }
        ol.appendChild(li);
      });
      item.appendChild(ol);
    }

    const guardrails = Array.isArray(row.guardrails) ? row.guardrails : [];
    if (guardrails.length) {
      const list = document.createElement("p");
      const label = document.createElement("b");
      label.textContent = t("ws.guardrails") + ": ";
      list.appendChild(label);
      list.appendChild(document.createTextNode(guardrails.join(" · ")));
      item.appendChild(list);
    }

    const actions = document.createElement("div");
    actions.className = "ws-item-actions";

    if (row.status !== "active") {
      const activate = document.createElement("button");
      activate.type = "button";
      activate.className = "ws-link";
      activate.textContent = t("activate");
      activate.addEventListener("click", () => transitionSkill(row.id, "active"));
      actions.appendChild(activate);
    }

    if (row.status !== "archived") {
      const archive = document.createElement("button");
      archive.type = "button";
      archive.className = "ws-link";
      archive.textContent = t("archive");
      archive.addEventListener("click", () => {
        if (window.confirm(t("confirmArchive"))) transitionSkill(row.id, "archived");
      });
      actions.appendChild(archive);
    }

    if (actions.childElementCount > 0) item.appendChild(actions);
    listEl.appendChild(item);
  });
}

async function loadSkills() {
  const sb = client();
  if (!sb || !organizationId) return;
  const { data, error } = await sb
    .from("organization_skills")
    .select("id, name, description, when_to_use, steps, guardrails, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus(error.message, "error");
    return;
  }
  renderSkills(data || []);
}

async function transitionSkill(skillId, targetStatus) {
  const sb = client();
  if (!sb) return;
  const { error } = await sb.rpc("transition_organization_skill_v1", {
    p_skill_id: skillId,
    p_target_status: targetStatus,
  });
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  await loadSkills();
}

/* ---------- AI draft ---------- */

async function requestDraft(sourceText) {
  const response = await fetch(supabaseUrl + "/functions/v1/skill-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (session?.access_token || ""),
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ sourceText, locale: language }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const suggestion = payload?.suggestion;
  if (!suggestion || typeof suggestion !== "object") return null;
  return suggestion;
}

function applySuggestion(suggestion) {
  nameEl.value = String(suggestion.name || "").slice(0, 120);
  whenEl.value = String(suggestion.when_to_use || "").slice(0, 600);
  descriptionEl.value = String(suggestion.description || "").slice(0, 600);
  const steps = Array.isArray(suggestion.steps) ? suggestion.steps.slice(0, SKILL_MAX_STEPS) : [];
  stepsEl.value = steps
    .map((step) => {
      const title = String(step?.title || "").trim();
      const detail = String(step?.detail || "").trim();
      return detail ? title + " :: " + detail : title;
    })
    .join("\n");
  const guardrails = Array.isArray(suggestion.guardrails) ? suggestion.guardrails.slice(0, SKILL_MAX_GUARDRAILS) : [];
  guardrailsEl.value = guardrails.join("\n");
}

/* ---------- Events ---------- */

document.querySelectorAll(".ws-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.mode === "signup" ? "signup" : "signin";
    document.querySelectorAll(".ws-tab").forEach((other) => {
      const active = other === tab;
      other.classList.toggle("is-active", active);
      other.setAttribute("aria-selected", String(active));
    });
    authSubmit.querySelector("span").textContent = t(authMode === "signup" ? "ws.signupSubmit" : "ws.signinSubmit");
    authPassword.setAttribute("autocomplete", authMode === "signup" ? "new-password" : "current-password");
    setStatus("");
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sb = client();
  if (!sb) {
    setStatus(t("needConfig"), "error");
    return;
  }

  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || password.length < 8) {
    setStatus(t("needEmail"), "error");
    return;
  }

  authSubmit.disabled = true;
  try {
    if (authMode === "signup") {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) {
        setStatus(error.message, "error");
        return;
      }
      if (!data.session) {
        setStatus(t("checkEmail"), "ok");
        return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message, "error");
        return;
      }
    }
  } finally {
    authSubmit.disabled = false;
  }
});

document.getElementById("signout").addEventListener("click", async () => {
  const sb = client();
  if (sb) await sb.auth.signOut();
  organizationId = "";
  session = null;
  renderSkills([]);
  showAuth();
  setStatus(t("okSignedOut"));
});

document.getElementById("reload").addEventListener("click", async () => {
  await loadSkills();
  setStatus(t("okReloaded"));
});

draftBtn.addEventListener("click", async () => {
  const sourceText = sourceEl.value.trim().slice(0, SKILL_SOURCE_MAX_LENGTH);
  if (!sourceText) {
    sourceEl.focus();
    setStatus(t("needSource"), "error");
    return;
  }
  draftBtn.disabled = true;
  const label = draftBtn.querySelector("span");
  const original = label.textContent;
  label.textContent = t("drafting");
  setStatus("");
  try {
    const suggestion = await requestDraft(sourceText);
    if (!suggestion) {
      setStatus(t("noDraftService"), "error");
      return;
    }
    applySuggestion(suggestion);
    setStatus(t("okDraft"), "ok");
  } catch {
    setStatus(t("noDraftService"), "error");
  } finally {
    draftBtn.disabled = false;
    label.textContent = original || t("ws.draft");
  }
});

skillForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sb = client();
  if (!sb || !organizationId) {
    setStatus(t("needConfig"), "error");
    return;
  }

  const name = nameEl.value.trim();
  const steps = parseSteps(stepsEl.value);
  if (!name || steps.length === 0) {
    setStatus(t("needFields"), "error");
    nameEl.focus();
    return;
  }

  saveBtn.disabled = true;
  const label = saveBtn.querySelector("span");
  const original = label.textContent;
  label.textContent = t("saving");

  try {
    const { error } = await sb.rpc("create_organization_skill_v1", {
      p_organization_id: organizationId,
      p_name: name,
      p_description: descriptionEl.value.trim().slice(0, 600),
      p_when_to_use: whenEl.value.trim().slice(0, 600),
      p_steps: steps,
      p_guardrails: parseGuardrails(guardrailsEl.value),
      p_initial_status: "draft",
      p_source_text: sourceEl.value.trim().slice(0, SKILL_SOURCE_MAX_LENGTH),
    });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    skillForm.reset();
    setStatus(t("okSaved"), "ok");
    await loadSkills();
  } finally {
    saveBtn.disabled = false;
    label.textContent = original || t("ws.save");
  }
});

document.querySelector(".lang-toggle").addEventListener("click", () => {
  setLanguage(language === "en" ? "bg" : "en");
});

/* ---------- Boot ---------- */

async function boot() {
  setLanguage(language);

  if (!configured) {
    setStatus(t("needConfig"), "error");
    showAuth();
    authSubmit.disabled = true;
    return;
  }

  const sb = client();
  if (!sb) {
    setStatus(t("errGeneric"), "error");
    showAuth();
    return;
  }

  const { data } = await sb.auth.getSession();
  session = data?.session ?? null;

  if (!session) {
    showAuth();
    return;
  }

  await enterOnce(sb, session);
}

async function enterWorkspace(sb, activeSession) {
  try {
    organizationId = await ensureOrganization(sb, activeSession.user);
    showApp(activeSession.user.email);
    await loadSkills();
  } catch (error) {
    setStatus(error.message || t("errGeneric"), "error");
    showAuth();
  }
}

/* One organization per user: a single in-flight entry, so boot() and the
   INITIAL_SESSION event cannot both create an organization. */
let entering = null;
function enterOnce(sb, activeSession) {
  if (!entering) {
    entering = enterWorkspace(sb, activeSession).finally(() => { entering = null; });
  }
  return entering;
}

client()?.auth.onAuthStateChange((event, nextSession) => {
  session = nextSession ?? null;
  if (event === "SIGNED_OUT" || !session) {
    organizationId = "";
    renderSkills([]);
    showAuth();
    return;
  }
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
    // Deferred: Supabase asks callbacks not to await auth work inside the emitter.
    setTimeout(() => {
      if (organizationId) {
        showApp(session.user.email);
      } else {
        enterOnce(client(), session);
      }
    }, 0);
  }
});

boot();
