(function () {
  var STORAGE_KEYS = {
    preferredLanguage: "handam_preferred_language_v2"
  };

  var initialLanguage = localStorage.getItem(STORAGE_KEYS.preferredLanguage) || "auto";

  var chatState = {
    history: [],
    preferredLanguage: initialLanguage,
    activeLanguage: initialLanguage
  };

  var LANGUAGE_LABELS = {
    auto: "Auto",
    en: "English",
    tl: "Tagalog",
    hil: "Hiligaynon",
    ceb: "Cebuano"
  };

  var DEFAULT_BOT_MESSAGES = [
    "Hello, I’m HANDAm. You can talk to me naturally in English, Tagalog, Hiligaynon, or Cebuano.",
    "Ask me anything normally—greetings, language switching, flood safety, typhoon prep, shelters, hotlines, go-bags, evacuation, and local guidance."
  ];

  var TYPO_FIXES = {
    "helo": "hello",
    "hellow": "hello",
    "hii": "hi",
    "thnks": "thanks",
    "tnx": "thanks",
    "taglog": "tagalog",
    "hiligynon": "hiligaynon",
    "hiliganon": "hiligaynon",
    "ilonggoe": "ilonggo",
    "cebuanno": "cebuano",
    "pls": "please",
    "pls.": "please",
    "subng": "subong",
    "sng": "sang",
    "sg": "sang",
    "mayra": "mayara",
    "knahanglan": "kinahanglan",
    "kablo": "kabalo",
    "kabalu": "kabalo",
    "kahambal": "hambal",
    "maghambal": "hambal",
    "mayad": "maayo",
    "bahaa": "baha",
    "bagyoo": "bagyo",
    "evac": "evacuation"
  };

  var LANGUAGE_SWITCH_PATTERNS = {
    en: [
      /\b(english please|reply in english|speak english|use english|english na|pwede english)\b/i,
      /\b(can you|could you|please|pwede ka|pwede)\b.*\benglish\b/i
    ],
    tl: [
      /\b(tagalog please|reply in tagalog|speak tagalog|use tagalog|mag tagalog ka|tagalog na)\b/i,
      /\b(can you|could you|please|pwede ka|pwede)\b.*\btagalog\b/i,
      /\b(i don'?t understand english|di ko maintindihan english|hindi ko maintindihan english)\b/i
    ],
    hil: [
      /\b(hiligaynon please|reply in hiligaynon|speak hiligaynon|use hiligaynon|hiligaynon na|ilonggo please|reply in ilonggo|speak ilonggo|use ilonggo)\b/i,
      /\b(can you|could you|please|pwede ka|pwede)\b.*\b(hiligaynon|ilonggo)\b/i,
      /\bmag\s+(ka\s+)?(hiligaynon|ilonggo)\b/i,
      /\b(hambal|istorya)\b.*\b(hiligaynon|ilonggo)\b/i,
      /\b(hiligaynon|ilonggo)\b.*\b(hambal|istorya)\b/i
    ],
    ceb: [
      /\b(cebuano please|bisaya please|reply in cebuano|reply in bisaya|speak cebuano|speak bisaya|use cebuano|use bisaya|cebuano na|bisaya na)\b/i,
      /\b(can you|could you|please|pwede ka|pwede)\b.*\b(cebuano|bisaya)\b/i,
      /\bmag\s+(ka\s+)?(cebuano|bisaya)\b/i
    ]
  };

  var LANGUAGE_HINTS = {
    tl: [
      "saan", "asan", "ano", "paano", "kailan", "pwede", "hindi", "naman", "talaga", "bakit", "kasi",
      "ako", "ikaw", "mo", "ko", "dito", "iyan", "ito", "kung", "natin", "naman", "baha", "bagyo", "lindol"
    ],
    hil: [
      "ari", "subong", "mayara", "wala", "kabalo", "diin", "san o", "ano", "pwede", "indi", "gid",
      "akon", "imo", "sakon", "sa imo", "gani", "kay", "linog", "bagyo", "baha", "ubra", "ubrahon", "istorya",
      "ayhan", "amo", "diri", "palihog", "sang", "wala sang", "bala", "gani", "likaw", "anay"
    ],
    ceb: [
      "asa", "unsa", "kanus", "pwede", "dili", "naa", "naay", "imong", "nimo", "karon", "ug",
      "buhaton", "istorya", "tabang", "linog", "bagyo", "baha", "balay", "diha", "palihug", "unsaon"
    ],
    en: [
      "hello", "what", "where", "when", "how", "please", "help", "flood", "typhoon", "earthquake", "shelter", "evacuation",
      "can", "could", "would", "should", "area", "location", "route", "hotline"
    ]
  };

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.style.display = "none";
    }, 2400);
  }

  function normalizeText(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/(.)\1{2,}/g, "$1$1")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map(function (word) {
        return TYPO_FIXES[word] || word;
      })
      .join(" ");
  }

  function updateLanguageBadge() {
    var badge = document.getElementById("languageBadge");
    if (!badge) return;
    var currentLanguage = chatState.activeLanguage || chatState.preferredLanguage || "auto";
    badge.textContent = "Language: " + (LANGUAGE_LABELS[currentLanguage] || "Auto");
  }

  function setPreferredLanguage(languageCode, options) {
    var opts = options || {};
    var normalized = LANGUAGE_LABELS[languageCode] ? languageCode : "auto";
    chatState.preferredLanguage = normalized;
    chatState.activeLanguage = normalized;
    localStorage.setItem(STORAGE_KEYS.preferredLanguage, normalized);
    updateLanguageBadge();

    if (opts.toastMessage) {
      showToast(opts.toastMessage);
    }
  }

  function setActiveLanguage(languageCode) {
    var normalized = LANGUAGE_LABELS[languageCode] ? languageCode : "auto";
    chatState.activeLanguage = normalized;
    updateLanguageBadge();
  }

  function inferExplicitLanguageSwitch(text) {
    var raw = text || "";
    var normalized = normalizeText(raw);

    var languages = ["en", "tl", "hil", "ceb"];
    for (var i = 0; i < languages.length; i += 1) {
      var lang = languages[i];
      var patterns = LANGUAGE_SWITCH_PATTERNS[lang] || [];
      for (var j = 0; j < patterns.length; j += 1) {
        if (patterns[j].test(raw) || patterns[j].test(normalized)) {
          return lang;
        }
      }
    }

    return null;
  }

  function detectLanguageDetailed(text) {
    var normalized = normalizeText(text);
    var scores = { en: 0, tl: 0, hil: 0, ceb: 0 };

    Object.keys(LANGUAGE_HINTS).forEach(function (lang) {
      LANGUAGE_HINTS[lang].forEach(function (token) {
        if (normalized.indexOf(token) !== -1) {
          scores[lang] += token.indexOf(" ") !== -1 ? 2 : 1;
        }
      });
    });

    if (/\b(hiligaynon|ilonggo)\b/.test(normalized)) scores.hil += 5;
    if (/\b(tagalog|filipino)\b/.test(normalized)) scores.tl += 5;
    if (/\b(cebuano|bisaya)\b/.test(normalized)) scores.ceb += 5;
    if (/\benglish\b/.test(normalized)) scores.en += 5;

    if (/\b(ari|subong|mayara|sakon|akon|imo|gid|indi|ayhan|amo|diri|palihog|sang|hambal)\b/.test(normalized)) scores.hil += 3;
    if (/\b(asa|unsa|kanus|naay|imong|nimo|dili|ug|palihug)\b/.test(normalized)) scores.ceb += 3;
    if (/\b(saan|kailan|bakit|hindi|natin)\b/.test(normalized)) scores.tl += 3;

    var bestLang = "en";
    var bestScore = 0;
    Object.keys(scores).forEach(function (lang) {
      if (scores[lang] > bestScore) {
        bestScore = scores[lang];
        bestLang = lang;
      }
    });

    return {
      language: bestScore > 0 ? bestLang : "en",
      score: bestScore,
      scores: scores
    };
  }

  function detectLanguage(text) {
    return detectLanguageDetailed(text).language;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMessageHtml(text) {
    var safe = escapeHtml(text || "");

    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/(^|\s)\*(?!\s)([^*\n]+?)\*(?=\s|$)/g, "$1<em>$2</em>");
    safe = safe.replace(/\n/g, "<br>");

    return safe;
  }

  function renderBubbleText(bubble, text) {
    if (!bubble) return;
    bubble.innerHTML = formatMessageHtml(text);
  }

  function appendBubble(role, content, extraClass) {
    var chatBox = document.getElementById("chatBox");
    if (!chatBox) return null;

    var bubble = document.createElement("div");
    bubble.className = "bubble " + role + (extraClass ? " " + extraClass : "");

    if (typeof content === "string") {
      renderBubbleText(bubble, content);
    } else if (content instanceof Node) {
      bubble.appendChild(content);
    }

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
  }

  function createTypingContent() {
    var row = document.createElement("span");
    row.className = "typing-row";

    for (var i = 0; i < 3; i += 1) {
      var dot = document.createElement("span");
      dot.className = "typing-dot";
      row.appendChild(dot);
    }

    return row;
  }

  function appendTypingBubble() {
    return appendBubble("bot", createTypingContent(), "loading");
  }

  function renderWelcomeBubbles() {
    var chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    chatBox.innerHTML = "";
    DEFAULT_BOT_MESSAGES.forEach(function (message) {
      appendBubble("bot", message, "welcome");
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  async function typeReply(bubble, text) {
    if (!bubble) return;

    bubble.classList.remove("loading");
    bubble.textContent = "";
    bubble.classList.add("typing-text");

    var speed = text.length > 320 ? 4 : text.length > 180 ? 7 : 11;

    for (var i = 0; i < text.length; i += 1) {
      bubble.textContent += text.charAt(i);
      var delay = text.charAt(i) === "\n" ? speed * 2 : speed;
      await sleep(delay);
    }

    bubble.classList.remove("typing-text");
    renderBubbleText(bubble, text);
  }

  function hydrateHistoryFromDOM() {
    var chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    chatState.history = [];
    Array.prototype.forEach.call(chatBox.querySelectorAll(".bubble"), function (bubble) {
      var content = (bubble.textContent || "").trim();
      if (!content) return;
      chatState.history.push({
        role: bubble.classList.contains("user") ? "user" : "assistant",
        content: content
      });
    });
  }

  function trimHistory(history, maxItems) {
    return history.slice(Math.max(history.length - maxItems, 0));
  }

  function shouldRequestLocation(text) {
    var normalized = normalizeText(text);
    return (
      /\b(nearest|near me|current location|my location|route|road|shelter|evacuation center|hotline)\b/.test(normalized) ||
      /\b(diin|asa|saan)\b/.test(normalized)
    );
  }

  function getCurrentLocationSafe() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || null
          });
        },
        function () {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 60000
        }
      );
    });
  }

  function extractServerErrorMessage(data, response) {
    if (data && data.details) {
      if (data.details.error && data.details.error.message) {
        return data.details.error.message;
      }
      if (typeof data.details.message === "string" && data.details.message.trim()) {
        return data.details.message.trim();
      }
    }

    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }

    return "Server returned " + response.status;
  }

  async function askServerAI(payload) {
    var response = await fetch("api/handam_ai.php", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    var data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error("Invalid JSON response from api/handam_ai.php");
    }

    if (!response.ok) {
      throw new Error(extractServerErrorMessage(data, response));
    }

    if (!data || !data.reply) {
      throw new Error("Empty AI reply");
    }

    return data;
  }

  function localizedError(language) {
    var map = {
      en: "I’m having trouble connecting to the AI service right now. Please try again in a moment.",
      tl: "Nagkakaproblema ako sa pagkonekta sa AI service ngayon. Pakisubukan ulit maya-maya.",
      hil: "May problema ako subong sa pagkonekta sa AI service. Palihog liwat anay sa pila ka sandali.",
      ceb: "Naa koy problema sa pagkonekta sa AI service karon. Palihog sulayi og usab pagkahuman sa makadiyot."
    };
    return map[language] || map.en;
  }

  async function sendChat() {
    var input = document.getElementById("chatInput");
    if (!input) return;

    var text = input.value.trim();
    if (!text) {
      showToast("Type a message first.");
      return;
    }

    var explicitLanguage = inferExplicitLanguageSwitch(text);
    var detectedInfo = detectLanguageDetailed(text);
    var detectedLanguage = detectedInfo.language;
    var requestLanguage = chatState.preferredLanguage || "auto";

    if (explicitLanguage) {
      setPreferredLanguage(explicitLanguage);
      requestLanguage = explicitLanguage;
    } else if (detectedInfo.score >= 2 && detectedLanguage) {
      chatState.preferredLanguage = detectedLanguage;
      localStorage.setItem(STORAGE_KEYS.preferredLanguage, detectedLanguage);
      setActiveLanguage(detectedLanguage);
      requestLanguage = detectedLanguage;
    } else {
      requestLanguage = chatState.preferredLanguage || "auto";
      setActiveLanguage(requestLanguage === "auto" ? detectedLanguage : requestLanguage);
    }

    appendBubble("user", text);
    chatState.history.push({ role: "user", content: text });
    input.value = "";

    var typingBubble = appendTypingBubble();

    try {
      var location = shouldRequestLocation(text) ? await getCurrentLocationSafe() : null;

      var responseDataPromise = askServerAI({
        message: text,
        history: trimHistory(chatState.history, 22),
        preferred_language: requestLanguage,
        detected_language: detectedLanguage,
        location: location
      });

      var minWait = sleep(700);
      var settled = await Promise.all([responseDataPromise, minWait]);
      var responseData = settled[0];

      var replyInfo = detectLanguageDetailed(responseData.reply || "");
      var replyLanguage = replyInfo.language;
      var effectiveLanguage = replyInfo.score >= 2
        ? replyLanguage
        : ((responseData.language_used && responseData.language_used !== "auto")
            ? responseData.language_used
            : (requestLanguage !== "auto" ? requestLanguage : (replyLanguage || detectedLanguage)));

      if (effectiveLanguage && effectiveLanguage !== "auto") {
        chatState.preferredLanguage = effectiveLanguage;
        localStorage.setItem(STORAGE_KEYS.preferredLanguage, effectiveLanguage);
      }

      setActiveLanguage(effectiveLanguage);

      await typeReply(typingBubble, responseData.reply);
      chatState.history.push({ role: "assistant", content: responseData.reply });
    } catch (error) {
      console.error("HANDAm error:", error);
      var fallbackLanguage = chatState.preferredLanguage !== "auto"
        ? chatState.preferredLanguage
        : detectedLanguage;
      setActiveLanguage(fallbackLanguage);
      await typeReply(typingBubble, localizedError(fallbackLanguage));
      chatState.history.push({ role: "assistant", content: localizedError(fallbackLanguage) });

      var readableMessage = (error && error.message) ? error.message : "AI server error.";
      if (/quota|billing|insufficient|credit/i.test(readableMessage)) {
        showToast("AI credits or billing may be exhausted. Check your OpenAI balance.");
      } else {
        showToast(readableMessage);
      }
    }
  }

  function setQuestion(text, languageCode) {
    var input = document.getElementById("chatInput");
    if (!input) return;
    input.value = text;
    if (languageCode) {
      setPreferredLanguage(languageCode);
    }
    input.focus();
  }

  function clearChat() {
    var chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    renderWelcomeBubbles();
    hydrateHistoryFromDOM();
    showToast("Chat cleared.");
  }

  window.showToast = showToast;
  window.sendChat = sendChat;
  window.setQuestion = setQuestion;
  window.clearChat = clearChat;

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.loadTheme === "function") {
      window.loadTheme();
    }

    renderWelcomeBubbles();
    hydrateHistoryFromDOM();
    updateLanguageBadge();

    var input = document.getElementById("chatInput");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          sendChat();
        }
      });
    }
  });
})();
